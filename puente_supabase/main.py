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
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

load_dotenv()

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


@app.get("/api/comandos/{dispositivo_id}")
async def obtener_comandos(dispositivo_id: int):
    """Obtiene comandos pendientes para un ESP32"""
    try:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/control_actuadores",
            params={
                "dispositivo_id": f"eq.{dispositivo_id}",
                "estado_actual": "eq.PENDIENTE",
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
    """Marca un comando como ejecutado"""
    payload = {
        "estado_actual": "EJECUTADO",
        "fecha_ejecucion": datetime.now(timezone.utc).isoformat(),
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
    return FileResponse("static/index.html")


@app.get("/index.html")
async def index_html():
    return FileResponse("static/index.html")


@app.get("/login")
async def login_page():
    return FileResponse("static/login.html")

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Archivos estaticos del frontend (al final para no capturar API routes)
app.mount("/css", StaticFiles(directory="static/css"), name="css")
app.mount("/js", StaticFiles(directory="static/js"), name="js")
