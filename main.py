
from machine import Pin, I2C, ADC, PWM
import ssd1306
import time
import dht
import json
import network
import gc

try:
    import urequests as requests
except ImportError:
    import requests

# ============================================================
# CONFIGURACION DEL MODULO (Cambiar 1-5 segun invernadero)
# ============================================================
MODULE_ID = 1

# WiFi - Wokwi usa "Wokwi-GUEST" sin password
WIFI_SSID = "Wokwi-GUEST"
WIFI_PASS = ""

# Bridge en Render (Wokwi resuelve DNS externo via su proxy)
BRIDGE_URL = "https://huerto-puente.onrender.com"
BRIDGE_KEY = "huerto-ccss-2026"

# ============================================================
# SENSOR OVERRIDE - Forzado de valores por software
# ============================================================

class SensorOverride:
    """Maneja el forzado de valores de sensores por software.
    
    Ciclo de 3 fases:
    1. DEGRADING (21s): valor fisico actual -> valor critico (7 pasos x 3s)
    2. HOLDING (2s): se mantiene en valor critico
    3. RECOVERING (60s): valor critico -> setpoint ideal (20 pasos x 3s)
    """
    
    PHASE_DEGRADING = 0
    PHASE_HOLDING = 1
    PHASE_RECOVERING = 2
    
    def __init__(self):
        self.overrides = {}
        self.stabilization = {}
        
        self.setpoints = {
            'hum_suelo': 60.0,
            'ph': 6.8,
            'temp': 25.0,
            'hum_amb': 65.0
        }
        
        self.rangos = {
            'hum_suelo': {'min': 0, 'max': 100, 'umbral_critico': 30, 'umbral_recuperacion': 55},
            'ph': {'min': 0, 'max': 14, 'umbral_critico_bajo': 4.5, 'umbral_critico_alto': 9.0,
                   'umbral_recuperacion_bajo': 5.5, 'umbral_recuperacion_alto': 7.5},
            'temp': {'min': -10, 'max': 50, 'umbral_critico_alto': 35, 'umbral_critico_bajo': 10,
                     'umbral_recuperacion_alto': 30, 'umbral_recuperacion_bajo': 15},
            'hum_amb': {'min': 0, 'max': 100, 'umbral_critico_bajo': 20, 'umbral_critico_alto': 85,
                        'umbral_recuperacion_bajo': 30, 'umbral_recuperacion_alto': 75}
        }
    
    def set_override(self, maceta, sensor_tipo, valor_forzado, valor_fisico_actual):
        """Forzar un valor de sensor con ciclo de 3 fases.
        
        Args:
            valor_fisico_actual: Valor actual leido del pin fisico del sensor.
        """
        key = (maceta, sensor_tipo)
        self.overrides[key] = {
            'valor': valor_fisico_actual,
            'activa': True,
            'timestamp': time.time()
        }
        
        setpoint = self.setpoints.get(sensor_tipo, 50.0)
        self.stabilization[key] = {
            'valor_fisico_inicio': valor_fisico_actual,
            'valor_critico': valor_forzado,
            'setpoint': setpoint,
            'fase': self.PHASE_DEGRADING,
            'paso': 0,
            'max_pasos_deg': 7,
            'max_pasos_rec': 20,
            'hold_inicio': 0,
            'hold_duracion': 2,
            'activo': True,
            'ultima_actualizacion': time.time()
        }
        
        print("[OVERRIDE] MAC-{} {} DEGRAD {} -> {}".format(
            maceta, sensor_tipo, valor_fisico_actual, valor_forzado))
    
    def get_valor(self, maceta, sensor_tipo, valor_fisico):
        """Obtener valor del sensor (fisico o forzado)."""
        key = (maceta, sensor_tipo)
        
        if key in self.overrides and self.overrides[key]['activa']:
            age = time.time() - self.overrides[key]['timestamp']
            if age > 120:
                print("[OVERRIDE] MAC-{} {} TTL expirado".format(maceta, sensor_tipo))
                self._clear_override(maceta, sensor_tipo)
                return valor_fisico
            return self._apply_stabilization(maceta, sensor_tipo, key, valor_fisico)
        
        if key in self.overrides and not self.overrides[key]['activa']:
            self._clear_override(maceta, sensor_tipo)
        
        return valor_fisico
    
    def _apply_stabilization(self, maceta, sensor_tipo, key, valor_fisico):
        """Aplicar algoritmo de estabilizacion de 3 fases."""
        stab = self.stabilization.get(key)
        if not stab or not stab['activo']:
            self._clear_override(maceta, sensor_tipo)
            return valor_fisico
        
        now = time.time()
        fase = stab['fase']
        
        if fase == self.PHASE_DEGRADING:
            elapsed = now - stab['ultima_actualizacion']
            if elapsed >= 3:
                stab['paso'] += 1
                stab['ultima_actualizacion'] = now
                progreso = min(stab['paso'] / stab['max_pasos_deg'], 1.0)
                inicio = stab['valor_fisico_inicio']
                critico = stab['valor_critico']
                valor_nuevo = round(inicio + (critico - inicio) * progreso, 1)
                self.overrides[key]['valor'] = valor_nuevo
                if stab['paso'] % 3 == 0:
                    print("[DEGRAD] MAC-{} {} {}/{}: {} -> {}".format(
                        maceta, sensor_tipo, stab['paso'], stab['max_pasos_deg'],
                        inicio, valor_nuevo))
                if stab['paso'] >= stab['max_pasos_deg']:
                    stab['fase'] = self.PHASE_HOLDING
                    stab['hold_inicio'] = now
                    stab['paso'] = 0
                    self.overrides[key]['valor'] = critico
                    print("[HOLD] MAC-{} {} en critico {}".format(maceta, sensor_tipo, critico))
            return self.overrides[key]['valor']
        
        elif fase == self.PHASE_HOLDING:
            if now - stab['hold_inicio'] >= stab['hold_duracion']:
                stab['fase'] = self.PHASE_RECOVERING
                stab['paso'] = 0
                stab['ultima_actualizacion'] = now
                stab['valor_fisico_inicio'] = stab['valor_critico']
                print("[RECOVER] MAC-{} {} -> setpoint={}".format(
                    maceta, sensor_tipo, stab['setpoint']))
            return self.overrides[key]['valor']
        
        elif fase == self.PHASE_RECOVERING:
            elapsed = now - stab['ultima_actualizacion']
            if elapsed >= 3:
                stab['paso'] += 1
                stab['ultima_actualizacion'] = now
                progreso = min(stab['paso'] / stab['max_pasos_rec'], 1.0)
                critico = stab['valor_critico']
                setpoint = stab['setpoint']
                valor_nuevo = round(critico + (setpoint - critico) * progreso, 1)
                self.overrides[key]['valor'] = valor_nuevo
                if stab['paso'] % 5 == 0:
                    print("[RECOVER] MAC-{} {} {}/{}: {} -> {}".format(
                        maceta, sensor_tipo, stab['paso'], stab['max_pasos_rec'],
                        critico, valor_nuevo))
                if stab['paso'] >= stab['max_pasos_rec']:
                    stab['activo'] = False
                    self.overrides[key]['activa'] = False
                    print("[DONE] MAC-{} {} completado".format(maceta, sensor_tipo))
            return self.overrides[key]['valor']
        
        return valor_fisico
    
    def get_fase(self, maceta, sensor_tipo):
        key = (maceta, sensor_tipo)
        stab = self.stabilization.get(key)
        if stab and stab['activo']:
            return stab['fase']
        return None
    
    def _clear_override(self, maceta, sensor_tipo):
        key = (maceta, sensor_tipo)
        if key in self.overrides:
            del self.overrides[key]
        if key in self.stabilization:
            del self.stabilization[key]
    
    def tiene_override(self, maceta, sensor_tipo):
        key = (maceta, sensor_tipo)
        return key in self.overrides and self.overrides[key]['activa']
    
    def desactivar_todos(self):
        for key in list(self.overrides.keys()):
            self.overrides[key]['activa'] = False
        for key in list(self.stabilization.keys()):
            self.stabilization[key]['activo'] = False

# Instancia global de override
sensor_override = SensorOverride()

# ============================================================
# LOGICA DE CONTROL EN LAZO CERRADO
# ============================================================

class LazoCerrado:
    """Control automatico de actuadores basado en condiciones de sensores.
    
    Cuando un sensor esta en zona critica:
    - Activa el actuador correspondiente automaticamente
    - Cuando el sensor se recupera, apaga el actuador
    """
    
    def __init__(self):
        # Estado de actuadores: {maceta: {bomba: bool, ventilador: bool, pulverizador: bool}}
        self.actuadores_estado = {1: {}, 2: {}, 3: {}, 4: {}}
    
    def evaluar(self, maceta, datos):
        """Evaluar si se deben activar/desactivar actuadores."""
        hum_suelo = datos.get('hum_suelo')
        temp = datos.get('temp')
        hum_amb = datos.get('hum_amb')
        ph = datos.get('ph')
        
        acciones = []
        
        # === BOMBA DE RIEGO ===
        # Se activa cuando humedad del suelo < 30% (critico)
        # Se apaga cuando humedad del suelo > 55% (recuperacion)
        if hum_suelo is not None:
            if hum_suelo < 30:
                if not self.actuadores_estado[maceta].get('bomba'):
                    acciones.append(('bomba', 'ON'))
                    self.actuadores_estado[maceta]['bomba'] = True
                    print("[LAZO] MAC-{} Bomba ON (hum_suelo={})".format(maceta, hum_suelo))
            elif hum_suelo > 55:
                if self.actuadores_estado[maceta].get('bomba'):
                    acciones.append(('bomba', 'OFF'))
                    self.actuadores_estado[maceta]['bomba'] = False
                    print("[LAZO] MAC-{} Bomba OFF (hum_suelo={})".format(maceta, hum_suelo))
        
        # === VENTILADOR ===
        # Se activa cuando temp > 35 C (critico) o humedad ambiente > 85%
        # Se apaga cuando temp < 30 C y humedad < 75%
        if temp is not None:
            if temp > 35 or (hum_amb is not None and hum_amb > 85):
                if not self.actuadores_estado[maceta].get('ventilador'):
                    acciones.append(('ventilador', 'ON'))
                    self.actuadores_estado[maceta]['ventilador'] = True
                    print("[LAZO] MAC-{} Ventilador ON (temp={}, hum_amb={})".format(maceta, temp, hum_amb))
            elif temp < 30 and (hum_amb is None or hum_amb < 75):
                if self.actuadores_estado[maceta].get('ventilador'):
                    acciones.append(('ventilador', 'OFF'))
                    self.actuadores_estado[maceta]['ventilador'] = False
                    print("[LAZO] MAC-{} Ventilador OFF (temp={})".format(maceta, temp))
        
        # === PULVERIZADOR ===
        # Se activa cuando humedad ambiente < 20% (critico) o temp > 35 C
        # Se apaga cuando humedad ambiente > 50%
        if hum_amb is not None:
            if hum_amb < 20 or (temp is not None and temp > 35):
                if not self.actuadores_estado[maceta].get('pulverizador'):
                    acciones.append(('pulverizador', 'ON'))
                    self.actuadores_estado[maceta]['pulverizador'] = True
                    print("[LAZO] MAC-{} Pulverizador ON (hum_amb={}, temp={})".format(maceta, hum_amb, temp))
            elif hum_amb > 50:
                if self.actuadores_estado[maceta].get('pulverizador'):
                    acciones.append(('pulverizador', 'OFF'))
                    self.actuadores_estado[maceta]['pulverizador'] = False
                    print("[LAZO] MAC-{} Pulverizador OFF (hum_amb={})".format(maceta, hum_amb))
        
        return acciones

# Instancia global de lazo cerrado
lazo_cerrado = LazoCerrado()

# ============================================================
# CONEXION WiFi
# ============================================================

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if wlan.isconnected():
        print("[WiFi] Ya conectado: {}".format(wlan.ifconfig()[0]))
        return True
    
    print("[WiFi] '{}'...".format(WIFI_SSID))
    wlan.connect(WIFI_SSID, WIFI_PASS)
    
    timeout = 20
    while not wlan.isconnected() and timeout > 0:
        time.sleep(1)
        timeout -= 1
    
    if wlan.isconnected():
        config = wlan.ifconfig()
        print("[WiFi] Conectado! IP: {}".format(config[0]))
        return True
    else:
        print("[WiFi] ERROR: No se pudo conectar")
        return False

# ============================================================
# PIN MAP - 4 Macetas via MUX CD74HC4067
# ============================================================

# MUX
MUX_S0 = Pin(27, Pin.OUT)
MUX_S1 = Pin(16, Pin.OUT)
MUX_S2 = Pin(17, Pin.OUT)
MUX_S3 = Pin(18, Pin.OUT)
MUX_SIG = ADC(Pin(34))
MUX_SIG.atten(ADC.ATTN_11DB)

# DHT22 - 1 por maceta
# dht1=GPIO4, dht2=GPIO19, dht3=GPIO2, dht4=GPIO13 (segun diagrama Wokwi)
DHT_PINS = [Pin(4), Pin(19), Pin(2), Pin(13)]
dht_sensors = [dht.DHT22(p) for p in DHT_PINS]

# Relays - 3 por maceta + buzzer
# NOTA: GPIO13 se usa para DHT22 MAC-4, bomba MAC-1 usa GPIO32
RELAYS = {
    1: {'bomba': Pin(32, Pin.OUT), 'ventilador': Pin(14, Pin.OUT), 'pulverizador': Pin(5, Pin.OUT)},
    2: {'bomba': Pin(23, Pin.OUT), 'ventilador': Pin(0, Pin.OUT),  'pulverizador': Pin(15, Pin.OUT)},
    3: {'bomba': Pin(12, Pin.OUT), 'ventilador': Pin(11, Pin.OUT), 'pulverizador': Pin(10, Pin.OUT)},
    4: {'bomba': Pin(8, Pin.OUT),  'ventilador': Pin(7, Pin.OUT),  'pulverizador': Pin(6, Pin.OUT)},
}
buzzer = PWM(Pin(26))

# LEDs status - GPIO32 se usa para bomba MAC-1, GPIO33 y GPIO25 disponibles
led_naranja = Pin(33, Pin.OUT)
led_amarillo = Pin(25, Pin.OUT)
led_verde = Pin(1, Pin.OUT)

# OLED
i2c = I2C(0, scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

# ============================================================
# PCF8574 I2C EXPANDER - RELAY STATUS LEDs
# ============================================================

class PCF8574:
    def __init__(self, i2c_bus, address=0x20):
        self._i2c = i2c_bus
        self._addr = address
        self._state = 0x00
    
    def write_pin(self, pin, value):
        if value:
            self._state |= (1 << pin)
        else:
            self._state &= ~(1 << pin)
        self._i2c.writeto(self._addr, bytes([self._state]))
    
    def write_all(self, value):
        self._state = value & 0xFF
        self._i2c.writeto(self._addr, bytes([self._state]))

PCF8574_ADDR_1 = 0x20
PCF8574_ADDR_2 = 0x21

try:
    pcf1 = PCF8574(i2c, PCF8574_ADDR_1)
    pcf2 = PCF8574(i2c, PCF8574_ADDR_2)
    pcf1.write_all(0x00)
    pcf2.write_all(0x00)
    print("[PCF8574] Chips 0x20 y 0x21 OK")
except Exception as e:
    print("[PCF8574] ERROR: {}".format(e))
    pcf1 = None
    pcf2 = None

# ============================================================
# LED MAP - PCF8574 PIN MAPPING FOR RELAY STATUS
# ============================================================
# Chip 1 (0x20): MAC-1 y MAC-2
# Chip 2 (0x21): MAC-3 y MAC-4

LED_MAP = {
    1: {'bomba': (1, 0), 'ventilador': (1, 1), 'pulverizador': (1, 2)},
    2: {'bomba': (1, 3), 'ventilador': (1, 4), 'pulverizador': (1, 5)},
    3: {'bomba': (2, 0), 'ventilador': (2, 1), 'pulverizador': (2, 2)},
    4: {'bomba': (2, 3), 'ventilador': (2, 4), 'pulverizador': (2, 5)},
}

# ============================================================
# SENSOR MAP - MUX channels
# ============================================================
# C0=suelo_M1, C1=pH_M1, C2=suelo_M2, C3=pH_M2
# C4=suelo_M3, C5=pH_M3, C6=suelo_M4, C7=pH_M4
SOIL_CH = [0, 2, 4, 6]
PH_CH   = [1, 3, 5, 7]

# ============================================================
# FUNCIONES MUX
# ============================================================

def leer_mux(canal):
    MUX_S0.value(canal & 1)
    MUX_S1.value((canal >> 1) & 1)
    MUX_S2.value((canal >> 2) & 1)
    MUX_S3.value((canal >> 3) & 1)
    time.sleep_ms(50)
    return MUX_SIG.read()

def leer_suelo(maceta):
    raw = leer_mux(SOIL_CH[maceta - 1])
    raw2 = leer_mux(SOIL_CH[maceta - 1])
    avg = (raw + raw2) // 2
    # Wokwi soil sensor: 0=seco, 4095=humedad max
    # Mapear rango util (1000-3500) a 0-100%
    pct = int((avg - 1000) / (3500 - 1000) * 100)
    return max(0, min(pct, 100))

def leer_ph(maceta):
    raw = leer_mux(PH_CH[maceta - 1])
    raw2 = leer_mux(PH_CH[maceta - 1])
    avg = (raw + raw2) // 2
    vadc = avg / 4095 * 3.3
    vph = vadc / 0.6
    ph = (4.2 - vph) / 0.3
    return max(0.0, min(round(ph, 2), 14.0))

def leer_dht(maceta):
    for _ in range(3):
        try:
            dht_sensors[maceta - 1].measure()
            t = dht_sensors[maceta - 1].temperature()
            h = dht_sensors[maceta - 1].humidity()
            if t is not None and h is not None:
                return t, h
        except:
            pass
        time.sleep_ms(200)
    return None, None

# ============================================================
# FUNCIONES RELAYS
# ============================================================

def set_relay(maceta, nombre, estado):
    pin = RELAYS[maceta][nombre]
    pin.value(1 if estado == 'ON' else 0)
    led_info = LED_MAP.get(maceta, {}).get(nombre)
    if led_info:
        chip_num, led_pin = led_info
        chip = pcf1 if chip_num == 1 else pcf2
        if chip:
            chip.write_pin(led_pin, 1 if estado == 'ON' else 0)

def set_buzzer(freq, duty):
    if freq > 0:
        buzzer.init(freq=freq, duty=duty)
    else:
        buzzer.init(freq=1, duty=0)

# ============================================================
# FUNCIONES COMUNICACION
# ============================================================

def enviar_lecturas(lecturas):
    gc.collect()
    payload = {
        "dispositivo_id": MODULE_ID,
        "lecturas": lecturas
    }
    resp = None
    try:
        resp = requests.post(
            "{}/api/lecturas".format(BRIDGE_URL),
            json=payload,
            headers={"X-Bridge-Key": BRIDGE_KEY},
            timeout=15
        )
        code = resp.status_code
        print("[ENV] Status: {}".format(code))
        return code in (200, 201)
    except Exception as e:
        print("[ENV] Error: {}".format(e))
        return False
    finally:
        if resp:
            resp.close()
        gc.collect()

def recibir_comandos():
    gc.collect()
    resp = None
    try:
        resp = requests.get(
            "{}/api/comandos/{}".format(BRIDGE_URL, MODULE_ID),
            headers={"X-Bridge-Key": BRIDGE_KEY},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            comandos = data.get('comandos', [])
            for cmd in comandos:
                cmd_id = cmd.get('id')
                pin_str = cmd.get('pin_conexion', '')
                estado = cmd.get('estado_solicitado', 'OFF')
                nombre = cmd.get('nombre_actuador', '')

                if nombre == 'buzzer':
                    if estado == 'ON':
                        set_buzzer(800, 10)
                    else:
                        set_buzzer(0, 0)
                else:
                    for m in range(1, 5):
                        if pin_str in RELAYS[m]:
                            set_relay(m, nombre, estado)
                            break

                gc.collect()
                try:
                    r2 = requests.patch(
                        "{}/api/comando/{}/ejecutado".format(BRIDGE_URL, cmd_id),
                        headers={"X-Bridge-Key": BRIDGE_KEY},
                        timeout=10
                    )
                    r2.close()
                except:
                    pass
                print("[CMD] {} -> {}".format(nombre, estado))
            return comandos
    except Exception as e:
        print("[CMD] Error: {}".format(e))
    finally:
        if resp:
            resp.close()
        gc.collect()
    return []

def recibir_alertas(last_lecturas=None):
    """Recibe alertas de simulacion activas desde Supabase via bridge."""
    gc.collect()
    resp = None
    try:
        resp = requests.get(
            "{}/api/simulacion/overrides/{}".format(BRIDGE_URL, MODULE_ID),
            headers={"X-Bridge-Key": BRIDGE_KEY},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            alertas = data.get('overrides', [])
            
            active_keys = set()
            for alerta in alertas:
                maceta = alerta.get('maceta_numero')
                sensor_tipo = alerta.get('sensor_tipo')
                valor_forzado = alerta.get('valor_forzado')
                
                if maceta and sensor_tipo and valor_forzado is not None:
                    active_keys.add((maceta, sensor_tipo))
                    if not sensor_override.tiene_override(maceta, sensor_tipo):
                        valor_fisico = float(valor_forzado)
                        if last_lecturas and maceta in last_lecturas:
                            vf = last_lecturas[maceta].get(sensor_tipo)
                            if vf is not None:
                                valor_fisico = float(vf)
                        sensor_override.set_override(
                            maceta, sensor_tipo, float(valor_forzado), valor_fisico)
            
            for key in list(sensor_override.overrides.keys()):
                if key not in active_keys:
                    sensor_override._clear_override(key[0], key[1])
            
            return alertas
    except Exception as e:
        print("[ALERT] Error: {}".format(e))
    finally:
        if resp:
            resp.close()
        gc.collect()
    return []

def ejecutar_acciones_lazo(maceta, acciones):
    """Ejecutar acciones del lazo cerrado en relays."""
    for nombre, estado in acciones:
        set_relay(maceta, nombre, estado)
        print("[LAZO] MAC-{} {} -> {}".format(maceta, nombre, estado))
        gc.collect()

def llamar_cleanup():
    """Desactivar alertas antiguas (>5min) en Supabase."""
    gc.collect()
    resp = None
    try:
        resp = requests.post(
            "{}/api/simulacion/cleanup".format(BRIDGE_URL),
            headers={"X-Bridge-Key": BRIDGE_KEY},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            cleaned = data.get('cleaned', 0)
            if cleaned > 0:
                print("[CLEANUP] {} alertas desactivadas".format(cleaned))
    except Exception as e:
        print("[CLEANUP] Error: {}".format(e))
    finally:
        if resp:
            resp.close()
        gc.collect()

# ============================================================
# OLED
# ============================================================

def actualizar_oled(maceta_num, datos):
    oled.fill(0)
    oled.text("INV-{} MAC-{}".format(MODULE_ID, str(maceta_num).zfill(2)), 0, 0)
    oled.text("----------------", 0, 10)

    if datos.get('temp') is not None:
        oled.text("T:{}C H:{}".format(int(datos['temp']), int(datos.get('hum_amb', 0))), 0, 22)
    if datos.get('hum_suelo') is not None:
        oled.text("Suelo: {}%".format(int(datos['hum_suelo'])), 0, 36)
    if datos.get('ph') is not None:
        oled.text("pH: {}".format(datos['ph']), 0, 48)

    oled.show()

# ============================================================
# LOGICA ALERTAS
# ============================================================

def evaluar_alertas(datos):
    temp = datos.get('temp')
    hum_amb = datos.get('hum_amb')
    hum_suelo = datos.get('hum_suelo')
    ph = datos.get('ph')

    critico = False
    alerta = False

    if temp is not None:
        if temp > 35 or temp < 10:
            critico = True
        elif temp > 30 or temp < 15:
            alerta = True

    if hum_suelo is not None:
        if hum_suelo < 30:
            critico = True
        elif hum_suelo < 40 or hum_suelo > 80:
            alerta = True

    if hum_amb is not None:
        if hum_amb > 85 or hum_amb < 20:
            critico = True

    if ph is not None:
        if ph < 4.5 or ph > 9.0:
            critico = True
        elif ph < 5.5 or ph > 7.5:
            alerta = True

    if critico:
        led_naranja.value(1)
        led_amarillo.value(0)
        led_verde.value(0)
    elif alerta:
        led_naranja.value(0)
        led_amarillo.value(1)
        led_verde.value(0)
    else:
        led_naranja.value(0)
        led_amarillo.value(0)
        led_verde.value(1)

    return critico, alerta

# ============================================================
# MAIN
# ============================================================

# Conectar WiFi primero
wifi_ok = connect_wifi()

oled.fill(0)
if wifi_ok:
    oled.text("WiFi: OK", 0, 0)
else:
    oled.text("WiFi: FAIL", 0, 0)
oled.text("INV-{} ONLINE".format(MODULE_ID), 0, 16)
oled.text("Iniciando...", 0, 32)
oled.show()
time.sleep(2)

oled_mac = 1
oled_timer = 0
last_lecturas = {}
alertas_timer = 0
cleanup_timer = 0

print("=== ESP32 INV-{} INICIADO ===".format(MODULE_ID))
print("=== MODO HIBRIDO ACTIVADO ===")

while True:
    try:
        gc.collect()
        lecturas_db = []

        for m in range(1, 5):
            # === LEER SENSORES FISICOS ===
            temp_fisico, hum_amb_fisico = leer_dht(m)
            hum_suelo_fisico = leer_suelo(m)
            ph_fisico = leer_ph(m)
            
            # === APLICAR OVERRIDES SI EXISTEN ===
            temp = sensor_override.get_valor(m, 'temp', temp_fisico)
            hum_amb = sensor_override.get_valor(m, 'hum_amb', hum_amb_fisico)
            hum_suelo = sensor_override.get_valor(m, 'hum_suelo', hum_suelo_fisico)
            ph = sensor_override.get_valor(m, 'ph', ph_fisico)
            
            # === GUARDAR LECTURAS PARA ENVIO ===
            base_id = (MODULE_ID - 1) * 16 + (m - 1) * 4

            lecturas_db.append({"sensor_id": base_id + 1, "valor": temp})
            lecturas_db.append({"sensor_id": base_id + 2, "valor": hum_amb})
            lecturas_db.append({"sensor_id": base_id + 3, "valor": hum_suelo})
            lecturas_db.append({"sensor_id": base_id + 4, "valor": ph})

            last_lecturas[m] = {
                'temp': temp, 'hum_amb': hum_amb,
                'hum_suelo': hum_suelo, 'ph': ph
            }

            # === EVALUAR ALERTAS ===
            critico, alerta = evaluar_alertas(last_lecturas[m])
            
            # === LAZO CERRADO - EVALUAR ACTUADORES ===
            acciones = lazo_cerrado.evaluar(m, last_lecturas[m])
            if acciones:
                ejecutar_acciones_lazo(m, acciones)

            # === INDICAR SI HAY OVERRIDE ACTIVO ===
            override_activo = (sensor_override.tiene_override(m, 'temp') or
                             sensor_override.tiene_override(m, 'hum_amb') or
                             sensor_override.tiene_override(m, 'hum_suelo') or
                             sensor_override.tiene_override(m, 'ph'))
            
            if override_activo:
                print("MAC-{} [OVR] T:{} H:{} S:{} P:{}".format(m, temp, hum_amb, hum_suelo, ph))
            else:
                print("MAC-{} T:{} H:{} S:{} P:{}".format(m, temp, hum_amb, hum_suelo, ph))

        # Verificar WiFi antes de enviar
        wlan = network.WLAN(network.STA_IF)
        if not wlan.isconnected():
            print("[WiFi] Desconectado, reconectando...")
            wifi_ok = connect_wifi()
        
        gc.collect()
        if wifi_ok:
            enviado = enviar_lecturas(lecturas_db)
            print("[ENV] {}".format("OK" if enviado else "FAIL"))
            
            recibir_comandos()
            
            alertas_timer += 1
            if alertas_timer >= 3:
                alertas_timer = 0
                recibir_alertas(last_lecturas)
            
            cleanup_timer += 1
            if cleanup_timer >= 100:
                cleanup_timer = 0
                llamar_cleanup()
        else:
            print("[SKIP] Sin WiFi, datos solo en OLED")

        oled_timer += 1
        if oled_timer >= 3:
            oled_timer = 0
            actualizar_oled(oled_mac, last_lecturas.get(oled_mac, {}))
            oled_mac += 1
            if oled_mac > 4:
                oled_mac = 1

        time.sleep(3)

    except Exception as e:
        print("[ERROR] {}".format(e))
        set_buzzer(200, 10)
        time.sleep(1)
        set_buzzer(0, 0)
        time.sleep(2)
