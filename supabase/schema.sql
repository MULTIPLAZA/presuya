-- ============================================
-- PRESUYA — Schema Supabase
-- Ejecutar en SQL Editor del proyecto Supabase
-- Todas las tablas llevan prefijo presu_ para aislarse de otras apps
-- ============================================

-- ============================================
-- 1. TABLAS
-- ============================================

-- Perfil del negocio (1 por usuario)
CREATE TABLE IF NOT EXISTS presu_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_negocio TEXT NOT NULL,
    ruc TEXT,
    direccion TEXT,
    telefono TEXT,
    email TEXT,
    web TEXT,
    logo_url TEXT,
    color_primario TEXT DEFAULT '#F5A623',
    validez_default INT DEFAULT 15,
    forma_pago_default TEXT DEFAULT 'Contado, transferencia o tarjeta',
    iva_incluido BOOLEAN DEFAULT true,
    next_numero INT DEFAULT 1,
    onboarding_completo BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Presupuestos
CREATE TABLE IF NOT EXISTS presu_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES presu_profiles(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'enviado', 'aprobado', 'rechazado', 'vencido')),

    cliente_nombre TEXT NOT NULL,
    cliente_ruc TEXT,
    cliente_direccion TEXT,
    cliente_whatsapp TEXT,

    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_validez DATE NOT NULL,

    forma_pago TEXT,
    observaciones TEXT,
    total BIGINT NOT NULL DEFAULT 0,

    link_publico_token TEXT UNIQUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presu_budgets_profile ON presu_budgets(profile_id);
CREATE INDEX IF NOT EXISTS idx_presu_budgets_estado ON presu_budgets(profile_id, estado);
CREATE INDEX IF NOT EXISTS idx_presu_budgets_fecha ON presu_budgets(profile_id, fecha_emision DESC);

-- Items de cada presupuesto
CREATE TABLE IF NOT EXISTS presu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES presu_budgets(id) ON DELETE CASCADE,
    orden INT NOT NULL DEFAULT 0,
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
    precio_unitario BIGINT NOT NULL DEFAULT 0,
    subtotal BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presu_items_budget ON presu_items(budget_id, orden);

-- ============================================
-- 2. TRIGGERS
-- ============================================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION presu_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_presu_profiles_updated ON presu_profiles;
CREATE TRIGGER trg_presu_profiles_updated
    BEFORE UPDATE ON presu_profiles
    FOR EACH ROW EXECUTE FUNCTION presu_set_updated_at();

DROP TRIGGER IF EXISTS trg_presu_budgets_updated ON presu_budgets;
CREATE TRIGGER trg_presu_budgets_updated
    BEFORE UPDATE ON presu_budgets
    FOR EACH ROW EXECUTE FUNCTION presu_set_updated_at();

-- NOTA: la creación del perfil se hace desde el cliente JS (ver ensureProfile()
-- en js/supabase-client.js), no por trigger en auth.users. Los triggers sobre
-- auth.users suelen fallar por contexto de permisos y devuelven HTTP 500.

-- Función RPC para obtener el próximo número e incrementar atómicamente
CREATE OR REPLACE FUNCTION presu_next_number(p_profile_id UUID)
RETURNS INT AS $$
DECLARE
    v_num INT;
BEGIN
    UPDATE presu_profiles
    SET next_numero = next_numero + 1
    WHERE id = p_profile_id
    RETURNING next_numero - 1 INTO v_num;
    RETURN v_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalcular subtotal de item y total de presupuesto
CREATE OR REPLACE FUNCTION presu_recalc_budget_total()
RETURNS TRIGGER AS $$
DECLARE
    v_budget_id UUID;
BEGIN
    v_budget_id := COALESCE(NEW.budget_id, OLD.budget_id);
    UPDATE presu_budgets
    SET total = COALESCE((
        SELECT SUM(subtotal) FROM presu_items WHERE budget_id = v_budget_id
    ), 0)
    WHERE id = v_budget_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_presu_items_recalc ON presu_items;
CREATE TRIGGER trg_presu_items_recalc
    AFTER INSERT OR UPDATE OR DELETE ON presu_items
    FOR EACH ROW EXECUTE FUNCTION presu_recalc_budget_total();

-- ============================================
-- 3. RLS (Row Level Security)
-- ============================================

ALTER TABLE presu_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE presu_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE presu_items ENABLE ROW LEVEL SECURITY;

-- Profiles: solo el dueño
DROP POLICY IF EXISTS "presu_profiles_select_own" ON presu_profiles;
CREATE POLICY "presu_profiles_select_own" ON presu_profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "presu_profiles_insert_own" ON presu_profiles;
CREATE POLICY "presu_profiles_insert_own" ON presu_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "presu_profiles_update_own" ON presu_profiles;
CREATE POLICY "presu_profiles_update_own" ON presu_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Budgets: solo propios + lectura pública por token
DROP POLICY IF EXISTS "presu_budgets_select_own" ON presu_budgets;
CREATE POLICY "presu_budgets_select_own" ON presu_budgets
    FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "presu_budgets_insert_own" ON presu_budgets;
CREATE POLICY "presu_budgets_insert_own" ON presu_budgets
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "presu_budgets_update_own" ON presu_budgets;
CREATE POLICY "presu_budgets_update_own" ON presu_budgets
    FOR UPDATE USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "presu_budgets_delete_own" ON presu_budgets;
CREATE POLICY "presu_budgets_delete_own" ON presu_budgets
    FOR DELETE USING (auth.uid() = profile_id);

-- Items: vía budget
DROP POLICY IF EXISTS "presu_items_select_own" ON presu_items;
CREATE POLICY "presu_items_select_own" ON presu_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM presu_budgets b WHERE b.id = budget_id AND b.profile_id = auth.uid())
    );

DROP POLICY IF EXISTS "presu_items_insert_own" ON presu_items;
CREATE POLICY "presu_items_insert_own" ON presu_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM presu_budgets b WHERE b.id = budget_id AND b.profile_id = auth.uid())
    );

DROP POLICY IF EXISTS "presu_items_update_own" ON presu_items;
CREATE POLICY "presu_items_update_own" ON presu_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM presu_budgets b WHERE b.id = budget_id AND b.profile_id = auth.uid())
    );

DROP POLICY IF EXISTS "presu_items_delete_own" ON presu_items;
CREATE POLICY "presu_items_delete_own" ON presu_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM presu_budgets b WHERE b.id = budget_id AND b.profile_id = auth.uid())
    );

-- ============================================
-- 4. STORAGE BUCKET para logos
-- ============================================
-- Ejecutar esto DESPUÉS en el SQL Editor o crear manual en Storage UI:
-- Nombre del bucket: presu-logos · Public: true · File size limit: 500KB

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('presu-logos', 'presu-logos', true, 512000, ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Policies del bucket: cada usuario solo sube/modifica/borra en su propia carpeta {user_id}/
DROP POLICY IF EXISTS "presu_logos_read_public" ON storage.objects;
CREATE POLICY "presu_logos_read_public" ON storage.objects
    FOR SELECT USING (bucket_id = 'presu-logos');

DROP POLICY IF EXISTS "presu_logos_insert_own" ON storage.objects;
CREATE POLICY "presu_logos_insert_own" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'presu-logos'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "presu_logos_update_own" ON storage.objects;
CREATE POLICY "presu_logos_update_own" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'presu-logos'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "presu_logos_delete_own" ON storage.objects;
CREATE POLICY "presu_logos_delete_own" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'presu-logos'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================
-- LISTO — Schema aplicado
-- ============================================
