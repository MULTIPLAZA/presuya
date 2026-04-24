// ============================================
// Cliente Supabase (ESM desde CDN)
// ============================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    }
});

// Helper: obtiene la sesión y asegura que exista el perfil.
// Redirige a login si no hay sesión.
export async function requireAuth(redirectTo = 'index.html') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = redirectTo;
        return null;
    }
    // Garantizar que tenga perfil (para usuarios creados antes del fix de trigger)
    await ensureProfile(session.user);
    return session;
}

// Helper: obtiene el perfil del usuario actual
export async function getCurrentProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('presu_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    if (error) {
        console.error('Error cargando perfil:', error);
        return null;
    }
    return data;
}

// Helper: logout
export async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// Helper: garantiza que el perfil del usuario exista.
// Se llama después de signup y después de login para cubrir todos los casos
// (usuarios creados antes del fix, nuevos usuarios, etc).
// Usa upsert con ignoreDuplicates para ser idempotente.
export async function ensureProfile(user) {
    if (!user) return null;
    const { data: existing } = await supabase
        .from('presu_profiles')
        .select('id, onboarding_completo')
        .eq('id', user.id)
        .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
        .from('presu_profiles')
        .insert({
            id: user.id,
            nombre_negocio: 'Mi Negocio',
            email: user.email || null,
        })
        .select('id, onboarding_completo')
        .single();

    if (error) {
        console.error('No se pudo crear perfil:', error);
        return null;
    }
    return data;
}
