// ============================================
// Dashboard — listado con filtros + KPIs + cambio de estado
// ============================================
import { supabase, requireAuth, logout } from './supabase-client.js';
import { $, $$, toast, showLoading, formatGs, formatDate, escapeHtml } from './ui.js';
import { applyBrandColor } from './branding.js';

let allBudgets = [];
let currentFilter = 'todos';
let currentSearch = '';
let sheetTargetId = null;

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

    renderKpis();
    render();
}

function renderKpis() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const isThisMonth = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getFullYear() === y && d.getMonth() === m;
    };

    // Un presupuesto cuenta para "enviados del mes" si fue creado este mes
    // (lo tomamos desde created_at, más estable que estado que puede cambiar)
    const delMes = allBudgets.filter(b => isThisMonth(b.created_at));
    const enviados = delMes.filter(b => ['enviado', 'aprobado', 'rechazado', 'vencido'].includes(b.estado)).length;
    const aprobados = delMes.filter(b => b.estado === 'aprobado');
    const rechazados = delMes.filter(b => b.estado === 'rechazado').length;
    const facturado = aprobados.reduce((s, b) => s + (Number(b.total) || 0), 0);

    $('#kpiEnviados').textContent = enviados;
    $('#kpiAprobados').textContent = aprobados.length;
    $('#kpiRechazados').textContent = rechazados;
    $('#kpiFacturado').textContent = formatGs(facturado);
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
                <button type="button" class="estado-badge ${b.estado}" data-change-state="${b.id}" title="Cambiar estado">${b.estado}</button>
            </div>
            <div class="row2">
                <div class="monto">${formatGs(b.total)}</div>
                <div class="fecha">${formatDate(b.fecha_emision)}</div>
            </div>
        </article>
    `).join('');

    $$('.budget-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // No navegar si clickearon el badge para cambiar estado
            if (e.target.closest('[data-change-state]')) return;
            window.location.href = `editor.html?id=${card.dataset.id}`;
        });
    });

    $$('[data-change-state]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openStateSheet(e.currentTarget.dataset.changeState);
        });
    });
}

// ---------- Bottom sheet para cambiar estado ----------
function openStateSheet(budgetId) {
    const b = allBudgets.find(x => x.id === budgetId);
    if (!b) return;
    sheetTargetId = budgetId;
    $('#sheetTitle').textContent = `${b.numero} — ${b.cliente_nombre}`;
    $$('.sheet-btn').forEach(btn => {
        btn.classList.toggle('current', btn.dataset.estado === b.estado);
    });
    $('#sheetBackdrop').classList.remove('hidden');
    $('#stateSheet').classList.remove('hidden');
    requestAnimationFrame(() => {
        $('#sheetBackdrop').classList.add('show');
        $('#stateSheet').classList.add('show');
    });
}

function closeStateSheet() {
    $('#sheetBackdrop').classList.remove('show');
    $('#stateSheet').classList.remove('show');
    setTimeout(() => {
        $('#sheetBackdrop').classList.add('hidden');
        $('#stateSheet').classList.add('hidden');
        sheetTargetId = null;
    }, 200);
}

async function changeState(newEstado) {
    if (!sheetTargetId) return;
    const b = allBudgets.find(x => x.id === sheetTargetId);
    if (!b || b.estado === newEstado) { closeStateSheet(); return; }

    closeStateSheet();
    showLoading(true);
    const { error } = await supabase
        .from('presu_budgets')
        .update({ estado: newEstado })
        .eq('id', b.id);
    showLoading(false);

    if (error) {
        toast('No se pudo cambiar el estado', 'error');
        return;
    }
    b.estado = newEstado;
    toast(`Estado: ${newEstado}`, 'success');
    renderKpis();
    render();
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

    // Sheet
    $$('.sheet-btn').forEach(btn => {
        btn.addEventListener('click', () => changeState(btn.dataset.estado));
    });
    $('#sheetCancel').addEventListener('click', closeStateSheet);
    $('#sheetBackdrop').addEventListener('click', closeStateSheet);
}

init();
