-- ============================================
-- FIX: Remover trigger en auth.users, mover creación de perfil al cliente
-- ============================================
-- Razón: los triggers sobre auth.users pueden fallar por permisos o contexto
-- de ejecución. Mover la creación del perfil al frontend es más confiable.
-- Ejecutar en SQL Editor de Supabase.
-- ============================================

-- 1. Sacar el trigger y la función (si existen)
DROP TRIGGER IF EXISTS trg_presu_on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS presu_handle_new_user();

-- 2. Agregar policy de INSERT para que el usuario autenticado pueda crear
--    su propio perfil (antes no existía, el trigger lo hacía con SECURITY DEFINER)
DROP POLICY IF EXISTS "presu_profiles_insert_own" ON presu_profiles;
CREATE POLICY "presu_profiles_insert_own" ON presu_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. (Opcional) Si ya había usuarios creados sin perfil por el bug,
--    corremos un backfill manual. Descomenta y ejecuta si hace falta:
-- INSERT INTO presu_profiles (id, nombre_negocio, email)
-- SELECT u.id, 'Mi Negocio', u.email
-- FROM auth.users u
-- WHERE NOT EXISTS (SELECT 1 FROM presu_profiles p WHERE p.id = u.id);
