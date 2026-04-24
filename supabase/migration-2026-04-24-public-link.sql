-- ============================================
-- PRESUYA — Migración 2026-04-24
-- Link público de aprobación (cliente sin cuenta)
--
-- Qué hace:
--   1. RPC presu_get_public_budget(p_token) — devuelve presupuesto + items
--      + datos mínimos del negocio, dado un token. Accesible por anon.
--   2. RPC presu_respond_public_budget(p_token, p_estado) — permite al
--      cliente marcar como 'aprobado' o 'rechazado'. Sólo si estaba en
--      'enviado' o 'borrador'. Accesible por anon.
--
-- Ejecutar UNA SOLA VEZ en el SQL Editor del proyecto Supabase.
-- ============================================

-- ==========================
-- RPC: traer presupuesto público por token
-- ==========================
CREATE OR REPLACE FUNCTION presu_get_public_budget(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF p_token IS NULL OR length(p_token) < 8 THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        'budget', jsonb_build_object(
            'id', b.id,
            'numero', b.numero,
            'estado', b.estado,
            'cliente_nombre', b.cliente_nombre,
            'cliente_ruc', b.cliente_ruc,
            'cliente_direccion', b.cliente_direccion,
            'cliente_whatsapp', b.cliente_whatsapp,
            'fecha_emision', b.fecha_emision,
            'fecha_validez', b.fecha_validez,
            'forma_pago', b.forma_pago,
            'observaciones', b.observaciones,
            'total', b.total
        ),
        'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'orden', i.orden,
                'descripcion', i.descripcion,
                'cantidad', i.cantidad,
                'precio_unitario', i.precio_unitario,
                'subtotal', i.subtotal
            ) ORDER BY i.orden)
            FROM presu_items i WHERE i.budget_id = b.id
        ), '[]'::jsonb),
        'profile', jsonb_build_object(
            'nombre_negocio', p.nombre_negocio,
            'ruc', p.ruc,
            'direccion', p.direccion,
            'telefono', p.telefono,
            'email', p.email,
            'web', p.web,
            'logo_url', p.logo_url,
            'color_primario', p.color_primario
        )
    )
    INTO v_result
    FROM presu_budgets b
    JOIN presu_profiles p ON p.id = b.profile_id
    WHERE b.link_publico_token = p_token;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION presu_get_public_budget(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION presu_get_public_budget(TEXT) TO anon, authenticated;


-- ==========================
-- RPC: responder (aprobar/rechazar) por token
-- ==========================
CREATE OR REPLACE FUNCTION presu_respond_public_budget(p_token TEXT, p_estado TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_budget_id UUID;
    v_current_estado TEXT;
    v_fecha_validez DATE;
BEGIN
    IF p_estado NOT IN ('aprobado', 'rechazado') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'estado_invalido');
    END IF;
    IF p_token IS NULL OR length(p_token) < 8 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
    END IF;

    SELECT id, estado, fecha_validez
    INTO v_budget_id, v_current_estado, v_fecha_validez
    FROM presu_budgets
    WHERE link_publico_token = p_token;

    IF v_budget_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_encontrado');
    END IF;

    IF v_current_estado IN ('aprobado', 'rechazado') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ya_respondido', 'estado', v_current_estado);
    END IF;

    IF v_fecha_validez < CURRENT_DATE THEN
        -- Marcar como vencido y rechazar la respuesta
        UPDATE presu_budgets SET estado = 'vencido' WHERE id = v_budget_id AND estado = 'enviado';
        RETURN jsonb_build_object('ok', false, 'error', 'vencido');
    END IF;

    UPDATE presu_budgets SET estado = p_estado WHERE id = v_budget_id;
    RETURN jsonb_build_object('ok', true, 'estado', p_estado);
END;
$$;

REVOKE ALL ON FUNCTION presu_respond_public_budget(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION presu_respond_public_budget(TEXT, TEXT) TO anon, authenticated;


-- ============================================
-- LISTO
-- ============================================
