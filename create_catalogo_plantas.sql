-- ============================================================
-- Tabla: catalogo_plantas
-- Catalogo de plantas con rangos optimales de cultivo.
-- El frontend puede leer con anon key; service_role escribe.
-- ============================================================

CREATE TABLE IF NOT EXISTS catalogo_plantas (
    id                SERIAL PRIMARY KEY,
    nombre            VARCHAR(50) NOT NULL UNIQUE,
    temp_min          DECIMAL(4,1),
    temp_max          DECIMAL(4,1),
    hum_suelo_min     DECIMAL(4,1),
    hum_suelo_max     DECIMAL(4,1),
    hum_ambiente_min  DECIMAL(4,1),
    hum_ambiente_max  DECIMAL(4,1),
    ph_min            DECIMAL(3,1),
    ph_max            DECIMAL(3,1),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos para que el frontend pueda leer (anon key)
ALTER TABLE catalogo_plantas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON catalogo_plantas
    FOR SELECT USING (true);

-- Permisos para service_role (escritura)
GRANT SELECT, INSERT ON catalogo_plantas TO service_role;
GRANT USAGE, SELECT ON SEQUENCE catalogo_plantas_id_seq TO service_role;
