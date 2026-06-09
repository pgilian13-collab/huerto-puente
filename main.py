
from machine import Pin, I2C, ADC, PWM
import ssd1306
import time
import dht
import json

try:
    import urequests as requests
except ImportError:
    import requests

# ============================================================
# CONFIGURACION DEL MODULO (Cambiar 1-5 segun invernadero)
# ============================================================
MODULE_ID = 1
BRIDGE_URL = "https://huerto-puente.onrender.com"

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
DHT_PINS = [Pin(4), Pin(19), Pin(2), Pin(9)]
dht_sensors = [dht.DHT22(p) for p in DHT_PINS]

# Relays - 3 por maceta + buzzer
RELAYS = {
    1: {'bomba': Pin(13, Pin.OUT), 'ventilador': Pin(14, Pin.OUT), 'pulverizador': Pin(5, Pin.OUT)},
    2: {'bomba': Pin(23, Pin.OUT), 'ventilador': Pin(0, Pin.OUT),  'pulverizador': Pin(15, Pin.OUT)},
    3: {'bomba': Pin(12, Pin.OUT), 'ventilador': Pin(11, Pin.OUT), 'pulverizador': Pin(10, Pin.OUT)},
    4: {'bomba': Pin(8, Pin.OUT),  'ventilador': Pin(7, Pin.OUT),  'pulverizador': Pin(6, Pin.OUT)},
}
buzzer = PWM(Pin(26), Pin.OUT)

# LEDs status
led_naranja = Pin(32, Pin.OUT)
led_amarillo = Pin(33, Pin.OUT)
led_verde = Pin(25, Pin.OUT)

# OLED
i2c = I2C(0, scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

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
    pct = int((avg - 2165) / (3135 - 2165) * 100)
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

def set_buzzer(freq, duty):
    if freq > 0:
        buzzer.init(freq=freq, duty=duty)
    else:
        buzzer.init(freq=1, duty=0)

# ============================================================
# FUNCIONES COMUNICACION
# ============================================================

def enviar_lecturas(lecturas):
    payload = {
        "dispositivo_id": MODULE_ID,
        "lecturas": lecturas
    }
    try:
        resp = requests.post(
            f"{BRIDGE_URL}/api/lecturas",
            json=payload,
            timeout=10
        )
        print("[ENV] Status: {}".format(resp.status_code))
        return resp.status_code in (200, 201)
    except Exception as e:
        print("[ENV] Error: {}".format(e))
        return False

def recibir_comandos():
    try:
        resp = requests.get(
            f"{BRIDGE_URL}/api/comandos/{MODULE_ID}",
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

                requests.patch(
                    f"{BRIDGE_URL}/api/comando/{cmd_id}/ejecutado",
                    timeout=5
                )
                print("[CMD] {} -> {}".format(nombre, estado))
            return comandos
    except Exception as e:
        print("[CMD] Error: {}".format(e))
    return []

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

oled.fill(0)
oled.text("INV-{} ONLINE".format(MODULE_ID), 0, 20)
oled.text("Iniciando...", 0, 40)
oled.show()
time.sleep(2)

oled_mac = 1
oled_timer = 0
last_lecturas = {}

print("=== ESP32 INV-{} INICIADO ===".format(MODULE_ID))

while True:
    try:
        lecturas_db = []

        for m in range(1, 5):
            temp, hum_amb = leer_dht(m)
            hum_suelo = leer_suelo(m)
            ph = leer_ph(m)

            base_id = (MODULE_ID - 1) * 16 + (m - 1) * 4

            lecturas_db.append({"sensor_id": base_id + 1, "valor": temp if temp is not None else 0})
            lecturas_db.append({"sensor_id": base_id + 2, "valor": hum_amb if hum_amb is not None else 0})
            lecturas_db.append({"sensor_id": base_id + 3, "valor": hum_suelo})
            lecturas_db.append({"sensor_id": base_id + 4, "valor": ph})

            last_lecturas[m] = {
                'temp': temp, 'hum_amb': hum_amb,
                'hum_suelo': hum_suelo, 'ph': ph
            }

            critico, alerta = evaluar_alertas(last_lecturas[m])

            print("--- MAC-{} ---".format(m))
            print("  Temp:{}C  HumAmb:{}%".format(temp, hum_amb))
            print("  Suelo:{}%  pH:{}".format(hum_suelo, ph))

        enviar_lecturas(lecturas_db)
        recibir_comandos()

        oled_timer += 1
        if oled_timer >= 3:
            oled_timer = 0
            actualizar_oled(oled_mac, last_lecturas.get(oled_mac, {}))
            oled_mac += 1
            if oled_mac > 4:
                oled_mac = 1

        time.sleep(2)

    except Exception as e:
        print("[ERROR] {}".format(e))
        set_buzzer(200, 10)
        time.sleep(1)
        set_buzzer(0, 0)
        time.sleep(2)
