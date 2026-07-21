"""
Puente Supabase - FastAPI Server
=================================
Recibe datos del ESP32 (Wokwi) y los sincroniza con Supabase.
Escucha cambios en Supabase Realtime y reenvia comandos al ESP32.
Envia datos a Cisco Packet Tracer via TCP/UDP.

Uso:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"""

import os
import json
import asyncio
import socket
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# Directorio del frontend
# En Render: sirve desde static/ (synced desde frontend/)
# En local: sirve desde ../frontend/ directamente
_base = os.path.dirname(os.path.abspath(__file__))
_frontend_candidate = os.path.join(_base, "..", "frontend")
if os.path.isdir(_frontend_candidate):
    FRONTEND_DIR = _frontend_candidate
else:
    FRONTEND_DIR = os.path.join(_base, "static")

# ============================================================
# CONFIGURACION
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
BRIDGE_SECRET_KEY = os.getenv("BRIDGE_SECRET_KEY", "")

PERENUAL_KEY = os.getenv("PERENUAL_KEY", "")
TREFLE_TOKEN = os.getenv("TREFLE_TOKEN", "")

PT_HOST = "127.0.0.1"
PT_PORT = 5000

HEADERS_ANON = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
}

HEADERS_SERVICE = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

# ============================================================
# API KEY VERIFICATION
# ============================================================

async def verify_bridge_key(x_bridge_key: str = Header(None)):
    if BRIDGE_SECRET_KEY and x_bridge_key != BRIDGE_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid bridge key")

# ============================================================
# APP LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 50)
    print("  PUENTE SUPABASE - INICIADO")
    print(f"  Supabase: {SUPABASE_URL}")
    print(f"  Packet Tracer: {PT_HOST}:{PT_PORT}")
    print(f"  Security: {'API key active' if BRIDGE_SECRET_KEY else 'NO API KEY SET'}")
    print(f"  Almacenamiento: INSERT monitoreo_lecturas (frontend compatible)")
    print("=" * 50)
    yield
    await client.aclose()
    print("Puente detenido.")

app = FastAPI(title="Puente Supabase", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "https://huerto-puente.onrender.com",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# CLIENTE HTTP ASINCRONO
# ============================================================

client = httpx.AsyncClient(timeout=30.0)

# ============================================================
# ENDPOINTS PARA ESP32
# ============================================================

@app.post("/api/lecturas", dependencies=[Depends(verify_bridge_key)])
async def recibir_todas_lecturas(data: dict):
    """Recibe todas las lecturas de un ESP32 de una vez"""
    dispositivo_id = data.get("dispositivo_id", 1)
    lecturas = data.get("lecturas", [])

    resultados = []
    for lectura in lecturas:
        payload = {
            "sensor_id": lectura["sensor_id"],
            "valor_lectura": round(float(lectura["valor"]), 2),
        }
        try:
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/monitoreo_lecturas",
                json=payload,
                headers=HEADERS_SERVICE,
            )
            resultados.append({
                "sensor_id": lectura["sensor_id"],
                "status": resp.status_code
            })
        except Exception as e:
            resultados.append({
                "sensor_id": lectura["sensor_id"],
                "status": "error",
                "detail": str(e)
            })

    return {"status": "ok", "resultados": resultados}


@app.post("/api/sync", dependencies=[Depends(verify_bridge_key)])
async def sync_device(data: dict):
    """Piggyback endpoint: ESP32 sends sensors AND receives commands + overrides in one call.
    This replaces the need for 4 separate HTTP calls per cycle:
    - POST /api/lecturas (write sensors)
    - GET  /api/comandos/{id} (get pending commands)
    - PATCH /api/comando/{id}/ejecutado (ack each command)
    - GET  /api/simulacion/overrides/{id} (get active overrides)

    Request:  {device: 1, sensors: {0: 25.3, 1: 65.1, ...}, pending: true}
    Response: {commands: [...], overrides: [...], cleanup: bool}
    """
    device_id = data.get("device", data.get("dispositivo_id", 1))
    sensors = data.get("sensors", {})
    pending = data.get("pending", False)
    ts_origen_sync = data.get("ts_origen_sync", 0)

    # Medir latencia: cuanto tarda el dato desde ESP32 hasta el bridge
    ts_received = time.time()
    if ts_origen_sync and ts_origen_sync > 0:
        latency_esp32_to_bridge_ms = int((ts_received - ts_origen_sync) * 1000)
        print(f"[LATENCY] ESP32->Bridge: {latency_esp32_to_bridge_ms}ms (device={device_id})")
    reset_overrides = data.get("reset_overrides", False)

    sensors_ok = 0
    sensors_failed = 0

    # 0) If first boot, deactivate any stale overrides from previous sessions
    if reset_overrides and pending:
        try:
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/simulacion_alertas?dispositivo_id=eq.{device_id}&activa=eq.true",
                json={"activa": False},
                headers={**HEADERS_SERVICE, "Prefer": "return=minimal"},
            )
            print(f"[SYNC] Reset overrides: deactivated stale alerts for device {device_id}")
        except Exception as e:
            print(f"[SYNC] Reset overrides error: {e}")

    # 1) Batch insert into monitoreo_lecturas (table that frontend reads from)
    sensors_ok = 0
    sensors_failed = 0
    ts_before_insert = 0
    ts_after_insert = 0
    if sensors:
        batch = []
        for sensor_id_str, valor in sensors.items():
            batch.append({
                "sensor_id": int(sensor_id_str),
                "valor_lectura": round(float(valor), 2),
            })
        try:
            ts_before_insert = time.time()
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/monitoreo_lecturas",
                json=batch,
                headers={
                    **HEADERS_SERVICE,
                    "Prefer": "return=minimal",
                },
            )
            ts_after_insert = time.time()
            if resp.status_code in (200, 201, 204):
                sensors_ok = len(batch)
            else:
                sensors_failed = len(batch)
                print(f"[SYNC] Insert error: {resp.status_code} {resp.text[:200]}")
        except Exception as e:
            sensors_failed = len(batch)
            ts_after_insert = time.time()
            print(f"[SYNC] Insert error: {e}")

    # Calcular latencia Bridge->Supabase
    latency_bridge_to_db_ms = 0
    if ts_before_insert > 0 and ts_after_insert > 0:
        latency_bridge_to_db_ms = int((ts_after_insert - ts_before_insert) * 1000)

    # 2) Only query commands + overrides if ESP32 requests them
    commands = []
    overrides = []
    cleanup_needed = False

    if pending:
        # Run commands + overrides queries in parallel
        async def fetch_commands():
            try:
                resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/control_actuadores",
                    params={
                        "dispositivo_id": f"eq.{device_id}",
                        "estado_actual": "in.(PENDIENTE,ENVIADO)",
                        "order": "fecha_solicitud.asc",
                    },
                    headers=HEADERS_SERVICE,
                )
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                pass
            return []

        async def fetch_overrides():
            try:
                resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/simulacion_alertas",
                    params={
                        "dispositivo_id": f"eq.{device_id}",
                        "activa": "eq.true",
                        "order": "created_at.desc",
                        "limit": "10",
                    },
                    headers=HEADERS_SERVICE,
                )
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                pass
            return []

        async def fetch_config():
            try:
                resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/configuracion",
                    params={"dispositivo_id": f"eq.{device_id}"},
                    headers=HEADERS_SERVICE,
                )
                if resp.status_code == 200 and resp.json():
                    row = resp.json()[0]
                    umbrales = row.get("umbrales", {})
                    def clamped(key, subkey, lo, hi, default):
                        try:
                            v = float(umbrales.get(key, {}).get(subkey, default))
                            return max(lo, min(hi, v))
                        except (TypeError, ValueError):
                            return default
                    return {
                        "temp_min": clamped("temp", "min", -10, 50, 15),
                        "temp_max": clamped("temp", "max", -10, 50, 30),
                        "hum_amb_min": clamped("humAmb", "min", 0, 100, 30),
                        "hum_amb_max": clamped("humAmb", "max", 0, 100, 85),
                        "hum_suelo_min": clamped("humSuelo", "min", 0, 100, 40),
                        "hum_suelo_max": clamped("humSuelo", "max", 0, 100, 80),
                        "ph_min": clamped("ph", "min", 0, 14, 5.5),
                        "ph_max": clamped("ph", "max", 0, 14, 7.5),
                    }
            except Exception:
                pass
            return {
                "temp_min": 15, "temp_max": 30,
                "hum_amb_min": 30, "hum_amb_max": 85,
                "hum_suelo_min": 40, "hum_suelo_max": 80,
                "ph_min": 5.5, "ph_max": 7.5,
            }

        raw_cmds, raw_overrides, config = await asyncio.gather(
            fetch_commands(), fetch_overrides(), fetch_config()
        )
        commands = raw_cmds
        overrides = raw_overrides

        # Batch mark all commands as ENVIADO (sent, pending confirmation)
        cmd_ids = [cmd.get("id") for cmd in raw_cmds if cmd.get("id")]
        if cmd_ids:
            id_list = ",".join(str(cid) for cid in cmd_ids)
            try:
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/control_actuadores?id=in.({id_list})",
                    json={
                        "estado_actual": "ENVIADO",
                        "fecha_envio": datetime.now(timezone.utc).isoformat(),
                    },
                    headers={
                        **HEADERS_SERVICE,
                        "Prefer": "return=minimal",
                    },
                )
            except Exception as e:
                print(f"[SYNC] Batch mark ENVIADO error: {e}")

        # Expire commands ENVIADO >60s without confirmation
        try:
            cutoff = (datetime.now(timezone.utc) - __import__('datetime').timedelta(seconds=60)).isoformat()
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/control_actuadores?estado_actual=eq.ENVIADO&fecha_envio=lt.{cutoff}",
                json={
                    "estado_actual": "EXPIRADO",
                    "mensaje_error": "Sin confirmación del dispositivo en 60s",
                },
                headers={**HEADERS_SERVICE, "Prefer": "return=minimal"},
            )
        except Exception as e:
            print(f"[SYNC] Expire check error: {e}")

        # Check if any override is older than 5 minutes
        now = datetime.now(timezone.utc)
        for o in raw_overrides:
            created = o.get("created_at", "")
            if created:
                try:
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    if (now - dt).total_seconds() > 300:
                        cleanup_needed = True
                        break
                except Exception:
                    pass

    return {
        "ok": sensors_failed == 0,
        "sensors_written": sensors_ok + sensors_failed,
        "sensors_ok": sensors_ok,
        "sensors_failed": sensors_failed,
        "commands": commands,
        "overrides": overrides,
        "config": config if pending else {},
        "cleanup": cleanup_needed,
        "latency": {
            "esp32_to_bridge_ms": latency_esp32_to_bridge_ms if ts_origen_sync else None,
            "bridge_to_db_ms": latency_bridge_to_db_ms,
            "ts_origen_esp32": ts_origen_sync,
            "ts_received_bridge": int(ts_received * 1000)
        }
    }


@app.post("/api/comando")
async def recibir_comando_frontend(data: dict):
    """Recibe comandos del frontend y los guarda en Supabase.
    El ESP32 los recibe via /api/sync (piggyback).
    """
    try:
        payload = {
            "actuador_id": data.get("actuador_id"),
            "dispositivo_id": data.get("dispositivo_id"),
            "nombre_actuador": data.get("nombre_actuador"),
            "pin_conexion": data.get("pin_conexion"),
            "estado_solicitado": data.get("estado_solicitado"),
            "estado_actual": "PENDIENTE",
            "fecha_solicitud": datetime.now(timezone.utc).isoformat(),
        }
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/control_actuadores",
            json=payload,
            headers=HEADERS_SERVICE,
        )
        if resp.status_code in (200, 201):
            return {"success": True, "id": resp.json().get("id")}
        else:
            raise HTTPException(502, f"Supabase {resp.status_code}: {resp.text[:300]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/comandos/{dispositivo_id}")
async def obtener_comandos(dispositivo_id: int):
    """Obtiene comandos pendientes o ENVIADO para un ESP32"""
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/control_actuadores",
            params={
                "dispositivo_id": f"eq.{dispositivo_id}",
                "estado_actual": "in.(PENDIENTE,ENVIADO)",
                "order": "fecha_solicitud.asc",
            },
            headers=HEADERS_SERVICE,
        )

        if resp.status_code == 200:
            comandos = resp.json()
            return {"comandos": comandos}
        else:
            return {"comandos": []}
    except Exception:
        return {"comandos": []}


@app.patch("/api/comando/{cmd_id}/ejecutado", dependencies=[Depends(verify_bridge_key)])
async def marcar_ejecutado(cmd_id: int):
    """LEGACY: Marca un comando como ejecutado (compatibilidad)"""
    payload = {
        "estado_actual": "CONFIRMADO",
        "fecha_confirmacion": datetime.now(timezone.utc).isoformat(),
    }
    try:
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/control_actuadores?id=eq.{cmd_id}",
            json=payload,
            headers=HEADERS_SERVICE,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/comando/confirmar", dependencies=[Depends(verify_bridge_key)])
async def confirmar_comando(data: dict):
    """ESP32 confirma que ejecutó un comando.
    Payload: { comando_id, dispositivo_id, resultado, estado_final, mensaje_error? }
    """
    try:
        cmd_id = data.get("comando_id")
        dispositivo_id = data.get("dispositivo_id")
        resultado = data.get("resultado", "OK")
        estado_final = data.get("estado_final", "ON")
        msg_error = data.get("mensaje_error")

        if not cmd_id:
            raise HTTPException(400, "comando_id requerido")

        # Verificar que el comando existe y pertenece al dispositivo
        check = await client.get(
            f"{SUPABASE_URL}/rest/v1/control_actuadores",
            params={
                "id": f"eq.{cmd_id}",
                "dispositivo_id": f"eq.{dispositivo_id}",
            },
            headers=HEADERS_SERVICE,
        )
        if check.status_code != 200 or not check.json():
            raise HTTPException(404, "Comando no encontrado o no pertenece al dispositivo")

        cmd = check.json()[0]
        if cmd.get("estado_actual") not in ("ENVIADO", "PENDIENTE"):
            return {"status": "skipped", "reason": f"Estado actual: {cmd.get('estado_actual')}"}

        # Actualizar estado según resultado
        if resultado == "OK":
            payload = {
                "estado_actual": "CONFIRMADO",
                "fecha_confirmacion": datetime.now(timezone.utc).isoformat(),
            }
        else:
            payload = {
                "estado_actual": "ERROR",
                "fecha_confirmacion": datetime.now(timezone.utc).isoformat(),
                "mensaje_error": msg_error or f"Resultado: {resultado}",
            }

        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/control_actuadores?id=eq.{cmd_id}",
            json=payload,
            headers={**HEADERS_SERVICE, "Prefer": "return=minimal"},
        )

        status_label = "CONFIRMADO" if resultado == "OK" else "ERROR"
        print(f"[CONFIRM] cmd={cmd_id} -> {status_label}")
        return {"status": status_label}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/comando/expirar", dependencies=[Depends(verify_bridge_key)])
async def expirar_comandos():
    """Expira comandos ENVIADO por más de 60s sin confirmación."""
    try:
        cutoff = (datetime.now(timezone.utc) - __import__('datetime').timedelta(seconds=60)).isoformat()
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/control_actuadores?estado_actual=eq.ENVIADO&fecha_envio=lt.{cutoff}",
            json={
                "estado_actual": "EXPIRADO",
                "mensaje_error": "Sin confirmación del dispositivo en 60s",
            },
            headers={**HEADERS_SERVICE, "Prefer": "return=minimal"},
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/dispositivos")
async def listar_dispositivos():
    """Lista todos los dispositivos"""
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/dispositivos?select=*,sectores(nombre)",
            headers=HEADERS_SERVICE,
        )
        return resp.json()
    except Exception:
        return []


@app.get("/api/configuracion/{dispositivo_id}")
async def obtener_configuracion(dispositivo_id: int):
    """Obtiene umbrales de configuración para un dispositivo desde Supabase."""
    def clamped(key, subkey, lo, hi, default):
        try:
            v = float(umbrales.get(key, {}).get(subkey, default))
            return max(lo, min(hi, v))
        except (TypeError, ValueError):
            return default
    defaults = {
        "temp_min": 15, "temp_max": 30,
        "hum_amb_min": 30, "hum_amb_max": 85,
        "hum_suelo_min": 40, "hum_suelo_max": 80,
        "ph_min": 5.5, "ph_max": 7.5,
    }
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/configuracion",
            params={"dispositivo_id": f"eq.{dispositivo_id}"},
            headers=HEADERS_SERVICE,
        )
        if resp.status_code == 200 and resp.json():
            row = resp.json()[0]
            umbrales = row.get("umbrales", {})
            return {
                "dispositivo_id": dispositivo_id,
                "temp_min": clamped("temp", "min", -10, 50, 15),
                "temp_max": clamped("temp", "max", -10, 50, 30),
                "hum_amb_min": clamped("humAmb", "min", 0, 100, 30),
                "hum_amb_max": clamped("humAmb", "max", 0, 100, 85),
                "hum_suelo_min": clamped("humSuelo", "min", 0, 100, 40),
                "hum_suelo_max": clamped("humSuelo", "max", 0, 100, 80),
                "ph_min": clamped("ph", "min", 0, 14, 5.5),
                "ph_max": clamped("ph", "max", 0, 14, 7.5),
            }
        return {"dispositivo_id": dispositivo_id, **defaults}
    except Exception:
        return {"dispositivo_id": dispositivo_id, **defaults}


@app.get("/api/lecturas/{dispositivo_id}")
async def obtener_lecturas(dispositivo_id: int, limit: int = 50):
    """Obtiene las ultimas lecturas de un dispositivo"""
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/monitoreo_lecturas",
            params={
                "select": "*,sensores(tipo_sensor_id,tipos_sensores(nombre,unidad_medida))",
                "sensores.dispositivo_id": f"eq.{dispositivo_id}",
                "order": "fecha_hora.desc",
                "limit": str(limit),
            },
            headers=HEADERS_SERVICE,
        )
        return resp.json()
    except Exception:
        return []


# ============================================================
# SIMULACION - MODO HIBRIDO LAZO CERRADO
# ============================================================

@app.get("/api/simulacion/overrides/{dispositivo_id}", dependencies=[Depends(verify_bridge_key)])
async def obtener_overrides(dispositivo_id: int):
    """Obtiene overrides activos de simulacion para un dispositivo.
    El ESP32 llama a este endpoint cada 9 segundos para verificar
    si hay alertas de simulacion activas.
    """
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/simulacion_alertas",
            params={
                "dispositivo_id": f"eq.{dispositivo_id}",
                "activa": "eq.true",
                "order": "created_at.desc",
                "limit": "10",
            },
            headers=HEADERS_SERVICE,
        )

        if resp.status_code == 200:
            alertas = resp.json()
            return {"overrides": alertas}
        else:
            return {"overrides": []}
    except Exception:
        return {"overrides": []}


@app.post("/api/simulacion/cleanup", dependencies=[Depends(verify_bridge_key)])
async def cleanup_alertas():
    """Desactiva alertas con mas de 5 minutos de antiguedad."""
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/simulacion_alertas",
            params={
                "activa": "eq.true",
                "order": "created_at.asc",
                "limit": "50",
            },
            headers=HEADERS_SERVICE,
        )
        if resp.status_code != 200:
            return {"cleaned": 0}

        alertas = resp.json()
        now = datetime.now(timezone.utc)
        cleaned = 0
        for alerta in alertas:
            created = alerta.get("created_at", "")
            if created:
                try:
                    from datetime import timezone as tz
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    age = (now - dt).total_seconds()
                    if age > 300:
                        await client.patch(
                            f"{SUPABASE_URL}/rest/v1/simulacion_alertas?id=eq.{alerta['id']}",
                            json={"activa": False},
                            headers=HEADERS_SERVICE,
                        )
                        cleaned += 1
                except Exception:
                    pass
        return {"cleaned": cleaned}
    except Exception as e:
        return {"error": str(e), "cleaned": 0}


@app.post("/api/simulacion/reset", dependencies=[Depends(verify_bridge_key)])
async def reset_overrides_boot(data: dict):
    """Apaga cualquier override activo de un dispositivo. Se llama al arrancar el ESP32
    para garantizar que la primera lectura sea 100% fisica (sin overrides heredados)."""
    device = data.get("device")
    if device is None:
        raise HTTPException(400, detail="device requerido")
    try:
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/simulacion_alertas",
            params={"dispositivo_id": f"eq.{device}", "activa": "eq.true"},
            json={"activa": False},
            headers=HEADERS_SERVICE,
        )
        print(f"[BOOT-RESET] device={device} status={resp.status_code}")
        return {"ok": True}
    except Exception as e:
        print(f"[BOOT-RESET] Error: {e}")
        return {"ok": False, "detail": str(e)}


@app.post("/api/simulacion/alerta", dependencies=[Depends(verify_bridge_key)])
async def crear_alerta_simulacion(data: dict):
    """Crea una alerta de simulacion que el ESP32 escuchara."""
    try:
        required = ['tipo_alerta', 'sensor_tipo', 'valor_forzado', 'maceta_numero', 'dispositivo_id']
        for field in required:
            if field not in data:
                raise HTTPException(400, f"Campo requerido: {field}")

        payload = {
            "tipo_alerta": data['tipo_alerta'],
            "sensor_tipo": data['sensor_tipo'],
            "valor_forzado": float(data['valor_forzado']),
            "maceta_numero": int(data['maceta_numero']),
            "dispositivo_id": int(data['dispositivo_id']),
            "activa": True,
        }

        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/simulacion_alertas",
            json=payload,
            headers=HEADERS_SERVICE,
        )

        if resp.status_code in (200, 201):
            return {"success": True, "message": "Alerta creada"}
        else:
            raise HTTPException(502, f"Supabase {resp.status_code}: {resp.text[:300]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.patch("/api/simulacion/alerta/{alerta_id}/desactivar", dependencies=[Depends(verify_bridge_key)])
async def desactivar_alerta(alerta_id: int):
    """Desactiva una alerta de simulacion."""
    payload = {"activa": False}
    try:
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/simulacion_alertas?id=eq.{alerta_id}",
            json=payload,
            headers=HEADERS_SERVICE,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(500, str(e))


# ============================================================
# PACKET TRACER - ENVIO TCP
# ============================================================

@app.post("/api/packet-tracer", dependencies=[Depends(verify_bridge_key)])
async def enviar_a_packet_tracer(data: dict):
    """Envia comando al servidor SBC dentro de Cisco Packet Tracer"""
    try:
        # Crear conexion TCP
        reader, writer = await asyncio.open_connection(PT_HOST, PT_PORT)

        # Enviar datos como JSON
        mensaje = json.dumps(data).encode() + b"\n"
        writer.write(mensaje)
        await writer.drain()

        # Leer respuesta
        respuesta = await reader.readuntil(b"\n")
        writer.close()
        await writer.wait_closed()

        return {
            "status": "ok",
            "respuesta": respuesta.decode().strip()
        }
    except (ConnectionRefusedError, OSError):
        return {
            "status": "offline",
            "message": f"Packet Tracer no disponible en {PT_HOST}:{PT_PORT}"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ============================================================
@app.get("/api/catalogo_plantas")
async def get_catalogo_plantas():
    """Devuelve el catalogo completo de plantas desde Supabase (cache 5 min en cliente)."""
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/catalogo_plantas",
            params={"order": "nombre.asc", "limit": "200"},
            headers=HEADERS_SERVICE,
        )
        if resp.status_code == 200:
            return {"ok": True, "plantas": resp.json(), "count": len(resp.json())}
        return {"ok": False, "error": f"Supabase {resp.status_code}", "plantas": []}
    except Exception as e:
        return {"ok": False, "error": str(e), "plantas": []}


# ============================================================
# CONFIG BASELINES - Recibe valores base desde frontend
# ============================================================

# Estado en memoria de los baselines actuales (por dispositivo)
_baselines_state = {}

@app.post("/api/config/baselines", dependencies=[Depends(verify_bridge_key)])
async def update_baselines(data: dict):
    """Recibe baselines (valores estables de sensores en modo normal)
    desde el frontend cuando se selecciona una planta o se ajusta config.

    Body esperado:
    {
        "device_id": 1,
        "maceta": 1,            # opcional, si no se envia aplica a todo
        "temp": 24.5,           # baseline global
        "hum_amb": 65.0,        # baseline global
        "hum_suelo": 55.0,      # baseline de la maceta (si se envia maceta)
        "ph": 6.8,              # baseline de la maceta
        "planta_id": 5          # opcional, FK a catalogo_plantas
    }
    """
    device_id = data.get("device_id")
    if not device_id:
        raise HTTPException(400, "device_id requerido")
    maceta = data.get("maceta")
    planta_id = data.get("planta_id")

    try:
        payload = {
            "dispositivo_id": device_id,
            "umbrales": {
                "temp_min": data.get("temp_min", 15),
                "temp_max": data.get("temp_max", 30),
                "hum_amb_min": data.get("hum_amb_min", 30),
                "hum_amb_max": data.get("hum_amb_max", 85),
                "hum_suelo_min": data.get("hum_suelo_min", 40),
                "hum_suelo_max": data.get("hum_suelo_max", 80),
                "ph_min": data.get("ph_min", 5.5),
                "ph_max": data.get("ph_max", 7.5),
            },
            "planta_id": planta_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Upsert en configuracion
        existing = await client.get(
            f"{SUPABASE_URL}/rest/v1/configuracion",
            params={"dispositivo_id": f"eq.{device_id}"},
            headers=HEADERS_SERVICE,
        )
        if existing.status_code == 200 and existing.json():
            row_id = existing.json()[0]["id"]
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/configuracion?id=eq.{row_id}",
                json=payload,
                headers={**HEADERS_SERVICE, "Prefer": "return=minimal"},
            )
        else:
            await client.post(
                f"{SUPABASE_URL}/rest/v1/configuracion",
                json=payload,
                headers={**HEADERS_SERVICE, "Prefer": "return=minimal"},
            )

        # Cache en memoria para ESP32
        key = (device_id, maceta)
        _baselines_state[key] = {
            "temp": data.get("temp"),
            "hum_amb": data.get("hum_amb"),
            "hum_suelo": data.get("hum_suelo"),
            "ph": data.get("ph"),
            "planta_id": planta_id,
            "ts": time.time(),
        }

        return {"ok": True, "device_id": device_id, "maceta": maceta, "planta_id": planta_id}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/config/baselines/{device_id}")
async def get_baselines(device_id: int, maceta: int = None):
    """Devuelve los baselines actuales de un dispositivo (cache o Supabase)."""
    key = (device_id, maceta)
    if key in _baselines_state:
        return {"ok": True, "source": "cache", **(_baselines_state[key]), "maceta": maceta}

    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/configuracion",
            params={"dispositivo_id": f"eq.{device_id}"},
            headers=HEADERS_SERVICE,
        )
        if resp.status_code == 200 and resp.json():
            row = resp.json()[0]
            umbrales = row.get("umbrales", {})
            return {
                "ok": True,
                "source": "supabase",
                "planta_id": row.get("planta_id"),
                "temp_min": umbrales.get("temp_min"),
                "temp_max": umbrales.get("temp_max"),
                "hum_amb_min": umbrales.get("hum_amb_min"),
                "hum_amb_max": umbrales.get("hum_amb_max"),
                "hum_suelo_min": umbrales.get("hum_suelo_min"),
                "hum_suelo_max": umbrales.get("hum_suelo_max"),
                "ph_min": umbrales.get("ph_min"),
                "ph_max": umbrales.get("ph_max"),
            }
        return {"ok": False, "error": "Sin baselines para ese dispositivo"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# WEBSOCKET - REALTIME DESDE SUPABASE
# ============================================================

@app.websocket("/ws/realtime")
async def websocket_realtime(websocket: WebSocket):
    """WebSocket para recibir actualizaciones en tiempo real"""
    await websocket.accept()

    try:
        # Suscribirse a cambios en control_actuadores
        async with httpx.AsyncClient() as ws_client:
            # Usar polling como alternativa al WebSocket de Supabase
            last_check = datetime.now(timezone.utc).isoformat()

            while True:
                try:
                    resp = await ws_client.get(
                        f"{SUPABASE_URL}/rest/v1/control_actuadores",
                        params={
                            "estado_actual": "eq.PENDIENTE",
                            "fecha_solicitud": f"gt.{last_check}",
                            "order": "fecha_solicitud.asc",
                        },
                        headers=HEADERS_SERVICE,
                    )

                    if resp.status_code == 200:
                        comandos = resp.json()
                        for cmd in comandos:
                            await websocket.send_json({
                                "type": "comando",
                                "data": cmd
                            })

                            # Enviar a Packet Tracer
                            await enviar_a_packet_tracer(cmd)

                            # Marcar como procesado
                            cmd_id = cmd.get("id")
                            if cmd_id:
                                await marcar_ejecutado(cmd_id)

                            last_check = cmd.get("fecha_solicitud", last_check)

                except Exception:
                    pass

                await asyncio.sleep(3)

    except WebSocketDisconnect:
        print("WebSocket desconectado")


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
async def root():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/index.html")
async def index_html():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/login")
async def login_page():
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

@app.get("/ping")
async def ping():
    return {"status": "ok"}


@app.get("/health")
async def health():
    env_ok = {
        "SUPABASE_URL": bool(SUPABASE_URL),
        "SUPABASE_ANON_KEY": bool(SUPABASE_ANON_KEY),
        "SUPABASE_SERVICE_KEY": bool(SUPABASE_SERVICE_KEY),
    }

    supabase_ok = False
    supabase_detail = ""
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/sectores?select=id&limit=1",
            headers=HEADERS_SERVICE,
        )
        supabase_ok = resp.status_code == 200
        supabase_detail = f"{resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        supabase_detail = str(e)

    return {
        "env_vars": env_ok,
        "supabase": "connected" if supabase_ok else "disconnected",
        "supabase_detail": supabase_detail,
        "packet_tracer": f"{PT_HOST}:{PT_PORT}",
        "security": "api_key_active" if BRIDGE_SECRET_KEY else "no_key_set",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/test-db")
async def test_db():
    """Test de conexión a Supabase y tabla monitoreo_lecturas."""
    results = {"supabase_url": bool(SUPABASE_URL), "tests": []}

    # Test 1: Conexión general
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/sectores?select=id&limit=1",
            headers=HEADERS_SERVICE,
        )
        results["tests"].append({
            "name": "supabase_connection",
            "status": "ok" if resp.status_code == 200 else "error",
            "code": resp.status_code,
        })
    except Exception as e:
        results["tests"].append({"name": "supabase_connection", "status": "error", "detail": str(e)})

    # Test 2: Tabla monitoreo_lecturas existe
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/monitoreo_lecturas?select=id&limit=1",
            headers=HEADERS_SERVICE,
        )
        results["tests"].append({
            "name": "monitoreo_lecturas_readable",
            "status": "ok" if resp.status_code == 200 else "error",
            "code": resp.status_code,
            "detail": resp.text[:200] if resp.status_code != 200 else "accessible",
        })
    except Exception as e:
        results["tests"].append({"name": "monitoreo_lecturas_readable", "status": "error", "detail": str(e)})

    # Test 3: INSERT en monitoreo_lecturas
    try:
        test_payload = [{"sensor_id": 999, "valor_lectura": 0.0}]
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/monitoreo_lecturas",
            json=test_payload,
            headers={**HEADERS_SERVICE, "Prefer": "return=minimal"},
        )
        results["tests"].append({
            "name": "monitoreo_lecturas_writable",
            "status": "ok" if resp.status_code in (200, 201, 204) else "error",
            "code": resp.status_code,
            "detail": resp.text[:200] if resp.status_code not in (200, 201, 204) else "writable",
        })
        # Cleanup: delete test row
        if resp.status_code in (200, 201, 204):
            await client.delete(
                f"{SUPABASE_URL}/rest/v1/monitoreo_lecturas?sensor_id=eq.999",
                headers=HEADERS_SERVICE,
            )
    except Exception as e:
        results["tests"].append({"name": "monitoreo_lecturas_writable", "status": "error", "detail": str(e)})

    # Test 4: Contar registros
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/monitoreo_lecturas?select=count&limit=1",
            headers={**HEADERS_SERVICE, "Prefer": "count=exact"},
        )
        count = "unknown"
        if resp.status_code == 200:
            content_range = resp.headers.get("content-range", "")
            if "/" in content_range:
                count = content_range.split("/")[1]
        results["tests"].append({
            "name": "monitoreo_lecturas_count",
            "status": "ok",
            "count": count,
        })
    except Exception as e:
        results["tests"].append({"name": "monitoreo_lecturas_count", "status": "error", "detail": str(e)})

    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


# ============================================================
# HUERTO CHALLENGE — Scores & Ranking
# ============================================================

class ChallengeScore(BaseModel):
    player_name: str = Field(..., min_length=1, max_length=50)
    total_score: int = Field(..., ge=0)
    correct_count: int = Field(0, ge=0)
    rounds_played: int = Field(0, ge=0)
    plant_stage: int = Field(0, ge=0, le=5)


@app.post("/api/challenge/score")
async def save_challenge_score(data: ChallengeScore):
    """Guarda una puntuación del juego Huerto Challenge en Supabase."""
    try:
        payload = {
            "player_name": data.player_name.strip(),
            "total_score": data.total_score,
            "correct_count": data.correct_count,
            "rounds_played": data.rounds_played,
            "plant_stage": data.plant_stage,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/challenge_scores",
            json=payload,
            headers=HEADERS_SERVICE,
        )
        if resp.status_code in (200, 201):
            return {"success": True, "message": "Puntuación guardada"}
        return {"success": False, "message": f"Error Supabase: {resp.status_code}"}
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/api/challenge/ranking")
async def get_challenge_ranking(limit: int = 10):
    """Obtiene el ranking de mejores puntuaciones del Huerto Challenge."""
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/challenge_scores",
            params={
                "select": "player_name,total_score,plant_stage",
                "order": "total_score.desc,created_at.asc",
                "limit": str(max(1, min(50, limit))),
            },
            headers=HEADERS_SERVICE,
        )
        if resp.status_code == 200:
            rows = resp.json()
            ranking = []
            for i, row in enumerate(rows):
                ranking.append({
                    "position": i + 1,
                    "player_name": row.get("player_name", ""),
                    "total_score": row.get("total_score", 0),
                    "plant_stage": row.get("plant_stage", 0),
                })
            return {"ranking": ranking}
        return {"ranking": []}
    except Exception:
        return {"ranking": []}

# ============================================================
# PLANT APIs - PERENUAL + TREFLE
# ============================================================

PERENUAL_BASE = "https://perenual.com/api"
TREFLE_BASE = "https://trefle.io/api/v1"


async def _perenual_search(query: str, page: int = 1):
    """Busca plantas en Perenual API con cache."""
    if not PERENUAL_KEY:
        return []
    cache_key = f"perenual_search_{query}_{page}"
    # Check cache
    try:
        cached = await client.get(
            f"{SUPABASE_URL}/rest/v1/plant_api_cache",
            params={
                "api_source": "eq.perenual",
                "query_text": f"eq.{cache_key}",
                "limit": "1",
            },
            headers=HEADERS_SERVICE,
        )
        if cached.status_code == 200 and cached.json():
            age = time.time() - cached.json()[0].get("created_at", "")
            return cached.json()[0]["raw_response"].get("data", [])
    except Exception:
        pass
    # Fetch from API
    try:
        resp = await client.get(
            f"{PERENUAL_BASE}/species-list",
            params={"key": PERENUAL_KEY, "q": query, "page": str(page)},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Cache response
            try:
                await client.post(
                    f"{SUPABASE_URL}/rest/v1/plant_api_cache",
                    json={
                        "api_source": "perenual",
                        "api_id": cache_key,
                        "query_text": cache_key,
                        "raw_response": data,
                    },
                    headers=HEADERS_SERVICE,
                )
            except Exception:
                pass
            return data.get("data", [])
    except Exception as e:
        print(f"[PERENUAL] Search error: {e}")
    return []


async def _perenual_details(species_id: int):
    """Obtiene detalles de una planta en Perenual con cache."""
    if not PERENUAL_KEY:
        return None
    cache_key = f"perenual_detail_{species_id}"
    try:
        cached = await client.get(
            f"{SUPABASE_URL}/rest/v1/plant_api_cache",
            params={
                "api_source": "eq.perenual",
                "api_id": f"eq.{cache_key}",
                "limit": "1",
            },
            headers=HEADERS_SERVICE,
        )
        if cached.status_code == 200 and cached.json():
            return cached.json()[0]["raw_response"]
    except Exception:
        pass
    try:
        resp = await client.get(
            f"{PERENUAL_BASE}/species/details/{species_id}",
            params={"key": PERENUAL_KEY},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            try:
                await client.post(
                    f"{SUPABASE_URL}/rest/v1/plant_api_cache",
                    json={
                        "api_source": "perenual",
                        "api_id": cache_key,
                        "query_text": cache_key,
                        "raw_response": data,
                    },
                    headers=HEADERS_SERVICE,
                )
            except Exception:
                pass
            return data
    except Exception as e:
        print(f"[PERENUAL] Details error: {e}")
    return None


async def _trefle_search(query: str, page: int = 1):
    """Busca plantas en Trefle API con cache."""
    if not TREFLE_TOKEN:
        return []
    cache_key = f"trefle_search_{query}_{page}"
    try:
        cached = await client.get(
            f"{SUPABASE_URL}/rest/v1/plant_api_cache",
            params={
                "api_source": "eq.trefle",
                "query_text": f"eq.{cache_key}",
                "limit": "1",
            },
            headers=HEADERS_SERVICE,
        )
        if cached.status_code == 200 and cached.json():
            return cached.json()[0]["raw_response"].get("data", [])
    except Exception:
        pass
    try:
        resp = await client.get(
            f"{TREFLE_BASE}/plants/search",
            params={"q": query, "token": TREFLE_TOKEN, "page": str(page)},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            try:
                await client.post(
                    f"{SUPABASE_URL}/rest/v1/plant_api_cache",
                    json={
                        "api_source": "trefle",
                        "api_id": cache_key,
                        "query_text": cache_key,
                        "raw_response": data,
                    },
                    headers=HEADERS_SERVICE,
                )
            except Exception:
                pass
            return data.get("data", [])
    except Exception as e:
        print(f"[TREFLE] Search error: {e}")
    return []


async def _trefle_details(slug: str):
    """Obtiene detalles de una planta en Trefle con cache."""
    if not TREFLE_TOKEN:
        return None
    cache_key = f"trefle_detail_{slug}"
    try:
        cached = await client.get(
            f"{SUPABASE_URL}/rest/v1/plant_api_cache",
            params={
                "api_source": "eq.trefle",
                "api_id": f"eq.{cache_key}",
                "limit": "1",
            },
            headers=HEADERS_SERVICE,
        )
        if cached.status_code == 200 and cached.json():
            return cached.json()[0]["raw_response"].get("data", cached.json()[0]["raw_response"])
    except Exception:
        pass
    try:
        resp = await client.get(
            f"{TREFLE_BASE}/species/{slug}",
            params={"token": TREFLE_TOKEN},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            try:
                await client.post(
                    f"{SUPABASE_URL}/rest/v1/plant_api_cache",
                    json={
                        "api_source": "trefle",
                        "api_id": cache_key,
                        "query_text": cache_key,
                        "raw_response": data,
                    },
                    headers=HEADERS_SERVICE,
                )
            except Exception:
                pass
            return data.get("data", data)
    except Exception as e:
        print(f"[TREFLE] Details error: {e}")
    return None


def _merge_plant_results(perenual_list, trefle_list):
    """Fusiona resultados de ambas APIs por nombre cientifico o comun."""
    merged = {}
    # Index trefle by scientific_name and common_name
    trefle_idx = {}
    for t in trefle_list:
        sn = (t.get("scientific_name") or "").lower().strip()
        cn = (t.get("common_name") or "").lower().strip()
        if sn:
            trefle_idx[sn] = t
        if cn:
            trefle_idx[cn] = t
    # Process perenual results
    for p in perenual_list:
        p_names = [p.get("common_name", "")]
        for sn in p.get("scientific_name", []):
            if sn:
                p_names.append(sn.lower().strip())
        key = p_names[0].lower().strip() if p_names else str(p.get("id", ""))
        match_trefle = None
        for name in p_names:
            if name.lower().strip() in trefle_idx:
                match_trefle = trefle_idx[name.lower().strip()]
                break
        merged[key] = {
            "perenual_id": p.get("id"),
            "perenual_name": p.get("common_name", ""),
            "scientific_name": (p.get("scientific_name", [None]) or [None])[0],
            "imagen_url": (p.get("default_image") or {}).get("small_url") or (p.get("default_image") or {}).get("thumbnail"),
            "other_names": p.get("other_name", []),
            "family": None,
            "trefle_slug": match_trefle.get("slug") if match_trefle else None,
        }
        if match_trefle:
            merged[key]["trefle_slug"] = match_trefle.get("slug")
            merged[key]["scientific_name"] = merged[key].get("scientific_name") or match_trefle.get("scientific_name")
    # Add trefle-only results
    for t in trefle_list:
        sn = (t.get("scientific_name") or "").lower().strip()
        cn = (t.get("common_name") or "").lower().strip()
        already = False
        for m in merged.values():
            msn = (m.get("scientific_name") or "").lower().strip()
            if msn and sn and msn == sn:
                already = True
                break
            if m.get("perenual_name", "").lower().strip() == cn:
                already = True
                break
        if not already and cn:
            merged[cn] = {
                "perenual_id": None,
                "perenual_name": None,
                "scientific_name": t.get("scientific_name"),
                "imagen_url": t.get("image_url"),
                "other_names": [],
                "family": t.get("family"),
                "trefle_slug": t.get("slug"),
            }
    return list(merged.values())[:15]


@app.get("/api/plants/search")
async def search_plants(q: str = "", source: str = "both"):
    """Busca plantas en Perenual y/o Trefle, retorna resultados fusionados."""
    if not q or len(q) < 2:
        return {"ok": True, "results": []}
    perenual_data = []
    trefle_data = []
    tasks = []
    if source in ("both", "perenual"):
        tasks.append(_perenual_search(q))
    if source in ("both", "trefle"):
        tasks.append(_trefle_search(q))
    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        idx = 0
        if source in ("both", "perenual"):
            perenual_data = results[idx] if isinstance(results[idx], list) else []
            idx += 1
        if source in ("both", "trefle"):
            trefle_data = results[idx] if isinstance(results[idx], list) else []
    merged = _merge_plant_results(perenual_data, trefle_data)
    return {"ok": True, "results": merged, "perenual_count": len(perenual_data), "trefle_count": len(trefle_data)}


@app.get("/api/plants/details/perenual/{species_id}")
async def get_perenual_details(species_id: int):
    """Detalles completos de una planta desde Perenual."""
    data = await _perenual_details(species_id)
    if not data:
        raise HTTPException(404, "Planta no encontrada en Perenual")
    return {"ok": True, "data": data}


@app.get("/api/plants/details/trefle/{slug}")
async def get_trefle_details(slug: str):
    """Detalles completos de una planta desde Trefle."""
    data = await _trefle_details(slug)
    if not data:
        raise HTTPException(404, "Planta no encontrada en Trefle")
    return {"ok": True, "data": data}


@app.post("/api/plants/import", dependencies=[Depends(verify_bridge_key)])
async def import_plant(data: dict):
    """Importa una planta desde Perenual/Trefle al catalogo_plantas.

    Body: {
        nombre, perenual_id?, trefle_slug?,
        temp: {min, max}, humSuelo: {min, max}, humAmb: {min, max}, ph: {min, max},
        imagen_url?, scientific_name?, familia?, watering?, sunlight?, care_level?,
        growth_rate?, soil_type?, description?
    }
    """
    nombre = data.get("nombre", "").strip()
    if not nombre:
        raise HTTPException(400, "nombre requerido")
    # Check duplicate
    existing = await client.get(
        f"{SUPABASE_URL}/rest/v1/catalogo_plantas",
        params={"nombre": f"eq.{nombre}", "limit": "1"},
        headers=HEADERS_SERVICE,
    )
    if existing.status_code == 200 and existing.json():
        raise HTTPException(409, f"Planta '{nombre}' ya existe en el catalogo")
    payload = {
        "nombre": nombre,
        "temp_min": data.get("temp", {}).get("min", 15),
        "temp_max": data.get("temp", {}).get("max", 30),
        "hum_suelo_min": data.get("humSuelo", {}).get("min", 40),
        "hum_suelo_max": data.get("humSuelo", {}).get("max", 80),
        "hum_ambiente_min": data.get("humAmb", {}).get("min", 30),
        "hum_ambiente_max": data.get("humAmb", {}).get("max", 85),
        "ph_min": data.get("ph", {}).get("min", 5.5),
        "ph_max": data.get("ph", {}).get("max", 7.5),
        "perenual_id": data.get("perenual_id"),
        "trefle_slug": data.get("trefle_slug"),
        "imagen_url": data.get("imagen_url"),
        "scientific_name": data.get("scientific_name"),
        "familia": data.get("familia"),
        "watering": data.get("watering"),
        "sunlight": data.get("sunlight"),
        "care_level": data.get("care_level"),
        "growth_rate": data.get("growth_rate"),
        "soil_type": data.get("soil_type"),
        "description": data.get("description"),
        "source_api": "perenual" if data.get("perenual_id") else ("trefle" if data.get("trefle_slug") else "manual"),
    }
    resp = await client.post(
        f"{SUPABASE_URL}/rest/v1/catalogo_plantas",
        json=payload,
        headers={**HEADERS_SERVICE, "Prefer": "return=representation"},
    )
    if resp.status_code in (200, 201):
        rows = resp.json()
        return {"ok": True, "planta": rows[0] if rows else payload}
    raise HTTPException(500, f"Error insertando: {resp.status_code} {resp.text[:200]}")


@app.post("/api/plants/enrich", dependencies=[Depends(verify_bridge_key)])
async def enrich_plants():
    """Enriquece plantas existentes sin source_api buscando en Trefle + Perenual.
    Limitado a 10 plantas por llamada para no gastar rate limits."""
    # Get plants without source_api
    resp = await client.get(
        f"{SUPABASE_URL}/rest/v1/catalogo_plantas",
        params={
            "source_api": "is.null",
            "limit": "10",
            "order": "id.asc",
        },
        headers=HEADERS_SERVICE,
    )
    if resp.status_code != 200 or not resp.json():
        return {"ok": True, "enriched": 0, "message": "No hay plantas para enriquecer"}
    plants = resp.json()
    enriched = 0
    errors = 0
    for plant in plants:
        nombre = plant.get("nombre", "")
        plant_id = plant.get("id")
        updates = {}
        # Search Trefle
        trefle_results = await _trefle_search(nombre)
        if trefle_results:
            t = trefle_results[0]
            slug = t.get("slug")
            if slug:
                details = await _trefle_details(slug)
                if details:
                    g = details.get("growth", {}) or {}
                    updates["trefle_slug"] = slug
                    updates["scientific_name"] = details.get("scientific_name")
                    if g.get("ph_minimum") is not None:
                        updates["ph_min"] = g["ph_minimum"]
                    if g.get("ph_maximum") is not None:
                        updates["ph_max"] = g["ph_maximum"]
                    temp_min = (g.get("minimum_temperature") or {}).get("deg_c")
                    temp_max = (g.get("maximum_temperature") or {}).get("deg_c")
                    if temp_min is not None:
                        updates["temp_min"] = temp_min
                    if temp_max is not None:
                        updates["temp_max"] = temp_max
                    updates["imagen_url"] = details.get("image_url") or plant.get("imagen_url")
        # Search Perenual
        perenual_results = await _perenual_search(nombre)
        if perenual_results:
            p = perenual_results[0]
            updates["perenual_id"] = p.get("id")
            updates["imagen_url"] = updates.get("imagen_url") or (p.get("default_image") or {}).get("small_url")
            details = await _perenual_details(p["id"])
            if details:
                updates["watering"] = details.get("watering")
                updates["sunlight"] = ",".join(details.get("sunlight", []))
                updates["care_level"] = details.get("care_level")
                updates["growth_rate"] = details.get("growth_rate")
                updates["soil_type"] = ",".join(details.get("soil", []))
                updates["description"] = details.get("description")
                updates["familia"] = details.get("family")
        updates["source_api"] = "both" if updates.get("perenual_id") and updates.get("trefle_slug") else (
            "perenual" if updates.get("perenual_id") else "trefle"
        )
        if updates:
            try:
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/catalogo_plantas?id=eq.{plant_id}",
                    json=updates,
                    headers={**HEADERS_SERVICE, "Prefer": "return=minimal"},
                )
                enriched += 1
                print(f"[ENRICH] {nombre}: {list(updates.keys())}")
            except Exception as e:
                errors += 1
                print(f"[ENRICH] Error {nombre}: {e}")
    return {"ok": True, "enriched": enriched, "errors": errors, "processed": len(plants)}


# Archivos estaticos del frontend (al final para no capturar API routes)
app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")
app.mount("/src", StaticFiles(directory=os.path.join(FRONTEND_DIR, "src")), name="src")
