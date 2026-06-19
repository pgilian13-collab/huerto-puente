-- ============================================
-- TABLA DE SENSORES: 50 registros
-- 5 Invernaderos x 10 sensores cada uno
-- ============================================
-- Layout por invernadero:
--   +0: temp (compartido, maceta=0 para overrides)
--   +1: hum_amb (compartido, maceta=0 para overrides)
--   +2: hum_suelo MAC-1, +3: ph MAC-1
--   +4: hum_suelo MAC-2, +5: ph MAC-2
--   +6: hum_suelo MAC-3, +7: ph MAC-3
--   +8: hum_suelo MAC-4, +9: ph MAC-4

DELETE FROM sensores;

-- INV-01 (sensor_id 1-10)
INSERT INTO sensores (sensor_id, dispositivo_id, nombre, tipo, maceta_numero, unidad) VALUES
(1,  1, 'INV01-Temperature',    'temp',     0, '°C'),
(2,  1, 'INV01-Humidity_Amb',   'hum_amb',  0, '%'),
(3,  1, 'INV01-Hum_Suelo_M1',   'hum_suelo',1, '%'),
(4,  1, 'INV01-pH_M1',          'ph',       1, 'pH'),
(5,  1, 'INV01-Hum_Suelo_M2',   'hum_suelo',2, '%'),
(6,  1, 'INV01-pH_M2',          'ph',       2, 'pH'),
(7,  1, 'INV01-Hum_Suelo_M3',   'hum_suelo',3, '%'),
(8,  1, 'INV01-pH_M3',          'ph',       3, 'pH'),
(9,  1, 'INV01-Hum_Suelo_M4',   'hum_suelo',4, '%'),
(10, 1, 'INV01-pH_M4',          'ph',       4, 'pH');

-- INV-02 (sensor_id 11-20)
INSERT INTO sensores (sensor_id, dispositivo_id, nombre, tipo, maceta_numero, unidad) VALUES
(11, 2, 'INV02-Temperature',    'temp',     0, '°C'),
(12, 2, 'INV02-Humidity_Amb',   'hum_amb',  0, '%'),
(13, 2, 'INV02-Hum_Suelo_M1',   'hum_suelo',1, '%'),
(14, 2, 'INV02-pH_M1',          'ph',       1, 'pH'),
(15, 2, 'INV02-Hum_Suelo_M2',   'hum_suelo',2, '%'),
(16, 2, 'INV02-pH_M2',          'ph',       2, 'pH'),
(17, 2, 'INV02-Hum_Suelo_M3',   'hum_suelo',3, '%'),
(18, 2, 'INV02-pH_M3',          'ph',       3, 'pH'),
(19, 2, 'INV02-Hum_Suelo_M4',   'hum_suelo',4, '%'),
(20, 2, 'INV02-pH_M4',          'ph',       4, 'pH');

-- INV-03 (sensor_id 21-30)
INSERT INTO sensores (sensor_id, dispositivo_id, nombre, tipo, maceta_numero, unidad) VALUES
(21, 3, 'INV03-Temperature',    'temp',     0, '°C'),
(22, 3, 'INV03-Humidity_Amb',   'hum_amb',  0, '%'),
(23, 3, 'INV03-Hum_Suelo_M1',   'hum_suelo',1, '%'),
(24, 3, 'INV03-pH_M1',          'ph',       1, 'pH'),
(25, 3, 'INV03-Hum_Suelo_M2',   'hum_suelo',2, '%'),
(26, 3, 'INV03-pH_M2',          'ph',       2, 'pH'),
(27, 3, 'INV03-Hum_Suelo_M3',   'hum_suelo',3, '%'),
(28, 3, 'INV03-pH_M3',          'ph',       3, 'pH'),
(29, 3, 'INV03-Hum_Suelo_M4',   'hum_suelo',4, '%'),
(30, 3, 'INV03-pH_M4',          'ph',       4, 'pH');

-- INV-04 (sensor_id 31-40)
INSERT INTO sensores (sensor_id, dispositivo_id, nombre, tipo, maceta_numero, unidad) VALUES
(31, 4, 'INV04-Temperature',    'temp',     0, '°C'),
(32, 4, 'INV04-Humidity_Amb',   'hum_amb',  0, '%'),
(33, 4, 'INV04-Hum_Suelo_M1',   'hum_suelo',1, '%'),
(34, 4, 'INV04-pH_M1',          'ph',       1, 'pH'),
(35, 4, 'INV04-Hum_Suelo_M2',   'hum_suelo',2, '%'),
(36, 4, 'INV04-pH_M2',          'ph',       2, 'pH'),
(37, 4, 'INV04-Hum_Suelo_M3',   'hum_suelo',3, '%'),
(38, 4, 'INV04-pH_M3',          'ph',       3, 'pH'),
(39, 4, 'INV04-Hum_Suelo_M4',   'hum_suelo',4, '%'),
(40, 4, 'INV04-pH_M4',          'ph',       4, 'pH');

-- INV-05 (sensor_id 41-50)
INSERT INTO sensores (sensor_id, dispositivo_id, nombre, tipo, maceta_numero, unidad) VALUES
(41, 5, 'INV05-Temperature',    'temp',     0, '°C'),
(42, 5, 'INV05-Humidity_Amb',   'hum_amb',  0, '%'),
(43, 5, 'INV05-Hum_Suelo_M1',   'hum_suelo',1, '%'),
(44, 5, 'INV05-pH_M1',          'ph',       1, 'pH'),
(45, 5, 'INV05-Hum_Suelo_M2',   'hum_suelo',2, '%'),
(46, 5, 'INV05-pH_M2',          'ph',       2, 'pH'),
(47, 5, 'INV05-Hum_Suelo_M3',   'hum_suelo',3, '%'),
(48, 5, 'INV05-pH_M3',          'ph',       3, 'pH'),
(49, 5, 'INV05-Hum_Suelo_M4',   'hum_suelo',4, '%'),
(50, 5, 'INV05-pH_M4',          'ph',       4, 'pH');
