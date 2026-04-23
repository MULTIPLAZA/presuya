// ============================================
// Perfil del negocio — onboarding + edición
// ============================================
import { supabase, requireAuth, logout } from './supabase-client.js';
import { STORAGE_BUCKET } from './config.js';
import { $, toast, showLoading } from './ui.js';

let currentUser = null;
let currentProfile = null;
let pendingLogoFile = null;
const isOnboarding = new URLSearchParams(window.location.search).get('onboarding') === '1';

async function init() {
    const session = await requireAuth('index.html');
    if (!session) return;
    currentUser = session.user;

    if (isOnboarding) $('#onboardingIntro').classList.remove('hidden');

    const { data: profile, error } = await supabase
        .from('presu_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error) {
        toast('No se pudo cargar tu perfil', 'error');
        return;
    }
    currentProfile = profile;
    renderPerfil(profile);
}

function renderPerfil(p) {
    $('#nombreNegocio').value = p.nombre_negocio === 'Mi Negocio' ? '' : (p.nombre_negocio || '');
    $('#ruc').value = p.ruc || '';
    $('#direccion').value = p.direccion || '';
    $('#telefono').value = p.telefono || '';
    $('#emailContacto').value = p.email || currentUser.email || '';
    $('#web').value = p.web || '';
    $('#colorPrimario').value = p.color_primario || '#F5A623';
    $('#validezDefault').value = p.validez_default || 15;
    $('#formaPagoDefault').value = p.forma_pago_default || '';

    if (p.logo_url) {
        $('#avatarPreview').innerHTML = `<img src="${p.logo_url}" alt="logo">`;
    }
}

// Logo upload
$('#btnPickLogo').addEventListener('click', () => $('#logoFile').click());

$('#logoFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 512000) {
        toast('El archivo supera los 500KB', 'error');
        return;
    }
    pendingLogoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        $('#avatarPreview').innerHTML = `<img src="${ev.target.result}" alt="logo">`;
    };
    reader.readAsDataURL(file);
});

async function uploadLogo(file) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${currentUser.id}/logo.${ext}`;

    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: '3600' });

    if (error) throw error;

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    // Agregamos timestamp para bustear cache
    return data.publicUrl + '?v=' + Date.now();
}

// Guardar perfil
$('#perfilForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = $('#nombreNegocio').value.trim();
    if (!nombre) {
        toast('Poné el nombre del negocio', 'error');
        $('#nombreNegocio').focus();
        return;
    }

    showLoading(true);
    try {
        let logoUrl = currentProfile.logo_url;
        if (pendingLogoFile) {
            logoUrl = await uploadLogo(pendingLogoFile);
            pendingLogoFile = null;
        }

        const updates = {
            nombre_negocio: nombre,
            ruc: $('#ruc').value.trim() || null,
            direccion: $('#direccion').value.trim() || null,
            telefono: $('#telefono').value.trim() || null,
            email: $('#emailContacto').value.trim() || null,
            web: $('#web').value.trim() || null,
            color_primario: $('#colorPrimario').value || '#F5A623',
            validez_default: Number($('#validezDefault').value) || 15,
            forma_pago_default: $('#formaPagoDefault').value.trim() || null,
            logo_url: logoUrl,
            onboarding_completo: true,
        };

        const { error } = await supabase
            .from('presu_profiles')
            .update(updates)
            .eq('id', currentUser.id);

        if (error) throw error;

        toast('Perfil guardado', 'success');
        setTimeout(() => {
            window.location.href = isOnboarding ? 'dashboard.html' : 'dashboard.html';
        }, 700);
    } catch (err) {
        console.error(err);
        toast('Error: ' + err.message, 'error');
    } finally {
        showLoading(false);
    }
});

$('#btnSkipToDash').addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

$('#btnLogout').addEventListener('click', async () => {
    if (confirm('¿Cerrar sesión?')) await logout();
});

init();
