-- ============================================================
-- MIGRACION: agregar planta_id a tabla configuracion
-- Conecta cada configuracion de dispositivo con una planta del
-- catalogo. Nullable para mantener compatibilidad.
-- ============================================================

ALTER TABLE configuracion
    ADD COLUMN IF NOT EXISTS planta_id INTEGER REFERENCES catalogo_plantas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_configuracion_planta ON configuracion(planta_id);

COMMENT ON COLUMN configuracion.planta_id IS
    'FK a catalogo_plantas.id. Una planta por dispositivo (maceta principal).';

-- Permisos
GRANT SELECT, UPDATE ON configuracion TO anon;
GRANT ALL ON configuracion TO service_role;