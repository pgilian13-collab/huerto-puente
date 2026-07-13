-- Migración: agregar columnas de confirmación a control_actuadores
-- Ejecutar en SQL Editor de Supabase

-- Agregar columnas de seguimiento
ALTER TABLE control_actuadores
  ADD COLUMN IF NOT EXISTS fecha_envio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_confirmacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mensaje_error TEXT;

-- Agregar constraint de estados permitidos
ALTER TABLE control_actuadores
  DROP CONSTRAINT IF EXISTS control_actuadores_estado_check;

ALTER TABLE control_actuadores
  ADD CONSTRAINT control_actuadores_estado_check
  CHECK (estado_actual IN ('PENDIENTE', 'ENVIADO', 'CONFIRMADO', 'ERROR', 'EXPIRADO'));

-- Índice para timeout check
CREATE INDEX IF NOT EXISTS idx_control_enviado
  ON control_actuadores(estado_actual, fecha_envio)
  WHERE estado_actual = 'ENVIADO';
