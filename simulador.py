"""
SIMULADOR DE DATOS - HUERTO UNIVERSITARIO
==========================================
Simula el envio de datos del ESP32 al bridge (Supabase) en tiempo real.
Ejecutar mientras Wokwi simula el ESP32.

Uso:
  pip install requests
  python simulador.py

El ESP32 en Wokwi maneja: sensores, OLED, actuadores, alertas
Este script envia: datos de sensores a Supabase via bridge
"""

import requests
import time
import random
import json
from datetime import datetime, timezone, timedelta

# ============================================================
# CONFIGURACION
# ============================================================

BRIDGE_URL = "https://huerto-puente.onrender.com"
MODULE_ID = 1  # Cambiar 1-5 segun invernadero en Wokwi
INTERVALO = 5  # Segundos entre envios

# Valores base por modulo (simulan condiciones reales)
MODULOS = {
    1: {"temp": 22.5, "humAmb": 65.0, "humSuelo": 55.0, "ph": 6.5},
    2: {"temp": 21.0, "humAmb": 70.0, "humSuelo": 48.0, "ph": 6.8},
    3: {"temp": 23.5, "humAmb": 60.0, "humSuelo": 62.0, "ph": 6.2},
    4: {"temp": 20.0, "humAmb": 72.0, "humSuelo": 45.0, "ph": 7.0},
    5: {"temp": 22.0, "humAmb": 68.0, "humSuelo": 58.0, "ph": 6.4},
}

# ============================================================
# FUNCIONES
# ============================================================

def generar_lecturas(modulo_id):
    """Genera 16 lecturas (4 macetas x 4 sensores) con variacion realista"""
    base = MODULOS[modulo_id]
    lecturas = []
    tz = timezone(timedelta(hours=-5))  # Peru UTC-5
    ahora = datetime.now(tz)

    for mac in range(1, 5):
        base_id = (modulo_id - 1) * 16 + (mac - 1) * 4

        # Variacion por maceta (cada maceta tiene micro-clima diferente)
        factor_mac = (mac - 1) * 0.5

        # Temperatura: base + variacion maceta + ruido
        temp = base["temp"] + factor_mac + random.uniform(-1.5, 1.5)
        temp = round(max(10.0, min(45.0, temp)), 1)

        # Humedad ambiente: inversamente proporcional a temperatura
        hum_amb = base["humAmb"] - factor_mac + random.uniform(-3.0, 3.0)
        hum_amb = round(max(15.0, min(95.0, hum_amb)), 1)

        # Humedad suelo: variacion por maceta + ruido
        hum_suelo = base["humSuelo"] + factor_mac + random.uniform(-5.0, 5.0)
        hum_suelo = round(max(0.0, min(100.0, hum_suelo)), 1)

        # pH: estable con pequena variacion
        ph = base["ph"] + (factor_mac * 0.1) + random.uniform(-0.3, 0.3)
        ph = round(max(3.0, min(11.0, ph)), 2)

        lecturas.append({"sensor_id": base_id + 1, "valor": temp})
        lecturas.append({"sensor_id": base_id + 2, "valor": hum_amb})
        lecturas.append({"sensor_id": base_id + 3, "valor": hum_suelo})
        lecturas.append({"sensor_id": base_id + 4, "valor": ph})

    return lecturas


def enviar Datos(modulo_id, lecturas):
    """Envia lecturas al bridge"""
    payload = {
        "dispositivo_id": modulo_id,
        "lecturas": lecturas
    }
    try:
        resp = requests.post(
            "{}/api/lecturas".format(BRIDGE_URL),
            json=payload,
            timeout=30
        )
        if resp.status_code in (200, 201):
            return True
        else:
            print("[ERROR] Bridge respondio: {}".format(resp.status_code))
            return False
    except requests.exceptions.ConnectionError:
        print("[ERROR] No se pudo conectar al bridge en {}".format(BRIDGE_URL))
        return False
    except Exception as e:
        print("[ERROR] {}".format(e))
        return False


def verificar_bridge():
    """Verifica que el bridge este activo"""
    try:
        resp = requests.get("{}/health".format(BRIDGE_URL), timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            supabase = data.get("supabase", "unknown")
            print("[BRIDGE] Activo - Supabase: {}".format(supabase))
            return True
        else:
            print("[BRIDGE] Error: {}".format(resp.status_code))
            return False
    except Exception as e:
        print("[BRIDGE] No disponible: {}".format(e))
        return False


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("=" * 50)
    print("  HUERTO UNIVERSITARIO - SIMULADOR DE DATOS")
    print("  Modulo: INV-{:02d}".format(MODULE_ID))
    print("  Bridge: {}".format(BRIDGE_URL))
    print("  Intervalo: {}s".format(INTERVALO))
    print("=" * 50)

    # Verificar bridge
    print("\n[INIT] Verificando bridge...")
    if not verificar_bridge():
        print("[INIT] ERROR: Bridge no disponible. Verifica que este corriendo.")
        print("[INIT] Ejecuta: cd puente_supabase && uvicorn main:app --port 8000")
        exit(1)

    print("[INIT] Bridge OK. Iniciando envio de datos...\n")

    envios_ok = 0
    envios_fail = 0

    while True:
        try:
            lecturas = generar_lecturas(MODULE_ID)

            # Mostrar resumen
            temp_avg = sum(l["valor"] for l in lecturas if l["sensor_id"] % 4 == 1) / 4
            hum_avg = sum(l["valor"] for l in lecturas if l["sensor_id"] % 4 == 3) / 4
            print("[DATOS] Temp: {:.1f}C | HumSuelo: {:.1f}% | {} lecturas".format(
                temp_avg, hum_avg, len(lecturas)))

            if enviar Datos(MODULE_ID, lecturas):
                envios_ok += 1
                print("[ENV] OK (total: {})".format(envios_ok))
            else:
                envios_fail += 1
                print("[ENV] FAIL (fallos: {})".format(envios_fail))

            time.sleep(INTERVALO)

        except KeyboardInterrupt:
            print("\n[STOP] Detenido por el usuario")
            print("[STATS] Enviados: {} | Fallos: {}".format(envios_ok, envios_fail))
            break
        except Exception as e:
            print("[ERROR] {}".format(e))
            time.sleep(INTERVALO)
