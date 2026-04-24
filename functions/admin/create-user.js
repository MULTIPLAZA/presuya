// ============================================
// Cloudflare Pages Function
// Ruta: /admin/create-user
//
// GET  → responde { is_admin: bool, user_id } tras validar el token.
// POST → crea un usuario en Supabase con email ya confirmado y
//        un perfil inicial en presu_profiles.
//
// Seguridad:
//   · El caller debe enviar Authorization: Bearer <access_token>.
//   · Validamos el token contra /auth/v1/user.
//   · El user.id devuelto debe estar listado en env.ADMIN_USER_IDS
//     (comma-separated). Si no, 403.
//   · El SERVICE_ROLE_KEY vive sólo en env vars de Cloudflare Pages,
//     nunca sale al browser.
// ============================================

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
}

async function getCallerAdmin(request, env) {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, status: 401, error: 'no_auth' };

    const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!userResp.ok) return { ok: false, status: 401, error: 'invalid_auth' };

    const user = await userResp.json();
    const adminIds = String(env.ADMIN_USER_IDS || '')
        .split(',').map(s => s.trim()).filter(Boolean);

    if (!adminIds.includes(user.id)) {
        return { ok: false, status: 403, error: 'not_admin', user_id: user.id };
    }
    return { ok: true, user_id: user.id, email: user.email };
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const check = await getCallerAdmin(request, env);
    if (!check.ok) {
        return json({ is_admin: false, error: check.error, user_id: check.user_id || null }, check.status);
    }
    return json({ is_admin: true, user_id: check.user_id, email: check.email });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return json({ error: 'server_not_configured' }, 500);
    }

    const check = await getCallerAdmin(request, env);
    if (!check.ok) return json({ error: check.error }, check.status);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'invalid_body' }, 400); }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const nombre_negocio = String(body.nombre_negocio || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'invalid_email' }, 400);
    }
    if (password.length < 6) {
        return json({ error: 'invalid_password' }, 400);
    }
    if (!nombre_negocio) {
        return json({ error: 'invalid_negocio' }, 400);
    }

    // 1. Crear usuario con email ya confirmado
    const createResp = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, email_confirm: true }),
    });

    if (!createResp.ok) {
        const err = await createResp.json().catch(() => ({}));
        const msg = String(err.message || err.msg || '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exist')) {
            return json({ error: 'email_exists' }, 409);
        }
        return json({ error: err.message || err.msg || 'create_failed', details: err }, 400);
    }

    const created = await createResp.json();
    const userId = created.id;

    // 2. Upsert perfil inicial
    const profileResp = await fetch(`${env.SUPABASE_URL}/rest/v1/presu_profiles`, {
        method: 'POST',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
            id: userId,
            nombre_negocio,
            email,
        }),
    });

    // Si el perfil falla, no lo consideramos fatal: ensureProfile
    // lo vuelve a crear la primera vez que el usuario haga login.
    const profile_ok = profileResp.ok;

    return json({
        ok: true,
        user_id: userId,
        email,
        password,
        nombre_negocio,
        profile_ok,
    });
}
