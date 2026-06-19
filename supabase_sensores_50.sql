-- ============================================
-- TABLA DE SENSORES: 50 registros (IDs 0-49)
-- 5 Invernaderos x 10 sensores cada uno
-- ============================================
-- Layout por invernadero:
--   +0: temp (compartido, maceta=0 para overrides)
--   +1: hum_amb (compartido, maceta=0 para overrides)
--   +2: hum_suelo MAC-1, +3: ph MAC-1
--   +4: hum_suelo MAC-2, +5: ph MAC-2
--   +6: hum_suelo MAC-3, +7: ph MAC-3
--   +8: hum_suelo MAC-4, +9: ph MAC-4

-- Paso 1: Limpiar lecturas viejas (FK constraint)
DELETE FROM monitoreo_lecturas;

-- Paso 2: Eliminar datos viejos de sensores
DELETE FROM sensores;

-- Paso 3: Permitir maceta_num = 0 para sensores compartidos
ALTER TABLE sensores DROP CONSTRAINT IF EXISTS sensores_maceta_num_check;
ALTER TABLE sensores ADD CONSTRAINT sensores_maceta_num_check CHECK (maceta_num BETWEEN 0 AND 4);

-- Paso 4: Insertar 50 sensores con IDs explicitos (0-49)
-- tipo_sensor_id: 1=Temperatura, 2=Humedad Ambiente, 3=Humedad Suelo, 4=pH

-- INV-01
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(0,  'INV01-Temperature',    'GPIO4',   0, 1, 1),
(1,  'INV01-Humidity_Amb',   'GPIO4',   0, 1, 2),
(2,  'INV01-Hum_Suelo_M1',   'MUX-C0',  1, 1, 3),
(3,  'INV01-pH_M1',          'MUX-C1',  1, 1, 4),
(4,  'INV01-Hum_Suelo_M2',   'MUX-C2',  2, 1, 3),
(5,  'INV01-pH_M2',          'MUX-C3',  2, 1, 4),
(6,  'INV01-Hum_Suelo_M3',   'MUX-C4',  3, 1, 3),
(7,  'INV01-pH_M3',          'MUX-C5',  3, 1, 4),
(8,  'INV01-Hum_Suelo_M4',   'MUX-C6',  4, 1, 3),
(9,  'INV01-pH_M4',          'MUX-C7',  4, 1, 4);

-- INV-02
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(10, 'INV02-Temperature',    'GPIO4',   0, 2, 1),
(11, 'INV02-Humidity_Amb',   'GPIO4',   0, 2, 2),
(12, 'INV02-Hum_Suelo_M1',   'MUX-C0',  1, 2, 3),
(13, 'INV02-pH_M1',          'MUX-C1',  1, 2, 4),
(14, 'INV02-Hum_Suelo_M2',   'MUX-C2',  2, 2, 3),
(15, 'INV02-pH_M2',          'MUX-C3',  2, 2, 4),
(16, 'INV02-Hum_Suelo_M3',   'MUX-C4',  3, 2, 3),
(17, 'INV02-pH_M3',          'MUX-C5',  3, 2, 4),
(18, 'INV02-Hum_Suelo_M4',   'MUX-C6',  4, 2, 3),
(19, 'INV02-pH_M4',          'MUX-C7',  4, 2, 4);

-- INV-03
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(20, 'INV03-Temperature',    'GPIO4',   0, 3, 1),
(21, 'INV03-Humidity_Amb',   'GPIO4',   0, 3, 2),
(22, 'INV03-Hum_Suelo_M1',   'MUX-C0',  1, 3, 3),
(23, 'INV03-pH_M1',          'MUX-C1',  1, 3, 4),
(24, 'INV03-Hum_Suelo_M2',   'MUX-C2',  2, 3, 3),
(25, 'INV03-pH_M2',          'MUX-C3',  2, 3, 4),
(26, 'INV03-Hum_Suelo_M3',   'MUX-C4',  3, 3, 3),
(27, 'INV03-pH_M3',          'MUX-C5',  3, 3, 4),
(28, 'INV03-Hum_Suelo_M4',   'MUX-C6',  4, 3, 3),
(29, 'INV03-pH_M4',          'MUX-C7',  4, 3, 4);

-- INV-04
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(30, 'INV04-Temperature',    'GPIO4',   0, 4, 1),
(31, 'INV04-Humidity_Amb',   'GPIO4',   0, 4, 2),
(32, 'INV04-Hum_Suelo_M1',   'MUX-C0',  1, 4, 3),
(33, 'INV04-pH_M1',          'MUX-C1',  1, 4, 4),
(34, 'INV04-Hum_Suelo_M2',   'MUX-C2',  2, 4, 3),
(35, 'INV04-pH_M2',          'MUX-C3',  2, 4, 4),
(36, 'INV04-Hum_Suelo_M3',   'MUX-C4',  3, 4, 3),
(37, 'INV04-pH_M3',          'MUX-C5',  3, 4, 4),
(38, 'INV04-Hum_Suelo_M4',   'MUX-C6',  4, 4, 3),
(39, 'INV04-pH_M4',          'MUX-C7',  4, 4, 4);

-- INV-05
INSERT INTO sensores (id, nombre, pin_conexion, maceta_num, dispositivo_id, tipo_sensor_id) VALUES
(40, 'INV05-Temperature',    'GPIO4',   0, 5, 1),
(41, 'INV05-Humidity_Amb',   'GPIO4',   0, 5, 2),
(42, 'INV05-Hum_Suelo_M1',   'MUX-C0',  1, 5, 3),
(43, 'INV05-pH_M1',          'MUX-C1',  1, 5, 4),
(44, 'INV05-Hum_Suelo_M2',   'MUX-C2',  2, 5, 3),
(45, 'INV05-pH_M2',          'MUX-C3',  2, 5, 4),
(46, 'INV05-Hum_Suelo_M3',   'MUX-C4',  3, 5, 3),
(47, 'INV05-pH_M3',          'MUX-C5',  3, 5, 4),
(48, 'INV05-Hum_Suelo_M4',   'MUX-C6',  4, 5, 3),
(49, 'INV05-pH_M4',          'MUX-C7',  4, 5, 4);

-- Paso 5: Resetear secuencia para que el proximo ID auto-increment sea 50
ALTER SEQUENCE sensores_id_seq RESTART WITH 50;
