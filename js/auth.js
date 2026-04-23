// ============================================
// Login / Signup / Forgot Password
// ============================================
import { supabase } from './supabase-client.js';
import { $, $$, toast, showLoading } from './ui.js';

// Si ya hay sesión, ir directo al dashboard
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // Verificar si ya completó onboarding
        const { data: profile } = await supabase
            .from('presu_profiles')
            .select('onboarding_completo')
            .eq('id', session.user.id)
            .single();
        window.location.href = (profile && profile.onboarding_completo) ? 'dashboard.html' : 'perfil.html?onboarding=1';
    }
})();

// Tabs
$$('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        $$('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const which = tab.dataset.tab;
        $('#loginForm').classList.toggle('hidden', which !== 'login');
        $('#signupForm').classList.toggle('hidden', which !== 'signup');
    });
});

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

    // Checkear onboarding
    const { data: profile } = await supabase
        .from('presu_profiles')
        .select('onboarding_completo')
        .eq('id', data.user.id)
        .single();

    window.location.href = (profile && profile.onboarding_completo) ? 'dashboard.html' : 'perfil.html?onboarding=1';
});

// Signup
$('#signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#signupEmail').value.trim();
    const password = $('#signupPassword').value;

    showLoading(true);
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + '/index.html' }
    });
    showLoading(false);

    if (error) {
        toast(traducirError(error.message), 'error');
        return;
    }

    if (data.session) {
        // Autenticado directamente (cuando el proyecto Supabase no exige confirmación de email)
        window.location.href = 'perfil.html?onboarding=1';
    } else {
        toast('Te mandamos un email para confirmar la cuenta.', 'success');
    }
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
    if (m.includes('already registered')) return 'Ese email ya tiene cuenta, ingresá';
    if (m.includes('email rate limit')) return 'Demasiados intentos. Probá en unos minutos';
    if (m.includes('password')) return 'La contraseña es muy corta o inválida';
    return msg || 'Ocurrió un error';
}
