-- ============================================================
-- Migración: Tabla challenge_scores para Huerto Challenge
-- Ejecutar en Supabase SQL Editor
-- Idempotente: funciona si la tabla existe o no
-- ============================================================

-- Crear tabla solo si no existe
CREATE TABLE IF NOT EXISTS challenge_scores (
    id BIGSERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    total_score INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    rounds_played INTEGER NOT NULL DEFAULT 0,
    plant_stage INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la tabla ya existía sin created_at, agregarlo
ALTER TABLE challenge_scores ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Índices para ranking rápido
CREATE INDEX IF NOT EXISTS idx_challenge_scores_score ON challenge_scores (total_score DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_scores_date ON challenge_scores (created_at DESC);

-- RLS: lectura pública, escritura anónima
ALTER TABLE challenge_scores ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a todos (ranking público)
DROP POLICY IF EXISTS "challenge_scores_select" ON challenge_scores;
CREATE POLICY "challenge_scores_select" ON challenge_scores
    FOR SELECT USING (true);

-- Permitir insert desde anon (el juego no tiene auth real)
DROP POLICY IF EXISTS "challenge_scores_insert" ON challenge_scores;
CREATE POLICY "challenge_scores_insert" ON challenge_scores
    FOR INSERT WITH CHECK (true);

-- Realtime (opcional, para ranking live)
ALTER PUBLICATION supabase_realtime ADD TABLE challenge_scores;
