// ============================================
// Login + Forgot Password
// (El signup público está desactivado — las cuentas
//  se crean desde admin/create-user.mjs)
// ============================================
import { supabase, ensureProfile } from './supabase-client.js';
import { $, toast, showLoading } from './ui.js';
import { applyBrandColor } from './branding.js';

// Si ya hay sesión, asegurar perfil y redirigir
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const profile = await ensureProfile(session.user);
        if (profile && profile.color_primario) applyBrandColor(profile.color_primario);
        window.location.href = (profile && profile.onboarding_completo) ? 'dashboard.html' : 'perfil.html?onboarding=1';
    }
})();

// Login
$('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;

    showLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    showLoading(false);

    if (error) {
        toast(traducirError(error.message), 'error');
        return;
    }

    const profile = await ensureProfile(data.user);
    if (profile && profile.color_primario) applyBrandColor(profile.color_primario);
    window.location.href = (profile && profile.onboarding_completo) ? 'dashboard.html' : 'perfil.html?onboarding=1';
});

// Forgot
$('#forgotPwd').addEventListener('click', async () => {
    const email = $('#loginEmail').value.trim();
    if (!email) {
        toast('Cargá tu email primero', 'error');
        $('#loginEmail').focus();
        return;
    }
    showLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/index.html'
    });
    showLoading(false);
    if (error) toast(traducirError(error.message), 'error');
    else toast('Te mandamos un email para resetear la contraseña', 'success');
});

function traducirError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid login')) return 'Email o contraseña incorrectos';
    if (m.includes('email rate limit')) return 'Demasiados intentos. Probá en unos minutos';
    if (m.includes('password')) return 'La contraseña es muy corta o inválida';
    return msg || 'Ocurrió un error';
}
