-- =============================================
-- TABLA: simulacion_alertas
-- Ejecutar en Supabase SQL Editor:
-- https://supabase.com/dashboard/project/nzicdhwoficzsafhdxmq/sql/new
-- =============================================

-- La tabla ya existe, solo necesitas verificar que tenga estos campos:
-- Si falta alguno, ejecuta los comandos ALTER TABLE correspondientes

-- Verificar estructura (ejecutar SELECT para confirmar):
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'simulacion_alertas';

-- Si la tabla NO existe, crearla:
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

-- Habilitar RLS (si no esta habilitado)
ALTER TABLE simulacion_alertas ENABLE ROW LEVEL SECURITY;

-- Permisos (si no existen)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'simulacion_alertas' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON simulacion_alertas FOR ALL USING (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'simulacion_alertas' AND policyname = 'anon_read'
  ) THEN
    CREATE POLICY anon_read ON simulacion_alertas FOR SELECT USING (true);
  END IF;
END $$;

-- Realtime: solo ejecutar si la tabla NO esta en la publicacion
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'simulacion_alertas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE simulacion_alertas;
  END IF;
END $$;
