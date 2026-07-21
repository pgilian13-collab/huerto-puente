-- Migra catalogo_plantas para soportar datos de APIs externas (Perenual + Trefle)
-- Ejecutar ANTES de usar los nuevos endpoints del bridge

-- Nuevas columnas para datos de APIs
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS perenual_id INTEGER;
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS trefle_slug VARCHAR(100);
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS imagen_url TEXT;
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS scientific_name VARCHAR(100);
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS familia VARCHAR(50);
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS watering VARCHAR(20);
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS sunlight VARCHAR(50);
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS care_level VARCHAR(20);
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS growth_rate VARCHAR(20);
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS soil_type VARCHAR(100);
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE catalogo_plantas ADD COLUMN IF NOT EXISTS source_api VARCHAR(10);

-- Cache de respuestas de APIs para no gastar requests
CREATE TABLE IF NOT EXISTS plant_api_cache (
    id SERIAL PRIMARY KEY,
    api_source VARCHAR(10) NOT NULL,
    api_id VARCHAR(50) NOT NULL,
    query_text VARCHAR(100),
    raw_response JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(api_source, api_id)
);

-- Indices para busqueda rapida
CREATE INDEX IF NOT EXISTS idx_cache_source_id ON plant_api_cache(api_source, api_id);
CREATE INDEX IF NOT EXISTS idx_cache_query ON plant_api_cache(query_text);
CREATE INDEX IF NOT EXISTS idx_catalogo_perenual ON catalogo_plantas(perenual_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_trefle ON catalogo_plantas(trefle_slug);

-- RLS para plant_api_cache (solo service_role)
ALTER TABLE plant_api_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only on plant_api_cache" ON plant_api_cache
    FOR ALL USING (true) WITH CHECK (true);

-- Grants
GRANT SELECT ON TABLE public.plant_api_cache TO anon;
