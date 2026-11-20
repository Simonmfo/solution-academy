-- ============================================================================
-- CapacitaPro LMS — Permisos GRANT para roles de Supabase (anon, authenticated, service_role)
-- Archivo: supabase/migrations/20261120000001_grant_public_permissions.sql
-- Nota: RLS sigue activo y obligatorio en todas las tablas (27/27).
--       Este script otorga únicamente los privilegios SQL base requeridos por
--       PostgREST/Supabase para evaluar las políticas RLS sin error "permission denied".
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Permisos sobre tablas, vistas, secuencias y funciones para usuarios autenticados (filtrados por RLS) y service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Permiso mínimo para visitantes anónimos: solo validación pública de diplomas por QR
GRANT EXECUTE ON FUNCTION public.verify_certificate(UUID) TO anon;

-- Privilegios por defecto para futuras migraciones
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- Forzar recarga del caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';

