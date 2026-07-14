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

# Directorio del frontend (unificado, sin duplicar en static/)
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")

# ============================================================
# CONFIGURACION
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
BRIDGE_SECRET_KEY = os.getenv("BRIDGE_SECRET_KEY", "")

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
    if sensors:
        batch = []
        for sensor_id_str, valor in sensors.items():
            batch.append({
                "sensor_id": int(sensor_id_str),
                "valor_lectura": round(float(valor), 2),
            })
        try:
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/monitoreo_lecturas",
                json=batch,
                headers={
                    **HEADERS_SERVICE,
                    "Prefer": "return=minimal",
                },
            )
            if resp.status_code in (200, 201, 204):
                sensors_ok = len(batch)
            else:
                sensors_failed = len(batch)
                print(f"[SYNC] Insert error: {resp.status_code} {resp.text[:200]}")
        except Exception as e:
            sensors_failed = len(batch)
            print(f"[SYNC] Insert error: {e}")

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

# Archivos estaticos del frontend (al final para no capturar API routes)
app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")
app.mount("/src", StaticFiles(directory=os.path.join(FRONTEND_DIR, "src")), name="src")
