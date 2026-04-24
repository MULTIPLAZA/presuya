// ============================================
// Dashboard — listado con filtros
// ============================================
import { supabase, requireAuth, logout } from './supabase-client.js';
import { $, $$, toast, showLoading, formatGs, formatDate, escapeHtml } from './ui.js';
import { applyBrandColor } from './branding.js';

let allBudgets = [];
let currentFilter = 'todos';
let currentSearch = '';

async function init() {
    const session = await requireAuth('index.html');
    if (!session) return;

    // Verificar onboarding y aplicar branding
    const { data: profile } = await supabase
        .from('presu_profiles')
        .select('onboarding_completo, color_primario')
        .eq('id', session.user.id)
        .single();

    if (profile) {
        applyBrandColor(profile.color_primario);
        if (!profile.onboarding_completo) {
            window.location.href = 'perfil.html?onboarding=1';
            return;
        }
    }

    await loadBudgets(session.user.id);
    setupListeners();
}

async function loadBudgets(profileId) {
    showLoading(true);
    const { data, error } = await supabase
        .from('presu_budgets')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });
    showLoading(false);

    if (error) {
        toast('Error cargando presupuestos', 'error');
        return;
    }
    allBudgets = data || [];

    // Marcar como vencidos los que pasaron la fecha y siguen en estado enviado
    const today = new Date().toISOString().slice(0, 10);
    const vencidos = allBudgets.filter(b =>
        b.estado === 'enviado' && b.fecha_validez < today
    );
    if (vencidos.length) {
        await Promise.all(vencidos.map(b =>
            supabase.from('presu_budgets').update({ estado: 'vencido' }).eq('id', b.id)
        ));
        vencidos.forEach(b => b.estado = 'vencido');
    }

    render();
}

function render() {
    const list = $('#budgetList');
    const filtered = allBudgets.filter(b => {
        if (currentFilter !== 'todos' && b.estado !== currentFilter) return false;
        if (currentSearch) {
            const q = currentSearch.toLowerCase();
            if (!(b.cliente_nombre || '').toLowerCase().includes(q) &&
                !(b.numero || '').toLowerCase().includes(q)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = '';
        $('#emptyState').classList.remove('hidden');
        if (currentFilter !== 'todos' || currentSearch) {
            $('#emptyState h3').textContent = 'Nada coincide con el filtro';
            $('#emptyState p').innerHTML = 'Probá con otro filtro o buscá otro término.';
        } else {
            $('#emptyState h3').textContent = 'Todavía no hay presupuestos';
            $('#emptyState p').innerHTML = 'Tocá el botón <strong>+</strong> para crear el primero.';
        }
        return;
    }

    $('#emptyState').classList.add('hidden');
    list.innerHTML = filtered.map(b => `
        <article class="budget-card estado-${b.estado}" data-id="${b.id}">
            <div class="row1">
                <div>
                    <div class="numero">${escapeHtml(b.numero)}</div>
                    <div class="cliente">${escapeHtml(b.cliente_nombre)}</div>
                </div>
                <span class="estado-badge ${b.estado}">${b.estado}</span>
            </div>
            <div class="row2">
                <div class="monto">${formatGs(b.total)}</div>
                <div class="fecha">${formatDate(b.fecha_emision)}</div>
            </div>
        </article>
    `).join('');

    $$('.budget-card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = `editor.html?id=${card.dataset.id}`;
        });
    });
}

function setupListeners() {
    $$('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            $$('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            render();
        });
    });

    let searchTimer;
    $('#search').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            render();
        }, 150);
    });

    $('#fabNew').addEventListener('click', () => {
        window.location.href = 'editor.html';
    });

    $('#btnLogout').addEventListener('click', async () => {
        if (confirm('¿Cerrar sesión?')) await logout();
    });
}

init();
