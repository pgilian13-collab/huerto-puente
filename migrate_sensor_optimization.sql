-- ============================================================
-- Migración: Optimización de almacenamiento de sensores
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla de estado actual (1 fila por sensor por dispositivo)
-- UPSERT: si ya existe, actualiza valor y timestamp
CREATE TABLE IF NOT EXISTS sensor_estado_actual (
    id SERIAL PRIMARY KEY,
    dispositivo_id INTEGER NOT NULL,
    sensor_id INTEGER NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    fecha_hora TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dispositivo_id, sensor_id)
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_estado_dispositivo ON sensor_estado_actual (dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_estado_sensor ON sensor_estado_actual (sensor_id);

-- 2. Tabla de historial reciente (últimas N lecturas por sensor)
CREATE TABLE IF NOT EXISTS sensor_historial (
    id BIGSERIAL PRIMARY KEY,
    dispositivo_id INTEGER NOT NULL,
    sensor_id INTEGER NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    fecha_hora TIMESTAMPTZ DEFAULT NOW()
);

-- Últimas 5 lecturas por sensor (índice compuesto)
CREATE INDEX IF NOT EXISTS idx_historial_lookup ON sensor_historial (dispositivo_id, sensor_id, fecha_hora DESC);

-- 3. RLS: lectura pública, escritura desde service_role
ALTER TABLE sensor_estado_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estado_actual_select" ON sensor_estado_actual;
CREATE POLICY "estado_actual_select" ON sensor_estado_actual FOR SELECT USING (true);

DROP POLICY IF EXISTS "historial_select" ON sensor_historial;
CREATE POLICY "historial_select" ON sensor_historial FOR SELECT USING (true);

-- 4. Realtime para dashboard live
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_estado_actual;

-- 5. Función para limpiar historial antiguo (mantener solo 5 por sensor)
CREATE OR REPLACE FUNCTION cleanup_sensor_historial()
RETURNS void AS $$
BEGIN
    DELETE FROM sensor_historial
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY dispositivo_id, sensor_id
                       ORDER BY fecha_hora DESC
                   ) as rn
            FROM sensor_historial
        ) sub
        WHERE sub.rn > 5
    );
END;
$$ LANGUAGE plpgsql;
