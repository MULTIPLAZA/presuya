// ============================================
// Admin — crear licencias desde el navegador.
// Consume /admin/create-user (Pages Function) autenticándose
// con el access_token de la sesión de Supabase del dueño.
// ============================================
import { supabase, requireAuth, logout } from './supabase-client.js';
import { $, toast, showLoading, escapeHtml } from './ui.js';
import { applyBrandColor } from './branding.js';

const API_URL = '/admin/create-user';
const LOGIN_URL = 'https://presuya.pages.dev/';

let session = null;
const sessionCreated = [];

function genPassword(len = 10) {
    // Caracteres legibles: sin 0/O/l/I/1 para evitar confusiones al tipear
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    // Usamos crypto si está disponible
    const arr = new Uint32Array(len);
    (crypto || window.crypto).getRandomValues(arr);
    let p = '';
    for (let i = 0; i < len; i++) p += chars[arr[i] % chars.length];
    return p;
}

function buildMessage({ email, password, nombre_negocio }) {
    return `¡Hola ${nombre_negocio}!

Tu cuenta en Presuya ya está lista. 🎉

🔗 Link:        ${LOGIN_URL}
📧 Email:       ${email}
🔑 Contraseña:  ${password}

Al entrar por primera vez completá tu logo, color de marca y datos del negocio — aparecen en todos los presupuestos.

Si necesitás ayuda, tocá el ícono "?" dentro de la app. Cualquier consulta, estoy a tu disposición.`;
}

async function checkAdmin() {
    const resp = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.is_admin) return { ok: true };
    return { ok: false, status: resp.status, data };
}

async function init() {
    session = await requireAuth('index.html');
    if (!session) return;

    const check = await checkAdmin();
    if (!check.ok) {
        $('#notAdminBox').classList.remove('hidden');
        $('#myUserId').textContent = session.user.id;
        return;
    }

    $('#adminPanel').classList.remove('hidden');
    $('#password').value = genPassword();

    // Branding: si el admin configuró un color, aplicar
    const { data: profile } = await supabase
        .from('presu_profiles')
        .select('color_primario')
        .eq('id', session.user.id)
        .single();
    if (profile?.color_primario) applyBrandColor(profile.color_primario);

    setupListeners();
}

function setupListeners() {
    $('#btnRegen').addEventListener('click', () => {
        $('#password').value = genPassword();
    });

    $('#btnLogout').addEventListener('click', async () => {
        if (confirm('¿Cerrar sesión?')) await logout();
    });

    $('#createUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createUser();
    });

    $('#btnNew').addEventListener('click', () => {
        $('#resultCard').classList.add('hidden');
        $('#email').value = '';
        $('#nombre_negocio').value = '';
        $('#password').value = genPassword();
        $('#email').focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('#btnCopyWhatsapp').addEventListener('click', copyWhatsappMsg);
}

async function createUser() {
    const email = $('#email').value.trim().toLowerCase();
    const nombre_negocio = $('#nombre_negocio').value.trim();
    const password = $('#password').value;

    if (!email || !nombre_negocio || !password) {
        toast('Completá todos los campos', 'error');
        return;
    }
    if (password.length < 6) {
        toast('Contraseña mínima 6 caracteres', 'error');
        return;
    }

    showLoading(true);
    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ email, password, nombre_negocio }),
        });
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data.ok) {
            const err = data.error;
            if (err === 'email_exists') toast('Ese email ya tiene cuenta', 'error');
            else if (err === 'not_admin') toast('No tenés permiso para crear licencias', 'error');
            else if (err === 'invalid_email') toast('Email inválido', 'error');
            else if (err === 'invalid_password') toast('Contraseña muy corta', 'error');
            else if (err === 'server_not_configured') toast('Servidor mal configurado (falta env var)', 'error');
            else toast('Error: ' + (err || 'no se pudo crear'), 'error');
            return;
        }

        renderResult(data);
        sessionCreated.unshift(data);
        renderRecent();
        toast('Licencia creada ✓', 'success');

    } catch (err) {
        console.error(err);
        toast('Error de red: ' + err.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderResult(data) {
    const msg = buildMessage(data);
    $('#credBlock').textContent = msg;
    $('#resultCard').classList.remove('hidden');
    $('#resultCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function copyWhatsappMsg() {
    try {
        await navigator.clipboard.writeText($('#credBlock').textContent);
        toast('Mensaje copiado — pegalo en WhatsApp', 'success');
    } catch {
        // Fallback: seleccionar el texto y que copie manual
        const range = document.createRange();
        range.selectNode($('#credBlock'));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        toast('Texto seleccionado, copialo con Ctrl+C', 'success');
    }
}

function renderRecent() {
    if (sessionCreated.length === 0) {
        $('#recentList').classList.add('hidden');
        return;
    }
    $('#recentList').classList.remove('hidden');
    $('#recentContent').innerHTML = sessionCreated.map(u => `
        <div class="recent-row">
            <div>
                <strong>${escapeHtml(u.nombre_negocio)}</strong>
                <div class="muted">${escapeHtml(u.email)} · ${escapeHtml(u.password)}</div>
            </div>
        </div>
    `).join('');
}

init();
