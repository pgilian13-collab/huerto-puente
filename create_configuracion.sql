CREATE TABLE IF NOT EXISTS configuracion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispositivo_id INTEGER NOT NULL,
    umbrales JSONB NOT NULL DEFAULT '{
        "temp": {"min": 15, "max": 30},
        "humAmb": {"min": 30, "max": 85},
        "humSuelo": {"min": 40, "max": 80},
        "ph": {"min": 5.5, "max": 7.5}
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dispositivo_id)
);

ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on configuracion" ON configuracion FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_configuracion_dispositivo ON configuracion(dispositivo_id);
