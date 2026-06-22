
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
    
    timeout = 15
    while not wlan.isconnected() and timeout > 0:
        time.sleep(1)
        timeout -= 1
    
    if wlan.isconnected():
        config = wlan.ifconfig()
        print("[WiFi] OK IP: {}".format(config[0]))
        return True
    else:
        print("[WiFi] FAIL")
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

# DHT22 - 1 compartido para todo el invernadero
DHT_PIN = Pin(4)
dht_sensor = dht.DHT22(DHT_PIN)

# Relays - 3 por maceta + buzzer
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

# LEDs por maceta via 74HC595 shift register
# Q0-Q3: verde por maceta (relay activo)
# Q4-Q7: rojo por maceta (condicion critica)
SR_DATA = Pin(2, Pin.OUT)
SR_CLK = Pin(3, Pin.OUT)
SR_LATCH = Pin(19, Pin.OUT)
sr_state = 0b00000000

def shift_out_8bits(value):
    """Shift 8 bits to 74HC595 (MSB first)."""
    SR_LATCH.value(0)
    for i in range(7, -1, -1):
        SR_CLK.value(0)
        SR_DATA.value((value >> i) & 1)
        SR_CLK.value(1)
    SR_LATCH.value(0)
    SR_LATCH.value(1)
    SR_LATCH.value(0)

# OLED
oled = None
try:
    i2c = I2C(0, scl=Pin(22), sda=Pin(21))
    devices = i2c.scan()
    if devices:
        oled = ssd1306.SSD1306_I2C(128, 64, i2c)
        print("[OLED] OK en I2C {}".format(devices))
    else:
        print("[OLED] No hay dispositivos I2C")
except Exception as e:
    print("[OLED] ERROR I2C: {}".format(e))
    oled = None

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
    time.sleep_ms(20)
    return MUX_SIG.read()

def leer_suelo(maceta):
    raw = leer_mux(SOIL_CH[maceta - 1])
    if raw < 200 or raw > 3800:
        return None
    pct = int((raw - 1000) / (3500 - 1000) * 100)
    return max(0, min(pct, 100))

def leer_ph(maceta):
    raw = leer_mux(PH_CH[maceta - 1])
    if raw < 200 or raw > 3800:
        return None
    vadc = raw / 4095 * 3.3
    vph = vadc / 0.6
    ph = (4.2 - vph) / 0.3
    return max(0.0, min(round(ph, 2), 14.0))

def leer_dht():
    for _ in range(3):
        try:
            dht_sensor.measure()
            t = dht_sensor.temperature()
            h = dht_sensor.humidity()
            if t is not None and h is not None:
                return t, h
        except:
            pass
        time.sleep_ms(200)
    return 25.0, 65.0
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
    actualizar_led_maceta(maceta)

def actualizar_led_maceta(maceta):
    """Actualiza LED verde de la maceta via shift register."""
    global sr_state
    activo = any(RELAYS[maceta][n].value() for n in ['bomba', 'ventilador', 'pulverizador'])
    if activo:
        sr_state |= (1 << (maceta - 1))
    else:
        sr_state &= ~(1 << (maceta - 1))
    shift_out_8bits(sr_state)

def set_led_riesgo(maceta, criticos):
    """Actualiza LED rojo de la maceta (bit 4-7) via shift register."""
    global sr_state
    if criticos:
        sr_state |= (1 << (maceta + 3))
    else:
        sr_state &= ~(1 << (maceta + 3))
    shift_out_8bits(sr_state)

def set_buzzer(freq, duty):
    if freq > 0:
        buzzer.init(freq=freq, duty=duty)
    else:
        buzzer.init(freq=1, duty=0)

def ejecutar_acciones_lazo(maceta, acciones):
    """Ejecuta acciones del lazo cerrado en los relays."""
    for nombre, estado in acciones:
        set_relay(maceta, nombre, estado)
        print("[LAZO] MAC-{} {} -> {}".format(maceta, nombre, estado))

# ============================================================
# FUNCIONES COMUNICACION - HTTP CLIENT REUTILIZABLE
# ============================================================

wifi_fail_count = 0

def _http_post(path, data, timeout=10):
    """POST con retry. Retorna (status_code, json_dict) o (0, None) si fallo."""
    gc.collect()
    resp = None
    for intento in range(2):
        try:
            resp = requests.post(
                "{}{}".format(BRIDGE_URL, path),
                json=data,
                headers={"X-Bridge-Key": BRIDGE_KEY, "Content-Type": "application/json"},
                timeout=timeout
            )
            code = resp.status_code
            try:
                body = resp.json()
            except:
                body = None
            resp.close()
            resp = None
            gc.collect()
            return code, body
        except Exception as e:
            print("[HTTP] POST {} intento{}: {}".format(path, intento, e))
            if resp:
                resp.close()
                resp = None
            gc.collect()
            if intento == 0:
                time.sleep(0.5)
    return 0, None

def _http_get(path, timeout=8):
    """GET con retry. Retorna (status_code, json_dict) o (0, None)."""
    gc.collect()
    resp = None
    for intento in range(2):
        try:
            resp = requests.get(
                "{}{}".format(BRIDGE_URL, path),
                headers={"X-Bridge-Key": BRIDGE_KEY},
                timeout=timeout
            )
            if resp.status_code == 200:
                data = resp.json()
                resp.close()
                resp = None
                gc.collect()
                return 200, data
            resp.close()
            resp = None
            gc.collect()
            return resp.status_code, None
        except Exception as e:
            print("[HTTP] GET {} intento{}: {}".format(path, intento, e))
            if resp:
                resp.close()
                resp = None
            gc.collect()
            if intento == 0:
                time.sleep(0.5)
    return 0, None

def _http_patch(path, timeout=8):
    """PATCH con retry silencioso."""
    gc.collect()
    resp = None
    try:
        resp = requests.patch(
            "{}{}".format(BRIDGE_URL, path),
            headers={"X-Bridge-Key": BRIDGE_KEY},
            timeout=timeout
        )
        code = resp.status_code
        resp.close()
        resp = None
        gc.collect()
        return code
    except:
        if resp:
            resp.close()
        gc.collect()
        return 0

def sync_with_bridge(lecturas_db):
    """Piggyback: send sensors AND receive commands + overrides in ONE HTTP call.
    Sends ALL 10 sensors every call (no delta filter) to ensure complete data.
    """
    global wifi_fail_count

    payload = {"device": MODULE_ID, "pending": True}
    sensors = {}
    for l in lecturas_db:
        sensors[str(l["sensor_id"])] = l["valor"]
    payload["sensors"] = sensors
    code, resp = _http_post("/api/sync", payload, timeout=10)

    if code == 0 or resp is None:
        wifi_fail_count += 1
        print("[SYNC] FAIL ({})".format(wifi_fail_count))
        return False

    wifi_fail_count = 0
    written = resp.get("sensors_written", 0)
    print("[SYNC] {} sensors sent, code={}".format(written, code))

    # Process commands from response
    commands = resp.get("commands", [])
    for cmd in commands:
        cmd_id = cmd.get("id")
        pin_str = cmd.get("pin_conexion", "")
        estado = cmd.get("estado_solicitado", "OFF")
        nombre = cmd.get("nombre_actuador", "")
        if nombre == "buzzer":
            set_buzzer(800 if estado == "ON" else 0, 10 if estado == "ON" else 0)
        else:
            for m in range(1, 5):
                if pin_str in RELAYS[m]:
                    set_relay(m, nombre, estado)
                    break
        print("[CMD] {} -> {}".format(nombre, estado))

    # Process overrides from response
    overrides = resp.get("overrides", [])
    active_keys = set()
    for alerta in overrides:
        maceta = alerta.get("maceta_numero")
        sensor_tipo = alerta.get("sensor_tipo")
        valor_forzado = alerta.get("valor_forzado")
        if maceta is not None and sensor_tipo and valor_forzado is not None:
            active_keys.add((maceta, sensor_tipo))
            if not sensor_override.tiene_override(maceta, sensor_tipo):
                valor_fisico = float(valor_forzado)
                if last_lecturas.get(maceta):
                    vf = last_lecturas[maceta].get(sensor_tipo)
                    if vf is not None:
                        valor_fisico = float(vf)
                sensor_override.set_override(
                    maceta, sensor_tipo, float(valor_forzado), valor_fisico)
    for key in list(sensor_override.overrides.keys()):
        if key not in active_keys:
            sensor_override._clear_override(key[0], key[1])

    # Cleanup if needed
    if resp.get("cleanup"):
        _http_post("/api/simulacion/cleanup", {}, timeout=8)

    return True


def llamar_heartbeat():
    """Keep-alive para evitar que Render se duerma."""
    code, _ = _http_get("/ping", timeout=8)
    if code == 200:
        print("[HB] OK")
    else:
        print("[HB] FAIL {}".format(code))

# ============================================================
# OLED - MULTIPLES PAGINAS
# ============================================================
# Pagina 0-3: MAC-1 a MAC-4 (sensores + relays)
# Pagina 4:   Estado del sistema

def oled_pagina_maceta(maceta_num, datos):
    """Muestra sensores y relays de una maceta."""
    if not oled:
        return
    oled.fill(0)
    mstr = str(maceta_num) if maceta_num >= 10 else '0' + str(maceta_num)
    oled.text("INV-{} MAC-{}".format(MODULE_ID, mstr), 0, 0)
    oled.text("----------------", 0, 10)

    temp_str = str(int(datos['temp'])) if datos.get('temp') is not None else "--"
    hum_str = str(int(datos['hum_amb'])) if datos.get('hum_amb') is not None else "--"
    oled.text("T:{}C H:{}%".format(temp_str, hum_str), 0, 22)

    s_str = str(int(datos['hum_suelo'])) if datos.get('hum_suelo') is not None else "--"
    oled.text("Suelo: {}%".format(s_str), 0, 36)

    p_str = str(datos['ph']) if datos.get('ph') is not None else "--"
    oled.text("pH: {}".format(p_str), 0, 48)

    r = RELAYS[maceta_num]
    b = "ON" if r['bomba'].value() else "OFF"
    v = "ON" if r['ventilador'].value() else "OFF"
    p = "ON" if r['pulverizador'].value() else "OFF"
    oled.text("B:{} V:{} P:{}".format(b, v, p), 0, 56)

    oled.show()

def oled_pagina_sistema():
    """Muestra estado del sistema."""
    if not oled:
        return
    oled.fill(0)
    oled.text("=== SISTEMA ===", 0, 0)
    oled.text("----------------", 0, 10)

    oled.text("Modulo: INV-{}".format(MODULE_ID), 0, 22)

    wlan = network.WLAN(network.STA_IF)
    if wlan.isconnected():
        ip = wlan.ifconfig()[0]
        oled.text("WiFi: OK", 0, 36)
        oled.text("IP: {}".format(ip[:12]), 0, 46)
    else:
        oled.text("WiFi: DESCONECTADO", 0, 36)

    oled.show()

# ============================================================
# LOGICA ALERTAS
# ============================================================

def evaluar_alertas(datos, maceta_num=None):
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

    if maceta_num is not None:
        set_led_riesgo(maceta_num, critico)

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

if oled:
    oled.fill(0)
    if wifi_ok:
        oled.text("WiFi: OK", 0, 0)
    else:
        oled.text("WiFi: FAIL", 0, 0)
    oled.text("INV-{} ONLINE".format(MODULE_ID), 0, 16)
    oled.text("Iniciando...", 0, 32)
    oled.show()
time.sleep(2)

oled_page = 1
oled_timer = 0
last_lecturas = {}
heartbeat_timer = 0
sync_counter = 0

print("=== ESP32 INV-{} INICIADO ===".format(MODULE_ID))
print("=== MODO HIBRIDO ACTIVADO ===")

while True:
    try:
        gc.collect()
        lecturas_db = []

        temp_fisico, hum_amb_fisico = leer_dht()
        temp = sensor_override.get_valor(0, 'temp', temp_fisico)
        hum_amb = sensor_override.get_valor(0, 'hum_amb', hum_amb_fisico)

        base_shared = (MODULE_ID - 1) * 10
        lecturas_db.append({"sensor_id": base_shared, "valor": temp})
        lecturas_db.append({"sensor_id": base_shared + 1, "valor": hum_amb})

        last_lecturas[0] = {'temp': temp, 'hum_amb': hum_amb}

        for m in range(1, 5):
            hum_suelo_fisico = leer_suelo(m)
            ph_fisico = leer_ph(m)
            
            hum_suelo = sensor_override.get_valor(m, 'hum_suelo', hum_suelo_fisico)
            ph = sensor_override.get_valor(m, 'ph', ph_fisico)
            
            base_mac = base_shared + 2 + (m - 1) * 2
            if hum_suelo is not None:
                lecturas_db.append({"sensor_id": base_mac, "valor": hum_suelo})
            if ph is not None:
                lecturas_db.append({"sensor_id": base_mac + 1, "valor": ph})

            last_lecturas[m] = {
                'temp': temp, 'hum_amb': hum_amb,
                'hum_suelo': hum_suelo, 'ph': ph
            }

            critico, alerta = evaluar_alertas(last_lecturas[m], m)
            
            acciones = lazo_cerrado.evaluar(m, last_lecturas[m])
            if acciones:
                ejecutar_acciones_lazo(m, acciones)

            override_activo = (sensor_override.tiene_override(m, 'hum_suelo') or
                             sensor_override.tiene_override(m, 'ph'))
            override_shared = (sensor_override.tiene_override(0, 'temp') or
                             sensor_override.tiene_override(0, 'hum_amb'))
            
            if override_activo or override_shared:
                print("MAC-{} [OVR] T:{} H:{} S:{} P:{}".format(m, temp, hum_amb, hum_suelo, ph))
            else:
                print("MAC-{} T:{} H:{} S:{} P:{}".format(m, temp, hum_amb, hum_suelo, ph))

        wlan = network.WLAN(network.STA_IF)
        if not wlan.isconnected():
            print("[WiFi] Reconectando...")
            wifi_ok = connect_wifi()
        
        gc.collect()
        if wifi_ok:
            sync_counter += 1
            if sync_counter >= 14:
                sync_counter = 0
                sync_with_bridge(lecturas_db)

            heartbeat_timer += 1
            if heartbeat_timer >= 20:
                heartbeat_timer = 0
                llamar_heartbeat()
        else:
            print("[SKIP] Sin WiFi")

        oled_timer += 1
        if oled_timer >= 6:
            oled_timer = 0
            if oled_page <= 4:
                oled_pagina_maceta(oled_page, last_lecturas.get(oled_page, {}))
            else:
                oled_pagina_sistema()
            oled_page += 1
            if oled_page > 5:
                oled_page = 1

        time.sleep(0.5)

    except Exception as e:
        print("[ERROR] {}".format(e))
        set_buzzer(200, 10)
        time.sleep(1)
        set_buzzer(0, 0)
        time.sleep(2)
