-- ============================================================
-- SISTEMA DE RIEGO INTELIGENTE - HUERTO UNIVERSITARIO
-- 5 Invernaderos x 4 Macetas x 4 Sensores = 100 Sensores
-- 5 Invernaderos x (4 Macetas x 3 Actuadores + 1 Buzzer) = 65 Actuadores
-- ============================================================

CREATE TABLE sectores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    ubicacion_coordenadas VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tipos_sensores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    unidad_medida VARCHAR(20) NOT NULL,
    rango_min DECIMAL(10,2),
    rango_max DECIMAL(10,2),
    descripcion TEXT
);

CREATE TABLE tipos_actuadores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE dispositivos (
    id SERIAL PRIMARY KEY,
    mac_address VARCHAR(17) NOT NULL UNIQUE,
    nombre VARCHAR(50) NOT NULL,
    sector_id INT NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
    ip_address VARCHAR(15),
    estado_conexion VARCHAR(10) DEFAULT 'OFFLINE',
    ultima_conexion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sensores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    pin_conexion VARCHAR(10) NOT NULL,
    maceta_num INT NOT NULL CHECK (maceta_num BETWEEN 1 AND 4),
    dispositivo_id INT NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
    tipo_sensor_id INT NOT NULL REFERENCES tipos_sensores(id),
    estado_operativo VARCHAR(10) DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dispositivo_id, maceta_num, tipo_sensor_id)
);

CREATE TABLE actuadores (
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

CREATE TABLE monitoreo_lecturas (
    id BIGSERIAL PRIMARY KEY,
    sensor_id INT NOT NULL REFERENCES sensores(id) ON DELETE CASCADE,
    valor_lectura DECIMAL(10,2) NOT NULL,
    fecha_hora TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE control_actuadores (
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

CREATE TABLE historial_comandos (
    id BIGSERIAL PRIMARY KEY,
    actuador_id INT NOT NULL REFERENCES actuadores(id) ON DELETE CASCADE,
    comando VARCHAR(20) NOT NULL,
    valor_anterior VARCHAR(10),
    valor_nuevo VARCHAR(10) NOT NULL,
    enviado_por VARCHAR(50) DEFAULT 'SISTEMA',
    fecha_hora TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE configuracion_umbrales (
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

-- Indices
CREATE INDEX idx_lecturas_sensor ON monitoreo_lecturas(sensor_id);
CREATE INDEX idx_lecturas_fecha ON monitoreo_lecturas(fecha_hora DESC);
CREATE INDEX idx_lecturas_sensor_fecha ON monitoreo_lecturas(sensor_id, fecha_hora DESC);
CREATE INDEX idx_dispositivos_sector ON dispositivos(sector_id);
CREATE INDEX idx_sensores_dispositivo ON sensores(dispositivo_id);
CREATE INDEX idx_sensores_maceta ON sensores(dispositivo_id, maceta_num);
CREATE INDEX idx_actuadores_dispositivo ON actuadores(dispositivo_id);
CREATE INDEX idx_control_estado ON control_actuadores(estado_actual);
CREATE INDEX idx_control_dispositivo ON control_actuadores(dispositivo_id);
CREATE INDEX idx_comandos_actuador ON historial_comandos(actuador_id);
CREATE INDEX idx_umbrales_sector ON configuracion_umbrales(sector_id);

-- Triggers
CREATE OR REPLACE FUNCTION actualizar_ultima_conexion()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE dispositivos
    SET estado_conexion = 'ONLINE', ultima_conexion = NOW()
    WHERE id = (SELECT dispositivo_id FROM sensores WHERE id = NEW.sensor_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lectura_insertada
    AFTER INSERT ON monitoreo_lecturas
    FOR EACH ROW EXECUTE FUNCTION actualizar_ultima_conexion();

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

CREATE TRIGGER trg_control_actuador
    AFTER INSERT ON control_actuadores
    FOR EACH ROW EXECUTE FUNCTION registrar_historial();

-- ============================================================
-- DATOS
-- ============================================================

INSERT INTO sectores (nombre, descripcion, ubicacion_coordenadas) VALUES
('Invernadero 1', 'Modulo de cultivo 1 - Zona Norte', '10.0.1.0/24'),
('Invernadero 2', 'Modulo de cultivo 2 - Zona Norte', '10.0.2.0/24'),
('Invernadero 3', 'Modulo de cultivo 3 - Zona Sur', '10.0.3.0/24'),
('Invernadero 4', 'Modulo de cultivo 4 - Zona Sur', '10.0.4.0/24'),
('Invernadero 5', 'Modulo de cultivo 5 - Zona Central', '10.0.5.0/24');

INSERT INTO tipos_sensores (nombre, unidad_medida, rango_min, rango_max, descripcion) VALUES
('Temperatura',      '°C', -10,  60,  'Sensor DHT22 - Temperatura ambiente'),
('Humedad Ambiente', '%',   0,  100,  'Sensor DHT22 - Humedad relativa'),
('Humedad Suelo',    '%',   0,  100,  'Sensor analogico capacitivo - Humedad del suelo'),
('pH',               'pH',  0,   14,  'Sensor analogico pH - Acidez/Alcalinidad del suelo');

INSERT INTO tipos_actuadores (nombre, descripcion) VALUES
('Bomba de Agua',   'Relay de bomba de riego por goteo'),
('Pulverizador',    'Relay de pulverizador de techo'),
('Ventilador',      'Relay de ventilador de enfriamiento'),
('Buzzer',          'Alarma sonora de alerta');

INSERT INTO dispositivos (mac_address, nombre, sector_id, ip_address) VALUES
('AA:BB:CC:DD:00:01', 'ESP32-INV1', 1, '10.0.1.10'),
('AA:BB:CC:DD:00:02', 'ESP32-INV2', 2, '10.0.2.10'),
('AA:BB:CC:DD:00:03', 'ESP32-INV3', 3, '10.0.3.10'),
('AA:BB:CC:DD:00:04', 'ESP32-INV4', 4, '10.0.4.10'),
('AA:BB:CC:DD:00:05', 'ESP32-INV5', 5, '10.0.5.10');

-- Sensores: 4 tipos x 4 macetas x 5 inv = 100
-- Dentro de cada maceta: 1=Temp, 2=HumAmb, 3=HumSuelo, 4=pH
-- INV1: sensores 1-16, INV2: 17-32, INV3: 33-48, INV4: 49-64, INV5: 65-80
INSERT INTO sensores (nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
-- INV1
('INV1-M1-Temp',     'GPIO4',  1, 1, 1), ('INV1-M1-HumAmb',   'GPIO4',  1, 1, 2), ('INV1-M1-HumSuelo', 'MUX-C0', 1, 1, 3), ('INV1-M1-pH',       'MUX-C1', 1, 1, 4),
('INV1-M2-Temp',     'GPIO19', 2, 1, 1), ('INV1-M2-HumAmb',   'GPIO19', 2, 1, 2), ('INV1-M2-HumSuelo', 'MUX-C2', 2, 1, 3), ('INV1-M2-pH',       'MUX-C3', 2, 1, 4),
('INV1-M3-Temp',     'GPIO2',  3, 1, 1), ('INV1-M3-HumAmb',   'GPIO2',  3, 1, 2), ('INV1-M3-HumSuelo', 'MUX-C4', 3, 1, 3), ('INV1-M3-pH',       'MUX-C5', 3, 1, 4),
('INV1-M4-Temp',     'GPIO9',  4, 1, 1), ('INV1-M4-HumAmb',   'GPIO9',  4, 1, 2), ('INV1-M4-HumSuelo', 'MUX-C6', 4, 1, 3), ('INV1-M4-pH',       'MUX-C7', 4, 1, 4),
-- INV2
('INV2-M1-Temp',     'GPIO4',  1, 2, 1), ('INV2-M1-HumAmb',   'GPIO4',  1, 2, 2), ('INV2-M1-HumSuelo', 'MUX-C0', 1, 2, 3), ('INV2-M1-pH',       'MUX-C1', 1, 2, 4),
('INV2-M2-Temp',     'GPIO19', 2, 2, 1), ('INV2-M2-HumAmb',   'GPIO19', 2, 2, 2), ('INV2-M2-HumSuelo', 'MUX-C2', 2, 2, 3), ('INV2-M2-pH',       'MUX-C3', 2, 2, 4),
('INV2-M3-Temp',     'GPIO2',  3, 2, 1), ('INV2-M3-HumAmb',   'GPIO2',  3, 2, 2), ('INV2-M3-HumSuelo', 'MUX-C4', 3, 2, 3), ('INV2-M3-pH',       'MUX-C5', 3, 2, 4),
('INV2-M4-Temp',     'GPIO9',  4, 2, 1), ('INV2-M4-HumAmb',   'GPIO9',  4, 2, 2), ('INV2-M4-HumSuelo', 'MUX-C6', 4, 2, 3), ('INV2-M4-pH',       'MUX-C7', 4, 2, 4),
-- INV3
('INV3-M1-Temp',     'GPIO4',  1, 3, 1), ('INV3-M1-HumAmb',   'GPIO4',  1, 3, 2), ('INV3-M1-HumSuelo', 'MUX-C0', 1, 3, 3), ('INV3-M1-pH',       'MUX-C1', 1, 3, 4),
('INV3-M2-Temp',     'GPIO19', 2, 3, 1), ('INV3-M2-HumAmb',   'GPIO19', 2, 3, 2), ('INV3-M2-HumSuelo', 'MUX-C2', 2, 3, 3), ('INV3-M2-pH',       'MUX-C3', 2, 3, 4),
('INV3-M3-Temp',     'GPIO2',  3, 3, 1), ('INV3-M3-HumAmb',   'GPIO2',  3, 3, 2), ('INV3-M3-HumSuelo', 'MUX-C4', 3, 3, 3), ('INV3-M3-pH',       'MUX-C5', 3, 3, 4),
('INV3-M4-Temp',     'GPIO9',  4, 3, 1), ('INV3-M4-HumAmb',   'GPIO9',  4, 3, 2), ('INV3-M4-HumSuelo', 'MUX-C6', 4, 3, 3), ('INV3-M4-pH',       'MUX-C7', 4, 3, 4),
-- INV4
('INV4-M1-Temp',     'GPIO4',  1, 4, 1), ('INV4-M1-HumAmb',   'GPIO4',  1, 4, 2), ('INV4-M1-HumSuelo', 'MUX-C0', 1, 4, 3), ('INV4-M1-pH',       'MUX-C1', 1, 4, 4),
('INV4-M2-Temp',     'GPIO19', 2, 4, 1), ('INV4-M2-HumAmb',   'GPIO19', 2, 4, 2), ('INV4-M2-HumSuelo', 'MUX-C2', 2, 4, 3), ('INV4-M2-pH',       'MUX-C3', 2, 4, 4),
('INV4-M3-Temp',     'GPIO2',  3, 4, 1), ('INV4-M3-HumAmb',   'GPIO2',  3, 4, 2), ('INV4-M3-HumSuelo', 'MUX-C4', 3, 4, 3), ('INV4-M3-pH',       'MUX-C5', 3, 4, 4),
('INV4-M4-Temp',     'GPIO9',  4, 4, 1), ('INV4-M4-HumAmb',   'GPIO9',  4, 4, 2), ('INV4-M4-HumSuelo', 'MUX-C6', 4, 4, 3), ('INV4-M4-pH',       'MUX-C7', 4, 4, 4),
-- INV5
('INV5-M1-Temp',     'GPIO4',  1, 5, 1), ('INV5-M1-HumAmb',   'GPIO4',  1, 5, 2), ('INV5-M1-HumSuelo', 'MUX-C0', 1, 5, 3), ('INV5-M1-pH',       'MUX-C1', 1, 5, 4),
('INV5-M2-Temp',     'GPIO19', 2, 5, 1), ('INV5-M2-HumAmb',   'GPIO19', 2, 5, 2), ('INV5-M2-HumSuelo', 'MUX-C2', 2, 5, 3), ('INV5-M2-pH',       'MUX-C3', 2, 5, 4),
('INV5-M3-Temp',     'GPIO2',  3, 5, 1), ('INV5-M3-HumAmb',   'GPIO2',  3, 5, 2), ('INV5-M3-HumSuelo', 'MUX-C4', 3, 5, 3), ('INV5-M3-pH',       'MUX-C5', 3, 5, 4),
('INV5-M4-Temp',     'GPIO9',  4, 5, 1), ('INV5-M4-HumAmb',   'GPIO9',  4, 5, 2), ('INV5-M4-HumSuelo', 'MUX-C6', 4, 5, 3), ('INV5-M4-pH',       'MUX-C7', 4, 5, 4);

-- Actuadores: (4 macetas x 3 actuadores + 1 buzzer) x 5 inv = 65
-- maceta_num: 0=Buzzer (compartido), 1-4=Maceta
-- INV1: actuadores 1-13, INV2: 14-26, INV3: 27-39, INV4: 40-52, INV5: 53-65
INSERT INTO actuadores (nombre, pin_conexion, maceta_num, dispositivo_id, tipo_actuador_id) VALUES
-- INV1
('bomba',        'GPIO13', 1, 1, 1), ('ventilador',   'GPIO14', 1, 1, 3), ('pulverizador', 'GPIO5',  1, 1, 2),
('bomba',        'GPIO23', 2, 1, 1), ('ventilador',   'GPIO0',  2, 1, 3), ('pulverizador', 'GPIO15', 2, 1, 2),
('bomba',        'GPIO12', 3, 1, 1), ('ventilador',   'GPIO11', 3, 1, 3), ('pulverizador', 'GPIO10', 3, 1, 2),
('bomba',        'GPIO8',  4, 1, 1), ('ventilador',   'GPIO7',  4, 1, 3), ('pulverizador', 'GPIO6',  4, 1, 2),
('buzzer',       'GPIO26', 0, 1, 4),
-- INV2
('bomba',        'GPIO13', 1, 2, 1), ('ventilador',   'GPIO14', 1, 2, 3), ('pulverizador', 'GPIO5',  1, 2, 2),
('bomba',        'GPIO23', 2, 2, 1), ('ventilador',   'GPIO0',  2, 2, 3), ('pulverizador', 'GPIO15', 2, 2, 2),
('bomba',        'GPIO12', 3, 2, 1), ('ventilador',   'GPIO11', 3, 2, 3), ('pulverizador', 'GPIO10', 3, 2, 2),
('bomba',        'GPIO8',  4, 2, 1), ('ventilador',   'GPIO7',  4, 2, 3), ('pulverizador', 'GPIO6',  4, 2, 2),
('buzzer',       'GPIO26', 0, 2, 4),
-- INV3
('bomba',        'GPIO13', 1, 3, 1), ('ventilador',   'GPIO14', 1, 3, 3), ('pulverizador', 'GPIO5',  1, 3, 2),
('bomba',        'GPIO23', 2, 3, 1), ('ventilador',   'GPIO0',  2, 3, 3), ('pulverizador', 'GPIO15', 2, 3, 2),
('bomba',        'GPIO12', 3, 3, 1), ('ventilador',   'GPIO11', 3, 3, 3), ('pulverizador', 'GPIO10', 3, 3, 2),
('bomba',        'GPIO8',  4, 3, 1), ('ventilador',   'GPIO7',  4, 3, 3), ('pulverizador', 'GPIO6',  4, 3, 2),
('buzzer',       'GPIO26', 0, 3, 4),
-- INV4
('bomba',        'GPIO13', 1, 4, 1), ('ventilador',   'GPIO14', 1, 4, 3), ('pulverizador', 'GPIO5',  1, 4, 2),
('bomba',        'GPIO23', 2, 4, 1), ('ventilador',   'GPIO0',  2, 4, 3), ('pulverizador', 'GPIO15', 2, 4, 2),
('bomba',        'GPIO12', 3, 4, 1), ('ventilador',   'GPIO11', 3, 4, 3), ('pulverizador', 'GPIO10', 3, 4, 2),
('bomba',        'GPIO8',  4, 4, 1), ('ventilador',   'GPIO7',  4, 4, 3), ('pulverizador', 'GPIO6',  4, 4, 2),
('buzzer',       'GPIO26', 0, 4, 4),
-- INV5
('bomba',        'GPIO13', 1, 5, 1), ('ventilador',   'GPIO14', 1, 5, 3), ('pulverizador', 'GPIO5',  1, 5, 2),
('bomba',        'GPIO23', 2, 5, 1), ('ventilador',   'GPIO0',  2, 5, 3), ('pulverizador', 'GPIO15', 2, 5, 2),
('bomba',        'GPIO12', 3, 5, 1), ('ventilador',   'GPIO11', 3, 5, 3), ('pulverizador', 'GPIO10', 3, 5, 2),
('bomba',        'GPIO8',  4, 5, 1), ('ventilador',   'GPIO7',  4, 5, 3), ('pulverizador', 'GPIO6',  4, 5, 2),
('buzzer',       'GPIO26', 0, 5, 4);

INSERT INTO configuracion_umbrales (sector_id, parametro, valor_minimo, valor_maximo, unidad) VALUES
(1, 'temperatura', 15, 30, '°C'), (1, 'humedad_suelo', 40, 80, '%'), (1, 'humedad_ambiente', 30, 85, '%'), (1, 'ph', 5.5, 7.5, 'pH'),
(2, 'temperatura', 15, 30, '°C'), (2, 'humedad_suelo', 40, 80, '%'), (2, 'humedad_ambiente', 30, 85, '%'), (2, 'ph', 5.5, 7.5, 'pH'),
(3, 'temperatura', 15, 30, '°C'), (3, 'humedad_suelo', 40, 80, '%'), (3, 'humedad_ambiente', 30, 85, '%'), (3, 'ph', 5.5, 7.5, 'pH'),
(4, 'temperatura', 15, 30, '°C'), (4, 'humedad_suelo', 40, 80, '%'), (4, 'humedad_ambiente', 30, 85, '%'), (4, 'ph', 5.5, 7.5, 'pH'),
(5, 'temperatura', 15, 30, '°C'), (5, 'humedad_suelo', 40, 80, '%'), (5, 'humedad_ambiente', 30, 85, '%'), (5, 'ph', 5.5, 7.5, 'pH');

-- Vistas
CREATE OR REPLACE VIEW vista_ultimas_lecturas AS
SELECT s.id AS sensor_id, s.nombre AS sensor_nombre, s.maceta_num,
       ts.nombre AS tipo_sensor, ts.unidad_medida,
       d.nombre AS dispositivo, sec.nombre AS sector,
       ml.valor_lectura, ml.fecha_hora
FROM monitoreo_lecturas ml
JOIN sensores s ON ml.sensor_id = s.id
JOIN tipos_sensores ts ON s.tipo_sensor_id = ts.id
JOIN dispositivos d ON s.dispositivo_id = d.id
JOIN sectores sec ON d.sector_id = sec.id
WHERE ml.fecha_hora = (SELECT MAX(ml2.fecha_hora) FROM monitoreo_lecturas ml2 WHERE ml2.sensor_id = s.id);

CREATE OR REPLACE VIEW vista_estado_actuadores AS
SELECT a.id AS actuador_id, a.nombre AS actuador, ta.nombre AS tipo,
       a.pin_conexion, a.maceta_num, a.estado_actual, a.ultimo_cambio,
       d.nombre AS dispositivo, sec.nombre AS sector
FROM actuadores a
JOIN tipos_actuadores ta ON a.tipo_actuador_id = ta.id
JOIN dispositivos d ON a.dispositivo_id = d.id
JOIN sectores sec ON d.sector_id = sec.id;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE monitoreo_lecturas;
ALTER PUBLICATION supabase_realtime ADD TABLE control_actuadores;
ALTER PUBLICATION supabase_realtime ADD TABLE actuadores;
ALTER PUBLICATION supabase_realtime ADD TABLE dispositivos;

-- Permisos
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON control_actuadores TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
