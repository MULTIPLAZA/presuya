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

// Helper: obtiene la sesión y el perfil, o redirige a login si no hay sesión
export async function requireAuth(redirectTo = 'index.html') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = redirectTo;
        return null;
    }
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
