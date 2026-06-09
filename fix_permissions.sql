-- =============================================
-- PERMISOS PARA SERVICE_ROLE
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =============================================

-- Dar permisos COMPLETOS a service_role en todas las tablas
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Permisos sobre las vistas
GRANT SELECT ON vista_ultimas_lecturas TO service_role;
GRANT SELECT ON vista_estado_actuadores TO service_role;
