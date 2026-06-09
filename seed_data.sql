-- =============================================
-- LIMPIAR TODO + DATOS INICIALES
-- Copiar y pegar TODO en Supabase SQL Editor
-- =============================================

-- 1. LIMPIAR DATOS (orden por foreign keys)
DELETE FROM historial_comandos;
DELETE FROM monitoreo_lecturas;
DELETE FROM control_actuadores;
DELETE FROM configuracion_umbrales;
DELETE FROM actuadores;
DELETE FROM sensores;
DELETE FROM dispositivos;
DELETE FROM tipos_actuadores;
DELETE FROM tipos_sensores;
DELETE FROM sectores;

-- Resetar secuencias
ALTER SEQUENCE sectores_id_seq RESTART WITH 1;
ALTER SEQUENCE tipos_sensores_id_seq RESTART WITH 1;
ALTER SEQUENCE tipos_actuadores_id_seq RESTART WITH 1;
ALTER SEQUENCE dispositivos_id_seq RESTART WITH 1;
ALTER SEQUENCE sensores_id_seq RESTART WITH 1;
ALTER SEQUENCE actuadores_id_seq RESTART WITH 1;

-- 2. INSERTAR DATOS

INSERT INTO sectores (nombre, descripcion, ubicacion_coordenadas) VALUES
('Invernadero 1', 'Modulo de cultivo 1 - Zona Norte', '10.0.1.0/24'),
('Invernadero 2', 'Modulo de cultivo 2 - Zona Norte', '10.0.2.0/24'),
('Invernadero 3', 'Modulo de cultivo 3 - Zona Sur', '10.0.3.0/24'),
('Invernadero 4', 'Modulo de cultivo 4 - Zona Sur', '10.0.4.0/24'),
('Invernadero 5', 'Modulo de cultivo 5 - Zona Central', '10.0.5.0/24');

INSERT INTO tipos_sensores (nombre, unidad_medida, rango_min, rango_max, descripcion) VALUES
('Temperatura', 'C', -10, 60, 'Sensor DHT22 - Temperatura ambiente'),
('Humedad Ambiente', '%', 0, 100, 'Sensor DHT22 - Humedad relativa'),
('Humedad Suelo', '%', 0, 100, 'Sensor analogico - Humedad del suelo'),
('pH Suelo', 'pH', 0, 14, 'Sensor analogico - Nivel de acidez del suelo');

INSERT INTO tipos_actuadores (nombre, descripcion) VALUES
('Bomba de Agua', 'Relay de bomba de riego por goteo'),
('Pulverizador', 'Relay de pulverizador de techo'),
('Ventilador', 'Relay de ventilador de enfriamiento'),
('Buzzer', 'Alarma sonora de alerta');

INSERT INTO dispositivos (mac_address, nombre, sector_id, ip_address) VALUES
('AA:BB:CC:DD:00:01', 'ESP32-INV1', 1, '10.0.1.10'),
('AA:BB:CC:DD:00:02', 'ESP32-INV2', 2, '10.0.2.10'),
('AA:BB:CC:DD:00:03', 'ESP32-INV3', 3, '10.0.3.10'),
('AA:BB:CC:DD:00:04', 'ESP32-INV4', 4, '10.0.4.10'),
('AA:BB:CC:DD:00:05', 'ESP32-INV5', 5, '10.0.5.10');

INSERT INTO sensores (pin_conexion, dispositivo_id, tipo_sensor_id) VALUES
('GPIO4-T', 1, 1), ('GPIO4-H', 1, 2), ('GPIO34', 1, 3), ('GPIO35', 1, 4),
('GPIO4-T', 2, 1), ('GPIO4-H', 2, 2), ('GPIO34', 2, 3), ('GPIO35', 2, 4),
('GPIO4-T', 3, 1), ('GPIO4-H', 3, 2), ('GPIO34', 3, 3), ('GPIO35', 3, 4),
('GPIO4-T', 4, 1), ('GPIO4-H', 4, 2), ('GPIO34', 4, 3), ('GPIO35', 4, 4),
('GPIO4-T', 5, 1), ('GPIO4-H', 5, 2), ('GPIO34', 5, 3), ('GPIO35', 5, 4);

INSERT INTO actuadores (nombre, pin_conexion, dispositivo_id, tipo_actuador_id) VALUES
('bomba',        'GPIO13', 1, 1), ('pulverizador', 'GPIO14', 1, 2), ('ventilador',   'GPIO5',  1, 3), ('buzzer',       'GPIO26', 1, 4),
('bomba',        'GPIO13', 2, 1), ('pulverizador', 'GPIO14', 2, 2), ('ventilador',   'GPIO5',  2, 3), ('buzzer',       'GPIO26', 2, 4),
('bomba',        'GPIO13', 3, 1), ('pulverizador', 'GPIO14', 3, 2), ('ventilador',   'GPIO5',  3, 3), ('buzzer',       'GPIO26', 3, 4),
('bomba',        'GPIO13', 4, 1), ('pulverizador', 'GPIO14', 4, 2), ('ventilador',   'GPIO5',  4, 3), ('buzzer',       'GPIO26', 4, 4),
('bomba',        'GPIO13', 5, 1), ('pulverizador', 'GPIO14', 5, 2), ('ventilador',   'GPIO5',  5, 3), ('buzzer',       'GPIO26', 5, 4);

INSERT INTO configuracion_umbrales (sector_id, parametro, valor_minimo, valor_maximo, unidad) VALUES
(1, 'temperatura', 15, 30, 'C'), (1, 'ph', 6.0, 7.5, 'pH'), (1, 'humedad_suelo', 40, 80, '%'), (1, 'humedad_ambiente', 30, 85, '%'),
(2, 'temperatura', 15, 30, 'C'), (2, 'ph', 6.0, 7.5, 'pH'), (2, 'humedad_suelo', 40, 80, '%'), (2, 'humedad_ambiente', 30, 85, '%'),
(3, 'temperatura', 15, 30, 'C'), (3, 'ph', 6.0, 7.5, 'pH'), (3, 'humedad_suelo', 40, 80, '%'), (3, 'humedad_ambiente', 30, 85, '%'),
(4, 'temperatura', 15, 30, 'C'), (4, 'ph', 6.0, 7.5, 'pH'), (4, 'humedad_suelo', 40, 80, '%'), (4, 'humedad_ambiente', 30, 85, '%'),
(5, 'temperatura', 15, 30, 'C'), (5, 'ph', 6.0, 7.5, 'pH'), (5, 'humedad_suelo', 40, 80, '%'), (5, 'humedad_ambiente', 30, 85, '%');

-- 3. VERIFICAR
SELECT 'sectores' as tabla, count(*) as total FROM sectores
UNION ALL SELECT 'tipos_sensores', count(*) FROM tipos_sensores
UNION ALL SELECT 'tipos_actuadores', count(*) FROM tipos_actuadores
UNION ALL SELECT 'dispositivos', count(*) FROM dispositivos
UNION ALL SELECT 'sensores', count(*) FROM sensores
UNION ALL SELECT 'actuadores', count(*) FROM actuadores
UNION ALL SELECT 'umbrales', count(*) FROM configuracion_umbrales;
