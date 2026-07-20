
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

# Configuracion dinámica (actualizada desde Supabase via piggyback)
CFG_TEMP_MIN = 15
CFG_TEMP_MAX = 30
CFG_HUM_AMB_MIN = 30
CFG_HUM_AMB_MAX = 85
CFG_HUM_SUELO_MIN = 40
CFG_HUM_SUELO_MAX = 80
CFG_PH_MIN = 5.5
CFG_PH_MAX = 7.5

# Frecuencia de escritura a Supabase (en ciclos de 0.5s)
# 10 ciclos = 5 segundos, 15 = 7.5s, 20 = 10s, 30 = 15s
DB_SYNC_INTERVAL = 10

# ============================================================
# SENSOR OVERRIDE - Forzado de valores por software
# ============================================================

class SensorOverride:
    """Maneja el forzado de valores de sensores por software.

    Ciclo rapido de 3 fases para feedback visible (total ~21s):
    1. DEGRADING (7s): valor fisico actual -> valor critico (7 pasos x 1s)
    2. HOLDING (2s): se mantiene en valor critico
    3. RECOVERING (12s): critico -> setpoint ideal (12 pasos x 1s)
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
            'valor_fisico_actual': valor_fisico_actual,  # tracking del fisico durante el ciclo
            'valor_critico': valor_forzado,
            'setpoint': setpoint,
            'fase': self.PHASE_DEGRADING,
            'paso': 0,
            'max_pasos_deg': 7,
            'max_pasos_rec': 12,
            'hold_inicio': 0,
            'hold_duracion': 2,
            'paso_intervalo': 1.0,
            'activo': True,
            'ultima_actualizacion': time.time()
        }

        print("[OVERRIDE] MAC-{} {} DEGRAD {} -> {} ({}s)".format(
            maceta, sensor_tipo, valor_fisico_actual, valor_forzado,
            int(7 * 1.0)))
    
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

        # Tracking del valor fisico real durante el ciclo (puede variar)
        if valor_fisico is not None:
            stab['valor_fisico_actual'] = valor_fisico

        now = time.time()
        fase = stab['fase']

        if fase == self.PHASE_DEGRADING:
            elapsed = now - stab['ultima_actualizacion']
            intervalo = stab.get('paso_intervalo', 1.0)
            if elapsed >= intervalo:
                stab['paso'] += 1
                stab['ultima_actualizacion'] = now
                progreso = min(stab['paso'] / stab['max_pasos_deg'], 1.0)
                inicio = stab['valor_fisico_inicio']
                critico = stab['valor_critico']
                valor_nuevo = round(inicio + (critico - inicio) * progreso, 1)
                self.overrides[key]['valor'] = valor_nuevo
                if stab['paso'] % 2 == 0:
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
            intervalo = stab.get('paso_intervalo', 1.0)
            if elapsed >= intervalo:
                stab['paso'] += 1
                stab['ultima_actualizacion'] = now
                progreso = min(stab['paso'] / stab['max_pasos_rec'], 1.0)
                critico = stab['valor_critico']
                # Recuperar al valor FISICO REAL (no al setpoint fijo)
                target = stab.get('valor_fisico_actual', valor_fisico)
                if target is None:
                    target = stab.get('setpoint', critico)
                valor_nuevo = round(critico + (target - critico) * progreso, 1)
                self.overrides[key]['valor'] = valor_nuevo
                if stab['paso'] % 3 == 0:
                    print("[RECOVER] MAC-{} {} {}/{}: {} -> {}".format(
                        maceta, sensor_tipo, stab['paso'], stab['max_pasos_rec'],
                        critico, valor_nuevo))
                if stab['paso'] >= stab['max_pasos_rec']:
                    # Ciclo completo: limpiar override y desactivar alerta en Supabase
                    stab['activo'] = False
                    self.overrides[key]['activa'] = False
                    alerta_id = self.overrides[key].get('alerta_id')
                    print("[DONE] MAC-{} {} completado -> {}".format(maceta, sensor_tipo, target))
                    # Desactivar la fila en Supabase para que no se reinicie el ciclo
                    if alerta_id:
                        try:
                            _http_patch("/api/simulacion/alerta/" + str(alerta_id) + "/desactivar")
                        except Exception:
                            pass
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
        # Se activa cuando humedad del suelo < hum_suelo_min (critico)
        # Se apaga cuando humedad del suelo > hum_suelo_max (recuperacion)
        if hum_suelo is not None:
            if hum_suelo < CFG_HUM_SUELO_MIN:
                if not self.actuadores_estado[maceta].get('bomba'):
                    acciones.append(('bomba', 'ON'))
                    self.actuadores_estado[maceta]['bomba'] = True
                    print("[LAZO] MAC-{} Bomba ON (hum_suelo={})".format(maceta, hum_suelo))
            elif hum_suelo > CFG_HUM_SUELO_MAX:
                if self.actuadores_estado[maceta].get('bomba'):
                    acciones.append(('bomba', 'OFF'))
                    self.actuadores_estado[maceta]['bomba'] = False
                    print("[LAZO] MAC-{} Bomba OFF (hum_suelo={})".format(maceta, hum_suelo))
        
        # === VENTILADOR ===
        # Se activa cuando temp > temp_max o humedad ambiente > hum_amb_max
        # Se apaga cuando temp < (temp_max - 5) y humedad < (hum_amb_max - 10)
        if temp is not None:
            if temp > CFG_TEMP_MAX or (hum_amb is not None and hum_amb > CFG_HUM_AMB_MAX):
                if not self.actuadores_estado[maceta].get('ventilador'):
                    acciones.append(('ventilador', 'ON'))
                    self.actuadores_estado[maceta]['ventilador'] = True
                    print("[LAZO] MAC-{} Ventilador ON (temp={}, hum_amb={})".format(maceta, temp, hum_amb))
            elif temp < (CFG_TEMP_MAX - 5) and (hum_amb is None or hum_amb < (CFG_HUM_AMB_MAX - 10)):
                if self.actuadores_estado[maceta].get('ventilador'):
                    acciones.append(('ventilador', 'OFF'))
                    self.actuadores_estado[maceta]['ventilador'] = False
                    print("[LAZO] MAC-{} Ventilador OFF (temp={})".format(maceta, temp))
        
        # === PULVERIZADOR ===
        # Se activa cuando humedad ambiente < hum_amb_min o temp > temp_max
        # Se apaga cuando humedad ambiente > (hum_amb_min + 30)
        if hum_amb is not None:
            if hum_amb < CFG_HUM_AMB_MIN or (temp is not None and temp > CFG_TEMP_MAX):
                if not self.actuadores_estado[maceta].get('pulverizador'):
                    acciones.append(('pulverizador', 'ON'))
                    self.actuadores_estado[maceta]['pulverizador'] = True
                    print("[LAZO] MAC-{} Pulverizador ON (hum_amb={}, temp={})".format(maceta, hum_amb, temp))
            elif hum_amb > (CFG_HUM_AMB_MIN + 30):
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
    """Conecta a WiFi de forma robusta. Nunca crashea: si todo falla,
    retorna False y el ESP32 sigue operando en modo local.
    """
    try:
        wlan = network.WLAN(network.STA_IF)
    except Exception as e:
        print("[WiFi] No se pudo crear WLAN: {}".format(e))
        return False

    try:
        # Paso 1: apagar interfaz y liberar memoria del driver
        try:
            wlan.active(False)
        except Exception:
            pass
        time.sleep(1)
        gc.collect()

        # Paso 2: encender interfaz
        try:
            wlan.active(True)
            time.sleep(0.5)
        except Exception as e:
            print("[WiFi] active() error: {}".format(e))
            time.sleep(2)

        if wlan.isconnected():
            print("[WiFi] Ya conectado: {}".format(wlan.ifconfig()[0]))
            return True

        # Paso 3: reintentar conectando hasta 5 veces
        delays = [2, 3, 5, 5, 5]
        for intento in range(5):
            try:
                wlan.active(False)
                time.sleep(1)
                gc.collect()
                wlan.active(True)
                time.sleep(1)
            except Exception:
                pass
            try:
                print("[WiFi] Intento {} de 5 - '{}'...".format(intento + 1, WIFI_SSID))
                wlan.connect(WIFI_SSID, WIFI_PASS)
                timeout = 12
                while not wlan.isconnected() and timeout > 0:
                    time.sleep(1)
                    timeout -= 1
                if wlan.isconnected():
                    config = wlan.ifconfig()
                    print("[WiFi] OK IP: {}".format(config[0]))
                    return True
                else:
                    print("[WiFi] Intento {} timeout".format(intento + 1))
            except Exception as e:
                print("[WiFi] Intento {} error: {}".format(intento + 1, e))
            time.sleep(delays[intento])

        print("[WiFi] FAIL despues de 5 intentos")
        return False

    except Exception as e:
        # Captura cualquier RuntimeError 0x0101 u otro error del driver
        print("[WiFi] Error fatal (no fatal): {} - continuando offline".format(e))
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

# ============================================================
# MAPA DE ACTUADORES — ID de Supabase → (maceta, nombre_relay)
# ============================================================
# Cada ESP32 maneja IDs 1-13 (su dispositivo):
#   IDs 1-3: MAC-1 (bomba, ventilador, pulverizador)
#   IDs 4-6: MAC-2
#   IDs 7-9: MAC-3
#   IDs 10-12: MAC-4
#   ID 13: buzzer global
ACTUADOR_MAP = {
    1:  (1, 'bomba'),        2:  (1, 'ventilador'),    3:  (1, 'pulverizador'),
    4:  (2, 'bomba'),        5:  (2, 'ventilador'),    6:  (2, 'pulverizador'),
    7:  (3, 'bomba'),        8:  (3, 'ventilador'),    9:  (3, 'pulverizador'),
    10: (4, 'bomba'),        11: (4, 'ventilador'),    12: (4, 'pulverizador'),
    13: (0, 'buzzer'),
}

def normalize_actuador_name(nombre):
    """Normaliza nombre descriptivo a nombre interno de relay.
    LEGACY: soporta nombres como 'Bomba MAC1' → 'bomba'.
    """
    if not nombre:
        return None
    n = nombre.lower().strip()
    if 'bomba' in n:
        return 'bomba'
    if 'ventilador' in n or 'vent' in n:
        return 'ventilador'
    if 'pulverizador' in n or 'pulv' in n:
        return 'pulverizador'
    if 'buzzer' in n:
        return 'buzzer'
    return None
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
        time.sleep_us(5)
        SR_CLK.value(1)
        time.sleep_us(5)
    SR_LATCH.value(0)
    time.sleep_us(5)
    SR_LATCH.value(1)
    time.sleep_us(5)
    SR_LATCH.value(0)

shift_out_8bits(sr_state)
print("[SR] 74HC595 init OK, state=0b{:08b}".format(sr_state))

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

def leer_mux(canal, samples=5):
    """Lee el MUX promediando N muestras. Descarta la primera (crosstalk).
    Tiempo total: 50ms settle + N*5ms = ~75ms para 5 muestras.
    """
    MUX_S0.value(canal & 1)
    MUX_S1.value((canal >> 1) & 1)
    MUX_S2.value((canal >> 2) & 1)
    MUX_S3.value((canal >> 3) & 1)
    time.sleep_ms(50)
    MUX_SIG.read()
    total = 0
    count = 0
    for _ in range(samples):
        total += MUX_SIG.read()
        count += 1
        time.sleep_ms(5)
    return total // count

# ============================================================
# LECTURA DE SENSORES - 2 modos
# ============================================================
# Modo 1 (estatico): valores fijos por maceta, sin variacion.
# Modo 2 (dinamico): oscilacion progresiva. Cada sensor tiene un
#   valor actual y un target random. Cada ciclo se acerca un paso.
#   Al llegar al target, se genera uno nuevo. Sin saltos bruscos.

import urandom as _urandom

BASELINE_TEMP = 25.0
BASELINE_HUM_AMB = 65.0
BASELINE_HUM_SUELO = {1: 55.0, 2: 58.0, 3: 52.0, 4: 60.0}
BASELINE_PH = {1: 6.8, 2: 6.5, 3: 6.8, 4: 7.2}

SENSOR_MODE = 1

# Estado del modo dinamico (oscilacion progresiva)
_dyn = {
    'temp': {'val': 25.0, 'tgt': 25.0},
    'hum_amb': {'val': 65.0, 'tgt': 65.0},
    'hum_suelo': {1: {'val': 55.0, 'tgt': 55.0}, 2: {'val': 58.0, 'tgt': 58.0},
                  3: {'val': 52.0, 'tgt': 52.0}, 4: {'val': 60.0, 'tgt': 60.0}},
    'ph': {1: {'val': 6.8, 'tgt': 6.8}, 2: {'val': 6.5, 'tgt': 6.5},
           3: {'val': 6.8, 'tgt': 6.8}, 4: {'val': 7.2, 'tgt': 7.2}}
}

# Rangos validos por tipo de sensor
_RANGOS = {
    'temp': (15.0, 30.0),
    'hum_amb': (30.0, 85.0),
    'hum_suelo': (20.0, 90.0),
    'ph': (5.0, 8.0)
}

def _dyn_init():
    """Inicializar estado dinamico con baselines."""
    _dyn['temp'] = {'val': BASELINE_TEMP, 'tgt': BASELINE_TEMP}
    _dyn['hum_amb'] = {'val': BASELINE_HUM_AMB, 'tgt': BASELINE_HUM_AMB}
    _dyn['hum_suelo'] = {}
    _dyn['ph'] = {}
    for m in range(1, 5):
        _dyn['hum_suelo'][m] = {'val': BASELINE_HUM_SUELO[m], 'tgt': BASELINE_HUM_SUELO[m]}
        _dyn['ph'][m] = {'val': BASELINE_PH[m], 'tgt': BASELINE_PH[m]}

def _dyn_random_target(rango):
    """Generar valor random dentro del rango."""
    lo, hi = rango
    return round(lo + (_urandom.getrandbits(16) / 65535.0) * (hi - lo), 1)

def _dyn_step(val, tgt, paso):
    """Mover val hacia tgt por un paso. Retorna nuevo val."""
    diff = tgt - val
    if abs(diff) <= paso:
        return tgt
    if diff > 0:
        return round(val + paso, 1)
    return round(val - paso, 1)

def _dyn_tick():
    """Avanzar un ciclo de oscilacion para todos los sensores (cada 0.5s)."""
    paso_temp = 0.3
    paso_hum = 0.5
    paso_suelo = 0.4
    paso_ph = 0.05

    s = _dyn['temp']
    s['val'] = _dyn_step(s['val'], s['tgt'], paso_temp)
    if abs(s['val'] - s['tgt']) < 0.01:
        s['tgt'] = _dyn_random_target(_RANGOS['temp'])

    s = _dyn['hum_amb']
    s['val'] = _dyn_step(s['val'], s['tgt'], paso_hum)
    if abs(s['val'] - s['tgt']) < 0.01:
        s['tgt'] = _dyn_random_target(_RANGOS['hum_amb'])

    for m in range(1, 5):
        s = _dyn['hum_suelo'][m]
        s['val'] = _dyn_step(s['val'], s['tgt'], paso_suelo)
        if abs(s['val'] - s['tgt']) < 0.01:
            s['tgt'] = _dyn_random_target(_RANGOS['hum_suelo'])

        s = _dyn['ph'][m]
        s['val'] = _dyn_step(s['val'], s['tgt'], paso_ph)
        if abs(s['val'] - s['tgt']) < 0.01:
            s['tgt'] = _dyn_random_target(_RANGOS['ph'])

def _dyn_reset():
    """Reset dinamico a baselines."""
    _dyn_init()

def seleccionar_modo():
    """Menu interactivo en consola para seleccionar modo de operacion."""
    global SENSOR_MODE
    print("")
    print("========================================")
    print("  HUERTO INTELIGENTE - INV-{}".format(MODULE_ID))
    print("========================================")
    print("")
    print("  Seleccione modo de operacion:")
    print("")
    print("  [1] ESTATICO  - Sensores con valores fijos")
    print("                   (sin variacion)")
    print("")
    print("  [2] DINAMICO  - Sensores oscilan suavemente")
    print("                   (progresivo, sin saltos)")
    print("")
    print("========================================")
    try:
        opcion = input("  Ingrese 1 o 2: ").strip()
        if opcion == '2':
            SENSOR_MODE = 2
            _dyn_init()
            print("")
            print("  >> MODO DINAMICO ACTIVADO")
            print("  >> Sensores oscilaran progresivamente")
        else:
            SENSOR_MODE = 1
            print("")
            print("  >> MODO ESTATICO ACTIVADO")
            print("  >> Sensores con valores fijos")
    except Exception:
        SENSOR_MODE = 1
        print("")
        print("  >> Default: MODO ESTATICO")
    print("")
    print("========================================")
    print("")

def leer_dht():
    if SENSOR_MODE == 1:
        return BASELINE_TEMP, BASELINE_HUM_AMB
    return round(_dyn['temp']['val'], 1), round(_dyn['hum_amb']['val'], 1)

def leer_suelo(maceta):
    if SENSOR_MODE == 1:
        return BASELINE_HUM_SUELO.get(maceta, 55.0)
    return round(_dyn['hum_suelo'].get(maceta, {'val': 55.0})['val'], 1)

def leer_ph(maceta):
    if SENSOR_MODE == 1:
        return BASELINE_PH.get(maceta, 7.0)
    return round(_dyn['ph'].get(maceta, {'val': 7.0})['val'], 1)

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
    print("[SR] MAC-{} green={} sr=0b{:08b}".format(maceta, "ON" if activo else "OFF", sr_state))

def set_led_riesgo(maceta, criticos):
    """Actualiza LED rojo de la maceta (bit 4-7) via shift register."""
    global sr_state
    if criticos:
        sr_state |= (1 << (maceta + 3))
    else:
        sr_state &= ~(1 << (maceta + 3))
    shift_out_8bits(sr_state)
    print("[SR] MAC-{} red={} sr=0b{:08b}".format(maceta, "ON" if criticos else "OFF", sr_state))

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

def confirmar_comando(cmd_id, dispositivo_id, resultado, estado_final, mensaje_error=None):
    """Confirma al bridge que un comando fue ejecutado (o falló)."""
    payload = {
        "comando_id": cmd_id,
        "dispositivo_id": dispositivo_id,
        "resultado": resultado,
        "estado_final": estado_final,
    }
    if mensaje_error:
        payload["mensaje_error"] = mensaje_error
    code, body = _http_post("/api/comando/confirmar", payload, timeout=5)
    if code and code < 300:
        print("[CONFIRM] cmd={} -> {}".format(cmd_id, resultado))
    else:
        print("[CONFIRM] ERROR cmd={} code={}".format(cmd_id, code))

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
            code = resp.status_code
            if code == 200:
                data = resp.json()
                resp.close()
                resp = None
                gc.collect()
                return 200, data
            resp.close()
            resp = None
            gc.collect()
            return code, None
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

boot_overrides_cleared = False

def reset_overrides_boot():
    """Llama al Bridge para apagar overrides heredados de sesiones anteriores."""
    global boot_overrides_cleared
    try:
        code, resp = _http_post("/api/simulacion/reset", {"device": MODULE_ID}, timeout=8)
        print("[BOOT-RESET] code={} resp={}".format(code, resp))
    except Exception as e:
        print("[BOOT-RESET] Error: {}".format(e))
    boot_overrides_cleared = True

def sync_with_bridge(lecturas_db, first_boot=False):
    """Piggyback: send sensors AND receive commands + overrides in ONE HTTP call.
    Sends ALL 10 sensors every call (no delta filter) to ensure complete data.
    If first_boot=True, sends reset_overrides=True to invalidate stale overrides
    from previous sessions, and discards any overrides returned in the response.
    """
    global wifi_fail_count, first_sync_done, boot_overrides_cleared

    payload = {"device": MODULE_ID, "pending": True}
    sensors = {}
    for l in lecturas_db:
        sensors[str(l["sensor_id"])] = l["valor"]
    payload["sensors"] = sensors
    payload["ts_origen_sync"] = lecturas_db[0]["ts"] if lecturas_db else time.time()

    if first_boot:
        payload["reset_overrides"] = True
        print("[BOOT] Primer sync — enviando reset_overrides=True al Bridge")

    # Log detallado para diagnóstico
    print("[SYNC] Sending {} sensors to Bridge...".format(len(sensors)))

    code, resp = _http_post("/api/sync", payload, timeout=10)

    if code == 0 or resp is None:
        wifi_fail_count += 1
        print("[SYNC] FAIL code={} resp={} ({})".format(code, resp, wifi_fail_count))
        return False

    wifi_fail_count = 0
    written = resp.get("sensors_written", 0)
    ok = resp.get("ok", False)
    print("[SYNC] code={} ok={} written={} sensors={}".format(code, ok, written, list(sensors.keys())))

    if not ok:
        print("[SYNC] Bridge error: sensors_failed={}".format(resp.get("sensors_failed", 0)))

    # Process commands from response
    commands = resp.get("commands", [])
    for cmd in commands:
        cmd_id = cmd.get("id")
        estado = cmd.get("estado_solicitado", "OFF")
        actuador_id = cmd.get("actuador_id")
        nombre = cmd.get("nombre_actuador", "")
        exito = False

        # FLUJO PRINCIPAL: por actuador_id (ID de Supabase)
        if actuador_id and actuador_id in ACTUADOR_MAP:
            maceta, relay_name = ACTUADOR_MAP[actuador_id]
            if relay_name == 'buzzer':
                set_buzzer(800 if estado == "ON" else 0, 10 if estado == "ON" else 0)
            else:
                set_relay(maceta, relay_name, estado)
            print("[CMD] ID={} {} MAC-{} -> {}".format(actuador_id, relay_name, maceta, estado))
            exito = True
        else:
            # LEGACY: compatibilidad por nombre (temporal)
            relay_name = normalize_actuador_name(nombre)
            if relay_name == 'buzzer':
                set_buzzer(800 if estado == "ON" else 0, 10 if estado == "ON" else 0)
                print("[CMD-LEGACY] {} -> {}".format(nombre, estado))
                exito = True
            elif relay_name:
                pin_str = cmd.get("pin_conexion", "")
                for m in range(1, 5):
                    if pin_str in RELAYS[m]:
                        set_relay(m, relay_name, estado)
                        print("[CMD-LEGACY] {} MAC-{} -> {}".format(nombre, m, estado))
                        exito = True
                        break
                if not exito:
                    print("[CMD-LEGACY] No se encontro pin {} para {}".format(pin_str, nombre))
            else:
                print("[CMD] Actuador desconocido: id={} nombre={}".format(actuador_id, nombre))

        # Confirmar resultado al bridge
        if cmd_id:
            if exito:
                confirmar_comando(cmd_id, MODULE_ID, "OK", estado)
            else:
                confirmar_comando(cmd_id, MODULE_ID, "ERROR", estado, "Actuador no encontrado")

    # Process overrides from response
    # BOOT-SAFE: en el primer sync tras arrancar, ignorar overrides heredados
    # para garantizar que la primera lectura reportada sea 100% fisica.
    overrides = resp.get("overrides", []) if boot_overrides_cleared else []
    if not boot_overrides_cleared:
        print("[SYNC] Primer sync post-boot: overrides ignorados (solo lectura fisica)")
        boot_overrides_cleared = True
    active_keys = set()
    for alerta in overrides:
        maceta = alerta.get("maceta_numero")
        sensor_tipo = alerta.get("sensor_tipo")
        valor_forzado = alerta.get("valor_forzado")
        alerta_id = alerta.get("id")
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
                # Guardar alerta_id para desactivar al terminar el ciclo
                if alerta_id and (maceta, sensor_tipo) in sensor_override.overrides:
                    sensor_override.overrides[(maceta, sensor_tipo)]['alerta_id'] = alerta_id
    for key in list(sensor_override.overrides.keys()):
        if key not in active_keys:
            sensor_override._clear_override(key[0], key[1])

    # Update dynamic config from response
    cfg = resp.get("config", {})
    if cfg:
        global CFG_TEMP_MIN, CFG_TEMP_MAX, CFG_HUM_AMB_MIN, CFG_HUM_AMB_MAX
        global CFG_HUM_SUELO_MIN, CFG_HUM_SUELO_MAX, CFG_PH_MIN, CFG_PH_MAX
        CFG_TEMP_MIN = cfg.get("temp_min", CFG_TEMP_MIN)
        CFG_TEMP_MAX = cfg.get("temp_max", CFG_TEMP_MAX)
        CFG_HUM_AMB_MIN = cfg.get("hum_amb_min", CFG_HUM_AMB_MIN)
        CFG_HUM_AMB_MAX = cfg.get("hum_amb_max", CFG_HUM_AMB_MAX)
        CFG_HUM_SUELO_MIN = cfg.get("hum_suelo_min", CFG_HUM_SUELO_MIN)
        CFG_HUM_SUELO_MAX = cfg.get("hum_suelo_max", CFG_HUM_SUELO_MAX)
        CFG_PH_MIN = cfg.get("ph_min", CFG_PH_MIN)
        CFG_PH_MAX = cfg.get("ph_max", CFG_PH_MAX)
        print("[CFG] Temp:{}-{} HumAmb:{}-{} HumSuelo:{}-{} Ph:{}-{}".format(
            CFG_TEMP_MIN, CFG_TEMP_MAX, CFG_HUM_AMB_MIN, CFG_HUM_AMB_MAX,
            CFG_HUM_SUELO_MIN, CFG_HUM_SUELO_MAX, CFG_PH_MIN, CFG_PH_MAX))

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
        if temp > CFG_TEMP_MAX or temp < CFG_TEMP_MIN:
            critico = True
        elif temp > (CFG_TEMP_MAX - 5) or temp < (CFG_TEMP_MIN + 5):
            alerta = True

    if hum_suelo is not None:
        if hum_suelo < CFG_HUM_SUELO_MIN:
            critico = True
        elif hum_suelo < (CFG_HUM_SUELO_MIN + 10) or hum_suelo > (CFG_HUM_SUELO_MAX):
            alerta = True

    if hum_amb is not None:
        if hum_amb > CFG_HUM_AMB_MAX or hum_amb < CFG_HUM_AMB_MIN:
            critico = True

    if ph is not None:
        if ph < CFG_PH_MIN or ph > CFG_PH_MAX:
            critico = True
        elif ph < (CFG_PH_MIN + 1) or ph > (CFG_PH_MAX - 1):
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

# Conectar WiFi primero (no fatal si falla, el ESP32 sigue operando)
try:
    wifi_ok = connect_wifi()
except Exception as e:
    print("[BOOT] WiFi fallo no-fatal: {}".format(e))
    wifi_ok = False

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
first_sync_done = False

if wifi_ok:
    reset_overrides_boot()

print("=== ESP32 INV-{} INICIADO ===".format(MODULE_ID))
print("[CFG] Defaults: Temp:{}-{} HumAmb:{}-{} HumSuelo:{}-{} Ph:{}-{}".format(
    CFG_TEMP_MIN, CFG_TEMP_MAX, CFG_HUM_AMB_MIN, CFG_HUM_AMB_MAX,
    CFG_HUM_SUELO_MIN, CFG_HUM_SUELO_MAX, CFG_PH_MIN, CFG_PH_MAX))
print("[CFG] DB sync cada {}s ({} ciclos)".format(DB_SYNC_INTERVAL * 0.5, DB_SYNC_INTERVAL))

seleccionar_modo()

while True:
    try:
        gc.collect()
        lecturas_db = []
        sync_ts_origen = time.time()

        if SENSOR_MODE == 2:
            _dyn_tick()

        temp_fisico, hum_amb_fisico = leer_dht()
        temp = sensor_override.get_valor(0, 'temp', temp_fisico)
        hum_amb = sensor_override.get_valor(0, 'hum_amb', hum_amb_fisico)

        base_shared = (MODULE_ID - 1) * 10
        lecturas_db.append({"sensor_id": base_shared, "valor": temp, "ts": sync_ts_origen})
        lecturas_db.append({"sensor_id": base_shared + 1, "valor": hum_amb, "ts": sync_ts_origen})

        last_lecturas[0] = {'temp': temp, 'hum_amb': hum_amb}

        for m in range(1, 5):
            hum_suelo_fisico = leer_suelo(m)
            ph_fisico = leer_ph(m)
            
            hum_suelo = sensor_override.get_valor(m, 'hum_suelo', hum_suelo_fisico)
            ph = sensor_override.get_valor(m, 'ph', ph_fisico)
            
            base_mac = base_shared + 2 + (m - 1) * 2
            if hum_suelo is not None:
                lecturas_db.append({"sensor_id": base_mac, "valor": hum_suelo, "ts": sync_ts_origen})
            if ph is not None:
                lecturas_db.append({"sensor_id": base_mac + 1, "valor": ph, "ts": sync_ts_origen})

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
            try:
                wlan.active(False)
                time.sleep(1)
                gc.collect()
                wlan.active(True)
                time.sleep(1)
            except Exception:
                pass
            wifi_ok = connect_wifi()
        
        gc.collect()
        if wifi_ok:
            sync_counter += 1
            if sync_counter >= DB_SYNC_INTERVAL:
                sync_counter = 0
                if not first_sync_done:
                    sync_with_bridge(lecturas_db, first_boot=True)
                else:
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
