-- Fix permisos de configuracion para service_role y anon
GRANT ALL ON TABLE public.configuracion TO service_role;
GRANT ALL ON TABLE public.configuracion TO anon;

-- Fix RLS: recrear policy abierta
DROP POLICY IF EXISTS "Allow all on configuracion" ON configuracion;
DROP POLICY IF EXISTS "Allow public read" ON configuracion;
CREATE POLICY "Allow all on configuracion" ON configuracion
    FOR ALL USING (true) WITH CHECK (true);

-- Tambien aplicar a tablas hermanas que el frontend consulta
GRANT SELECT ON TABLE public.monitoreo_lecturas TO anon;
GRANT SELECT ON TABLE public.sensores TO anon;
GRANT SELECT ON TABLE public.actuadores TO anon;
GRANT SELECT ON TABLE public.catalogo_plantas TO anon;
GRANT INSERT ON TABLE public.control_actuadores TO anon;
GRANT SELECT, INSERT ON TABLE public.simulacion_alertas TO anon;

-- Notificar a PostgREST para recargar schema
SELECT pg_notify('pgrst', 'reload schema');
