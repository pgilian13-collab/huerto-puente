-- ============================================================
-- HUERTO INTELIGENTE UNHEVAL — SQL COMPLETO DESDE CERO
-- Supabase (PostgreSQL)
-- ============================================================
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ============================================================
-- 1. CATÁLOGOS
-- ============================================================

-- Sectores (5 invernaderos)
CREATE TABLE IF NOT EXISTS sectores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    ubicacion_coordenadas VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO sectores (nombre, descripcion, ubicacion_coordenadas) VALUES
('Invernadero 1', 'Modulo de cultivo 1 — 4 macetas', '10.0.1.0/24'),
('Invernadero 2', 'Modulo de cultivo 2 — 4 macetas', '10.0.2.0/24'),
('Invernadero 3', 'Modulo de cultivo 3 — 4 macetas', '10.0.3.0/24'),
('Invernadero 4', 'Modulo de cultivo 4 — 4 macetas', '10.0.4.0/24'),
('Invernadero 5', 'Modulo de cultivo 5 — 4 macetas', '10.0.5.0/24');

-- Tipos de sensores (4 tipos)
CREATE TABLE IF NOT EXISTS tipos_sensores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    unidad_medida VARCHAR(20) NOT NULL,
    rango_min DECIMAL(10,2),
    rango_max DECIMAL(10,2),
    descripcion TEXT
);

INSERT INTO tipos_sensores (nombre, unidad_medida, rango_min, rango_max, descripcion) VALUES
('Temperatura',    '°C',  -10,  60, 'Sensor DHT22 — temperatura ambiente'),
('Humedad Ambiente','%',     0, 100, 'Sensor DHT22 — humedad relativa del aire'),
('Humedad Suelo',  '%',     0, 100, 'Sensor capacitivo — humedad del sustrato'),
('pH Suelo',       'pH',    0,  14, 'Sensor potenciométrico — acidez del suelo');

-- Tipos de actuadores (4 tipos)
CREATE TABLE IF NOT EXISTS tipos_actuadores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

INSERT INTO tipos_actuadores (nombre, descripcion) VALUES
('Bomba de Agua',   'Relay de bomba de riego por goteo'),
('Pulverizador',    'Relay de pulverizador de techo'),
('Ventilador',      'Relay de ventilador de enfriamiento'),
('Buzzer',          'Alarma sonora de alerta global');

-- ============================================================
-- 2. DISPOSITIVOS (5 ESP32)
-- ============================================================

CREATE TABLE IF NOT EXISTS dispositivos (
    id SERIAL PRIMARY KEY,
    mac_address VARCHAR(17) NOT NULL UNIQUE,
    nombre VARCHAR(50) NOT NULL,
    sector_id INT NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
    ip_address VARCHAR(15),
    estado_conexion VARCHAR(10) DEFAULT 'OFFLINE',
    ultima_conexion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO dispositivos (mac_address, nombre, sector_id, ip_address) VALUES
('AA:BB:CC:DD:00:01', 'ESP32-INV1', 1, '10.0.1.10'),
('AA:BB:CC:DD:00:02', 'ESP32-INV2', 2, '10.0.2.10'),
('AA:BB:CC:DD:00:03', 'ESP32-INV3', 3, '10.0.3.10'),
('AA:BB:CC:DD:00:04', 'ESP32-INV4', 4, '10.0.4.10'),
('AA:BB:CC:DD:00:05', 'ESP32-INV5', 5, '10.0.5.10');

-- ============================================================
-- 3. SENSORES (50 registros, IDs 0-49)
-- ============================================================
-- Fórmula: base = (dispositivo_id - 1) * 10
--   temp:     base+0  (compartido, maceta=0)
--   hum_amb:  base+1  (compartido, maceta=0)
--   hum_suelo MAC-m: base+2+(m-1)*2
--   ph MAC-m:         base+3+(m-1)*2

CREATE TABLE IF NOT EXISTS sensores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    pin_conexion VARCHAR(10) NOT NULL,
    maceta_num INT NOT NULL CHECK (maceta_num BETWEEN 0 AND 4),
    dispositivo_id INT NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
    tipo_sensor_id INT NOT NULL REFERENCES tipos_sensores(id),
    estado_operativo VARCHAR(10) DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dispositivo_id, maceta_num, tipo_sensor_id)
);

-- INV-01 (dispositivo_id=1, base=0)
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(0,  'INV01-Temperature',   'GPIO4',    0, 1, 1),
(1,  'INV01-Humidity_Amb',  'GPIO4',    0, 1, 2),
(2,  'INV01-Hum_Suelo_M1',  'MUX-C0',   1, 1, 3),
(3,  'INV01-pH_M1',         'MUX-C1',   1, 1, 4),
(4,  'INV01-Hum_Suelo_M2',  'MUX-C2',   2, 1, 3),
(5,  'INV01-pH_M2',         'MUX-C3',   2, 1, 4),
(6,  'INV01-Hum_Suelo_M3',  'MUX-C4',   3, 1, 3),
(7,  'INV01-pH_M3',         'MUX-C5',   3, 1, 4),
(8,  'INV01-Hum_Suelo_M4',  'MUX-C6',   4, 1, 3),
(9,  'INV01-pH_M4',         'MUX-C7',   4, 1, 4);

-- INV-02 (dispositivo_id=2, base=10)
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(10, 'INV02-Temperature',   'GPIO4',    0, 2, 1),
(11, 'INV02-Humidity_Amb',  'GPIO4',    0, 2, 2),
(12, 'INV02-Hum_Suelo_M1',  'MUX-C0',   1, 2, 3),
(13, 'INV02-pH_M1',         'MUX-C1',   1, 2, 4),
(14, 'INV02-Hum_Suelo_M2',  'MUX-C2',   2, 2, 3),
(15, 'INV02-pH_M2',         'MUX-C3',   2, 2, 4),
(16, 'INV02-Hum_Suelo_M3',  'MUX-C4',   3, 2, 3),
(17, 'INV02-pH_M3',         'MUX-C5',   3, 2, 4),
(18, 'INV02-Hum_Suelo_M4',  'MUX-C6',   4, 2, 3),
(19, 'INV02-pH_M4',         'MUX-C7',   4, 2, 4);

-- INV-03 (dispositivo_id=3, base=20)
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(20, 'INV03-Temperature',   'GPIO4',    0, 3, 1),
(21, 'INV03-Humidity_Amb',  'GPIO4',    0, 3, 2),
(22, 'INV03-Hum_Suelo_M1',  'MUX-C0',   1, 3, 3),
(23, 'INV03-pH_M1',         'MUX-C1',   1, 3, 4),
(24, 'INV03-Hum_Suelo_M2',  'MUX-C2',   2, 3, 3),
(25, 'INV03-pH_M2',         'MUX-C3',   2, 3, 4),
(26, 'INV03-Hum_Suelo_M3',  'MUX-C4',   3, 3, 3),
(27, 'INV03-pH_M3',         'MUX-C5',   3, 3, 4),
(28, 'INV03-Hum_Suelo_M4',  'MUX-C6',   4, 3, 3),
(29, 'INV03-pH_M4',         'MUX-C7',   4, 3, 4);

-- INV-04 (dispositivo_id=4, base=30)
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(30, 'INV04-Temperature',   'GPIO4',    0, 4, 1),
(31, 'INV04-Humidity_Amb',  'GPIO4',    0, 4, 2),
(32, 'INV04-Hum_Suelo_M1',  'MUX-C0',   1, 4, 3),
(33, 'INV04-pH_M1',         'MUX-C1',   1, 4, 4),
(34, 'INV04-Hum_Suelo_M2',  'MUX-C2',   2, 4, 3),
(35, 'INV04-pH_M2',         'MUX-C3',   2, 4, 4),
(36, 'INV04-Hum_Suelo_M3',  'MUX-C4',   3, 4, 3),
(37, 'INV04-pH_M3',         'MUX-C5',   3, 4, 4),
(38, 'INV04-Hum_Suelo_M4',  'MUX-C6',   4, 4, 3),
(39, 'INV04-pH_M4',         'MUX-C7',   4, 4, 4);

-- INV-05 (dispositivo_id=5, base=40)
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(40, 'INV05-Temperature',   'GPIO4',    0, 5, 1),
(41, 'INV05-Humidity_Amb',  'GPIO4',    0, 5, 2),
(42, 'INV05-Hum_Suelo_M1',  'MUX-C0',   1, 5, 3),
(43, 'INV05-pH_M1',         'MUX-C1',   1, 5, 4),
(44, 'INV05-Hum_Suelo_M2',  'MUX-C2',   2, 5, 3),
(45, 'INV05-pH_M2',         'MUX-C3',   2, 5, 4),
(46, 'INV05-Hum_Suelo_M3',  'MUX-C4',   3, 5, 3),
(47, 'INV05-pH_M3',         'MUX-C5',   3, 5, 4),
(48, 'INV05-Hum_Suelo_M4',  'MUX-C6',   4, 5, 3),
(49, 'INV05-pH_M4',         'MUX-C7',   4, 5, 4);

-- Resetear secuencia para que el próximo ID sea 50
ALTER SEQUENCE sensores_id_seq RESTART WITH 50;

-- ============================================================
-- 4. ACTUADORES (3 por maceta × 4 macetas × 5 dispositivos + buzzer global)
-- ============================================================

CREATE TABLE IF NOT EXISTS actuadores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    pin_conexion VARCHAR(10) NOT NULL,
    maceta_num INT NOT NULL CHECK (maceta_num BETWEEN 0 AND 4),
    dispositivo_id INT NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
    tipo_actuador_id INT NOT NULL REFERENCES tipos_actuadores(id),
    modo_operacion VARCHAR(20) DEFAULT 'MANUAL',
    estado_actual VARCHAR(10) DEFAULT 'OFF',
    ultimo_cambio TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dispositivo_id, pin_conexion)
);

-- INV-01
INSERT INTO actuadores (nombre, pin_conexion, maceta_num, dispositivo_id, tipo_actuador_id) VALUES
('Bomba MAC1',       'GPIO32', 1, 1, 1),
('Ventilador MAC1',  'GPIO14', 1, 1, 3),
('Pulverizador MAC1','GPIO5',  1, 1, 2),
('Bomba MAC2',       'GPIO23', 2, 1, 1),
('Ventilador MAC2',  'GPIO0',  2, 1, 3),
('Pulverizador MAC2','GPIO15', 2, 1, 2),
('Bomba MAC3',       'GPIO12', 3, 1, 1),
('Ventilador MAC3',  'GPIO11', 3, 1, 3),
('Pulverizador MAC3','GPIO10', 3, 1, 2),
('Bomba MAC4',       'GPIO8',  4, 1, 1),
('Ventilador MAC4',  'GPIO7',  4, 1, 3),
('Pulverizador MAC4','GPIO6',  4, 1, 2),
('Buzzer Global',    'GPIO26', 0, 1, 4);

-- INV-02
INSERT INTO actuadores (nombre, pin_conexion, maceta_num, dispositivo_id, tipo_actuador_id) VALUES
('Bomba MAC1',       'GPIO32', 1, 2, 1),
('Ventilador MAC1',  'GPIO14', 1, 2, 3),
('Pulverizador MAC1','GPIO5',  1, 2, 2),
('Bomba MAC2',       'GPIO23', 2, 2, 1),
('Ventilador MAC2',  'GPIO0',  2, 2, 3),
('Pulverizador MAC2','GPIO15', 2, 2, 2),
('Bomba MAC3',       'GPIO12', 3, 2, 1),
('Ventilador MAC3',  'GPIO11', 3, 2, 3),
('Pulverizador MAC3','GPIO10', 3, 2, 2),
('Bomba MAC4',       'GPIO8',  4, 2, 1),
('Ventilador MAC4',  'GPIO7',  4, 2, 3),
('Pulverizador MAC4','GPIO6',  4, 2, 2),
('Buzzer Global',    'GPIO26', 0, 2, 4);

-- INV-03
INSERT INTO actuadores (nombre, pin_conexion, maceta_num, dispositivo_id, tipo_actuador_id) VALUES
('Bomba MAC1',       'GPIO32', 1, 3, 1),
('Ventilador MAC1',  'GPIO14', 1, 3, 3),
('Pulverizador MAC1','GPIO5',  1, 3, 2),
('Bomba MAC2',       'GPIO23', 2, 3, 1),
('Ventilador MAC2',  'GPIO0',  2, 3, 3),
('Pulverizador MAC2','GPIO15', 2, 3, 2),
('Bomba MAC3',       'GPIO12', 3, 3, 1),
('Ventilador MAC3',  'GPIO11', 3, 3, 3),
('Pulverizador MAC3','GPIO10', 3, 3, 2),
('Bomba MAC4',       'GPIO8',  4, 3, 1),
('Ventilador MAC4',  'GPIO7',  4, 3, 3),
('Pulverizador MAC4','GPIO6',  4, 3, 2),
('Buzzer Global',    'GPIO26', 0, 3, 4);

-- INV-04
INSERT INTO actuadores (nombre, pin_conexion, maceta_num, dispositivo_id, tipo_actuador_id) VALUES
('Bomba MAC1',       'GPIO32', 1, 4, 1),
('Ventilador MAC1',  'GPIO14', 1, 4, 3),
('Pulverizador MAC1','GPIO5',  1, 4, 2),
('Bomba MAC2',       'GPIO23', 2, 4, 1),
('Ventilador MAC2',  'GPIO0',  2, 4, 3),
('Pulverizador MAC2','GPIO15', 2, 4, 2),
('Bomba MAC3',       'GPIO12', 3, 4, 1),
('Ventilador MAC3',  'GPIO11', 3, 4, 3),
('Pulverizador MAC3','GPIO10', 3, 4, 2),
('Bomba MAC4',       'GPIO8',  4, 4, 1),
('Ventilador MAC4',  'GPIO7',  4, 4, 3),
('Pulverizador MAC4','GPIO6',  4, 4, 2),
('Buzzer Global',    'GPIO26', 0, 4, 4);

-- INV-05
INSERT INTO actuadores (nombre, pin_conexion, maceta_num, dispositivo_id, tipo_actuador_id) VALUES
('Bomba MAC1',       'GPIO32', 1, 5, 1),
('Ventilador MAC1',  'GPIO14', 1, 5, 3),
('Pulverizador MAC1','GPIO5',  1, 5, 2),
('Bomba MAC2',       'GPIO23', 2, 5, 1),
('Ventilador MAC2',  'GPIO0',  2, 5, 3),
('Pulverizador MAC2','GPIO15', 2, 5, 2),
('Bomba MAC3',       'GPIO12', 3, 5, 1),
('Ventilador MAC3',  'GPIO11', 3, 5, 3),
('Pulverizador MAC3','GPIO10', 3, 5, 2),
('Bomba MAC4',       'GPIO8',  4, 5, 1),
('Ventilador MAC4',  'GPIO7',  4, 5, 3),
('Pulverizador MAC4','GPIO6',  4, 5, 2),
('Buzzer Global',    'GPIO26', 0, 5, 4);

-- ============================================================
-- 5. MONITOREO_LECTURAS (tabla de tiempo — datos de sensores)
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoreo_lecturas (
    id BIGSERIAL PRIMARY KEY,
    sensor_id INT NOT NULL REFERENCES sensores(id) ON DELETE CASCADE,
    valor_lectura DECIMAL(10,2) NOT NULL,
    fecha_hora TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_lecturas_sensor       ON monitoreo_lecturas(sensor_id);
CREATE INDEX IF NOT EXISTS idx_lecturas_fecha        ON monitoreo_lecturas(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_lecturas_sensor_fecha ON monitoreo_lecturas(sensor_id, fecha_hora DESC);

-- ============================================================
-- 6. CONTROL_ACTUADORES (cola de comandos)
-- ============================================================

CREATE TABLE IF NOT EXISTS control_actuadores (
    id BIGSERIAL PRIMARY KEY,
    actuador_id INT NOT NULL REFERENCES actuadores(id) ON DELETE CASCADE,
    dispositivo_id INT NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
    nombre_actuador VARCHAR(50) NOT NULL,
    pin_conexion VARCHAR(10) NOT NULL,
    estado_solicitado VARCHAR(10) NOT NULL,
    estado_actual VARCHAR(20) DEFAULT 'PENDIENTE',
    enviado_por VARCHAR(50) DEFAULT 'WEB',
    fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
    fecha_ejecucion TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_control_estado     ON control_actuadores(estado_actual);
CREATE INDEX IF NOT EXISTS idx_control_dispositivo ON control_actuadores(dispositivo_id);

-- ============================================================
-- 7. HISTORIAL_COMANDOS (log de auditoría)
-- ============================================================

CREATE TABLE IF NOT EXISTS historial_comandos (
    id BIGSERIAL PRIMARY KEY,
    actuador_id INT NOT NULL REFERENCES actuadores(id) ON DELETE CASCADE,
    comando VARCHAR(20) NOT NULL,
    valor_anterior VARCHAR(10),
    valor_nuevo VARCHAR(10) NOT NULL,
    enviado_por VARCHAR(50) DEFAULT 'SISTEMA',
    fecha_hora TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comandos_actuador ON historial_comandos(actuador_id);

-- ============================================================
-- 8. CONFIGURACION (umbrales JSONB por dispositivo)
-- ============================================================

CREATE TABLE IF NOT EXISTS configuracion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispositivo_id INTEGER NOT NULL UNIQUE,
    umbrales JSONB NOT NULL DEFAULT '{
        "temp":     {"min": 15, "max": 30},
        "humAmb":   {"min": 30, "max": 85},
        "humSuelo": {"min": 40, "max": 80},
        "ph":       {"min": 5.5, "max": 7.5}
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Umbrales por defecto para los 5 dispositivos
INSERT INTO configuracion (dispositivo_id, umbrales) VALUES
(1, '{"temp":{"min":15,"max":30},"humAmb":{"min":30,"max":85},"humSuelo":{"min":40,"max":80},"ph":{"min":5.5,"max":7.5}}'::jsonb),
(2, '{"temp":{"min":15,"max":30},"humAmb":{"min":30,"max":85},"humSuelo":{"min":40,"max":80},"ph":{"min":5.5,"max":7.5}}'::jsonb),
(3, '{"temp":{"min":15,"max":30},"humAmb":{"min":30,"max":85},"humSuelo":{"min":40,"max":80},"ph":{"min":5.5,"max":7.5}}'::jsonb),
(4, '{"temp":{"min":15,"max":30},"humAmb":{"min":30,"max":85},"humSuelo":{"min":40,"max":80},"ph":{"min":5.5,"max":7.5}}'::jsonb),
(5, '{"temp":{"min":15,"max":30},"humAmb":{"min":30,"max":85},"humSuelo":{"min":40,"max":80},"ph":{"min":5.5,"max":7.5}}'::jsonb);

CREATE INDEX IF NOT EXISTS idx_configuracion_dispositivo ON configuracion(dispositivo_id);

-- ============================================================
-- 9. CONFIGURACION_UMBRALES (relacional, por sector)
-- ============================================================

CREATE TABLE IF NOT EXISTS configuracion_umbrales (
    id SERIAL PRIMARY KEY,
    sector_id INT NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
    parametro VARCHAR(30) NOT NULL,
    valor_minimo DECIMAL(10,2),
    valor_maximo DECIMAL(10,2),
    unidad VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sector_id, parametro)
);

-- 4 parámetros × 5 sectores = 20 filas
INSERT INTO configuracion_umbrales (sector_id, parametro, valor_minimo, valor_maximo, unidad) VALUES
(1, 'temperatura',      15, 30, '°C'),
(1, 'humedad_suelo',    40, 80, '%'),
(1, 'humedad_ambiente', 30, 85, '%'),
(1, 'ph',               5.5, 7.5, 'pH'),
(2, 'temperatura',      15, 30, '°C'),
(2, 'humedad_suelo',    40, 80, '%'),
(2, 'humedad_ambiente', 30, 85, '%'),
(2, 'ph',               5.5, 7.5, 'pH'),
(3, 'temperatura',      15, 30, '°C'),
(3, 'humedad_suelo',    40, 80, '%'),
(3, 'humedad_ambiente', 30, 85, '%'),
(3, 'ph',               5.5, 7.5, 'pH'),
(4, 'temperatura',      15, 30, '°C'),
(4, 'humedad_suelo',    40, 80, '%'),
(4, 'humedad_ambiente', 30, 85, '%'),
(4, 'ph',               5.5, 7.5, 'pH'),
(5, 'temperatura',      15, 30, '°C'),
(5, 'humedad_suelo',    40, 80, '%'),
(5, 'humedad_ambiente', 30, 85, '%'),
(5, 'ph',               5.5, 7.5, 'pH');

-- ============================================================
-- 10. SIMULACION_ALERTAS (overrides de simulación)
-- ============================================================

CREATE TABLE IF NOT EXISTS simulacion_alertas (
    id BIGSERIAL PRIMARY KEY,
    tipo_alerta TEXT NOT NULL,
    sensor_tipo TEXT NOT NULL,
    valor_forzado REAL NOT NULL,
    maceta_numero INTEGER NOT NULL,
    dispositivo_id INTEGER NOT NULL,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. TRIGGERS
-- ============================================================

-- Trigger 1: Auto-actualizar estado del dispositivo al recibir lectura
CREATE OR REPLACE FUNCTION actualizar_ultima_conexion()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE dispositivos
    SET estado_conexion = 'ONLINE', ultima_conexion = NOW()
    WHERE id = (SELECT dispositivo_id FROM sensores WHERE id = NEW.sensor_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lectura_insertada ON monitoreo_lecturas;
CREATE TRIGGER trg_lectura_insertada
    AFTER INSERT ON monitoreo_lecturas
    FOR EACH ROW EXECUTE FUNCTION actualizar_ultima_conexion();

-- Trigger 2: Auto-registrar historial de comandos de actuadores
CREATE OR REPLACE FUNCTION registrar_historial()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO historial_comandos (actuador_id, comando, valor_nuevo, enviado_por)
    VALUES (NEW.actuador_id, NEW.estado_solicitado, NEW.estado_actual, NEW.enviado_por);
    UPDATE actuadores SET estado_actual = NEW.estado_actual, ultimo_cambio = NOW()
    WHERE id = NEW.actuador_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_control_actuador ON control_actuadores;
CREATE TRIGGER trg_control_actuador
    AFTER INSERT ON control_actuadores
    FOR EACH ROW EXECUTE FUNCTION registrar_historial();

-- ============================================================
-- 12. VISTAS
-- ============================================================

-- Vista: últimas lecturas de cada sensor
CREATE OR REPLACE VIEW vista_ultimas_lecturas AS
SELECT
    s.id AS sensor_id,
    s.nombre AS sensor_nombre,
    s.maceta_num,
    ts.nombre AS tipo_sensor,
    ts.unidad_medida,
    d.nombre AS dispositivo,
    sec.nombre AS sector,
    ml.valor_lectura,
    ml.fecha_hora
FROM monitoreo_lecturas ml
JOIN sensores s ON ml.sensor_id = s.id
JOIN tipos_sensores ts ON s.tipo_sensor_id = ts.id
JOIN dispositivos d ON s.dispositivo_id = d.id
JOIN sectores sec ON d.sector_id = sec.id
WHERE ml.fecha_hora = (
    SELECT MAX(ml2.fecha_hora)
    FROM monitoreo_lecturas ml2
    WHERE ml2.sensor_id = s.id
);

-- Vista: estado actual de actuadores
CREATE OR REPLACE VIEW vista_estado_actuadores AS
SELECT
    a.id AS actuador_id,
    a.nombre AS actuador,
    ta.nombre AS tipo,
    a.pin_conexion,
    a.maceta_num,
    a.estado_actual,
    a.ultimo_cambio,
    d.nombre AS dispositivo,
    sec.nombre AS sector
FROM actuadores a
JOIN tipos_actuadores ta ON a.tipo_actuador_id = ta.id
JOIN dispositivos d ON a.dispositivo_id = d.id
JOIN sectores sec ON d.sector_id = sec.id;

-- ============================================================
-- 13. PERMISOS Y RLS
-- ============================================================

-- Permisos service_role (acceso completo)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON vista_ultimas_lecturas TO service_role;
GRANT SELECT ON vista_estado_actuadores TO service_role;

-- Permisos anon (lectura + INSERT en control_actuadores)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON control_actuadores TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- RLS: configuracion (política abierta)
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on configuracion" ON configuracion;
CREATE POLICY "Allow all on configuracion" ON configuracion FOR ALL USING (true) WITH CHECK (true);

-- RLS: simulacion_alertas
ALTER TABLE simulacion_alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON simulacion_alertas;
DROP POLICY IF EXISTS "anon_read" ON simulacion_alertas;
CREATE POLICY "service_role_all" ON simulacion_alertas FOR ALL USING (true);
CREATE POLICY "anon_read" ON simulacion_alertas FOR SELECT USING (true);

-- ============================================================
-- 14. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE monitoreo_lecturas;
ALTER PUBLICATION supabase_realtime ADD TABLE control_actuadores;
ALTER PUBLICATION supabase_realtime ADD TABLE actuadores;
ALTER PUBLICATION supabase_realtime ADD TABLE dispositivos;
ALTER PUBLICATION supabase_realtime ADD TABLE simulacion_alertas;

-- ============================================================
-- FIN — 12 TABLAS + 2 TRIGGERS + 2 VISTAS + 50 SENSORES + 65 ACTUADORES
-- ============================================================
