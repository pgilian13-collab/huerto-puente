# AGENTS.md — Contexto Completo del Proyecto

## Que es esto
Sistema de Riego Inteligente para un Huerto Universitario con Gemelo Digital y Simulacion de Infraestructura de Red. 5 invernaderos x (2 sensores compartidos + 4 macetas x 2 sensores por maceta) = **50 sensores**. Hibridacion con 3 fases.

## Stack tecnologico
- **ESP32** en Wokwi (MicroPython v1.22.0) — firmware del sensor
- **Supabase** (PostgreSQL) — base de datos
  - URL: `https://nzicdhwoficzsafhdxmq.supabase.co`
  - Service Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aWNkaHdvZmljenNhZmhkeG1xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc4MTg0MywiZXhwIjoyMDk2MzU3ODQzfQ.Al5773jpjE6YiQ_hzyLVAVIzzgk0DkU8xQPMGkjXtOU`
- **Render** (FastAPI) — Bridge + Frontend estatico
  - URL: `https://huerto-puente.onrender.com`
  - Repo: `https://github.com/pgilian13-collab/huerto-puente`
  - Branch: `master`, root: `puente_supabase/`
  - `BRIDGE_SECRET_KEY` = `huerto-ccss-2026`
- **Frontend** — SPA brutalista (JetBrains Mono, esquinas, remaches)
- **Cisco Packet Tracer** — simulacion de red

## Arquitectura
```
ESP32 (Wokwi) --> HTTP POST /api/sync --> Bridge (Render) --> Supabase (PostgreSQL)
                        ^                                          |
                        |_____________ commands + overrides ________|
Frontend (Render static) <--- Supabase Realtime / REST ---> Browser
```

## Base de datos — Tablas clave

### monitoreo_lecturas
- `id` (serial), `sensor_id` (int), `valor_lectura` (float), `fecha_hora` (timestamptz default now())
- 50 sensores, IDs 0-49

### sensores
- 50 registros, formula: `base = (dispositivo_id - 1) * 10`
  - temp: base+0 (compartido, maceta=0)
  - hum_amb: base+1 (compartido, maceta=0)
  - hum_suelo MAC-m: base+2+(m-1)*2
  - ph MAC-m: base+3+(m-1)*2

### simulacion_alertas
- `id`, `tipo_alerta`, `sensor_tipo`, `valor_forzado`, `maceta_numero` (0=compartido, 1-4=maceta), `dispositivo_id`, `activa` (bool), `created_at`

### control_actuadores
- `id`, `dispositivo_id`, `nombre_actuador`, `pin_conexion`, `estado_solicitado` (PENDIENTE/EJECUTADO), `fecha_solicitud`, `fecha_ejecucion`

### configuracion
- `id`, `dispositivo_id`, `umbrales` (JSONB: `{temp:{min,max}, humAmb:{min,max}, humSuelo:{min,max}, ph:{min,max}}`)

### dispositivos
- 5 registros (IDs 1-5)

## ESP32 — Pin Mapping (main.py)

### MUX CD74HC4067
- S0=GPIO27, S1=GPIO16, S2=GPIO17, S3=GPIO18, SIG=GPIO34
- C0=suelo_MAC1, C1=pH_MAC1, C2=suelo_MAC2, C3=pH_MAC2, C4=suelo_MAC3, C5=pH_MAC3, C6=suelo_MAC4, C7=pH_MAC4

### DHT22
- GPIO4 (1 compartido para todo el invernadero)

### Relays (3 por maceta)
- MAC1: bomba=GPIO32, ventilador=GPIO14, pulverizador=GPIO5
- MAC2: bomba=GPIO23, ventilador=GPIO0, pulverizador=GPIO15
- MAC3: bomba=GPIO12, ventilador=GPIO11, pulverizador=GPIO10
- MAC4: bomba=GPIO8, ventilador=GPIO7, pulverizador=GPIO6

### Buzzer y LEDs globales
- Buzzer: GPIO26 (PWM)
- LED naranja: GPIO33 (critico)
- LED amarillo: GPIO25 (alerta)
- LED verde: GPIO1 (normal)

### 74HC595 Shift Register (LEDs por maceta)
- DS=GPIO2, SHCP=GPIO3, STCP=GPIO19, OE=GND, MR=5V
- Q0-Q3: verde por maceta (relay activo)
- Q4-Q7: rojo por maceta (condicion critica)
- Sin GPIOs libres restantes

### OLED
- I2C: SCL=GPIO22, SDA=GPIO21
- 5 paginas: MAC-1 a MAC-4 (sensores+relays) + sistema, cicla cada 3s
- No esta en Wokwi, se maneja con null check

### PCF8574 (solo hardware real, NO en Wokwi)
- 0x20: MAC-1 y MAC-2
- 0x21: MAC-3 y MAC-4
- Se maneja con null check (try/except)

## ESP32 — Logica principal (main.py)

### Ciclo de lectura
- Loop cada 0.5s
- `sync_counter >= 14` (7 segundos) envia todo via piggyback
- `heartbeat_timer >= 20` (10 segundos) mantiene Render despierto
- OLED cicla cada 3s

### Sensor Override (3 fases, en ESP32)
1. DEGRADING (21s, 7 pasos x 3s): valor actual -> critico
2. HOLDING (2s): se mantiene en critico
3. RECOVERING (60s, 20 pasos x 3s): critico -> setpoint
- TTL: 120 segundos, luego expira

### Lazo cerrado (automatico)
- Bomba: ON si hum_suelo < 30, OFF si > 55
- Ventilador: ON si temp > 35 o hum_amb > 85, OFF si temp < 30 y hum_amb < 75
- Pulverizador: ON si hum_amb < 20 o temp > 35, OFF si hum_amb > 50

### Sensores None detection
- `leer_suelo()` / `leer_ph()` retornan None si raw ADC < 200 o > 3800 (pines flotantes)

## Bridge (puente_supabase/main.py)

### Endpoints principales
- `POST /api/sync` — Piggyback: ESP32 envia sensores + recibe comandos + overrides en 1 llamada
- `POST /api/simulacion/alerta` — Frontend crea alerta de simulacion
- `POST /api/comando` — Frontend envia comando de actuador
- `GET /ping` — Heartbeat
- `GET /health` — Estado del sistema

### Protocolo piggyback
```
ESP32 POST /api/sync {device: 1, sensors: {0: 25.3, 1: 65.1, ...}, pending: true}
Bridge responde: {ok: true, sensors_written: 10, commands: [...], overrides: [...], cleanup: false}
```

## Frontend — Arquitectura SPA

### Estructura
```
frontend/
  index.html          — Shell (vista, sidebar overlay, modales)
  login.html          — Login mock (no Supabase Auth real)
  css/styles.css      — Tema brutalista completo
  src/
    core/
      app.js          — Bootstrap, rutas, sensor modal, showToast
      state.js        — Estado centralizado (AppState)
      router.js       — Hash router con lazy loading
      moduleLoader.js — Carga dinamica con cache busting (?v=7)
      eventBus.js     — Eventos pub/sub
    services/
      api.js          — HTTP client (Supabase REST + Bridge)
      sensorService.js — Polling/Realtime de sensores
      actuatorService.js — CRUD de actuadores
    components/
      sidebar/sidebar.js — Menu fullscreen overlay
    views/
      dashboard/dashboard.js — Vista principal + OverrideManager
      sensors/sensors.js     — Tabla de sensores
      config/config.js       — Configuracion de umbrales (4 items)
      game/game.js + gameModule.js — Juego educativo
      reports/reports.js     — Reportes (datos hardcodeados)
```

### Rutas SPA
- `#/dashboard` — Dashboard principal (sensores, actuadores, grafico, config, simulacion)
- `#/tabla` — Tabla de sensores en vivo
- `#/config` — Configuracion de umbrales (carga desde Supabase)
- `#/reportes` — Reportes
- `#/juego` — Juego (solo admin)

### Grafico (dashboard.js)
- Labels-based (HH:mm:ss), dual Y-axis (0-100 izq, 0-14 der)
- 4 datasets: temp, humSuelo, humAmb, ph
- **Deteccion de gaps**: >30s sin datos = fondo rojo semitransparente + lineas punteadas
- **Auto-refresh**: cada 2s cuando llegan nuevos datos
- **Empty state**: texto "Sin datos disponibles"

### Configuracion (config.js)
- 4 items: Temperatura, Humedad Ambiente, Humedad Suelo, pH
- Carga desde Supabase al init
- Guarda a Supabase + localStorage
- Helper `val(id, fallback)` para null safety

### OverrideManager (dashboard.js)
- Tracking local que refleja el ciclo del ESP32
- START_DELAY=30s, DEGRADING=210s, HOLDING=20s, RECOVERING=100s = ~6min total
- Actuadores visual ON solo durante RECOVERING
- ACTUATOR_MAP: hum_suelo->bomba, temp->ventilador, hum_amb->pulverizador

### Live/Offline indicator
- 15s timeout: si no hay datos del ESP32, marca OFFLINE
- `.live-indicator` y `.status-indicator` se actualizan juntos via `setLiveStatus()`

### Cache busting
- `ModuleLoader` agrega `?v=7` automaticamente a scripts/CSS dinamicos
- index.html: todos los scripts con `?v=7`

## Simulador (simulador.py)
- Python que genera datos fake para los 5 modulos
- 10 sensores por modulo (2 compartidos + 4x2 per-maceta)
- Envia al bridge via HTTP

## Reglas importantes

1. **NO rediseñar el frontend** — el diseno brutalista esta aprobado
2. **NO cambiar la DB radicalmente** — no saturar queries
3. **NO sacrificar funcionalidad** — todo debe seguir funcionando
4. **Sincronizar `frontend/` a `puente_supabase/static/`** — Render sirve desde ahi
5. **Hard refresh despues de cambios** (Ctrl+Shift+R)
6. **GPIO35 es input-only** en ESP32 — no se puede usar como output
7. **MicroPython no tiene str.zfill()** — usar concatenacion manual
8. **PCF8574 no esta en Wokwi** — solo funciona en hardware real
9. **`leer_suelo()`/`leer_ph()` retornan None** si pin flotante (raw <200 o >3800)

## Commits recientes clave
- `5df7da6` — Sidebar config link + route fix
- `6a25f5d` — view-config HTML section
- `d9e9b1c` — OLED zfill fix
- `45732d8` — Shift register pin names
- `e129779` — Sensor None detection
- `843b050` — Simulation timing x10
- `ba9ac75` — Config humSuelo UI
- `d59af97` — Config humSuelo load from Supabase
