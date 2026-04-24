// ============================================
// Editor de presupuesto
// ============================================
import { supabase, requireAuth } from './supabase-client.js';
import { $, $$, toast, showLoading, formatGs, formatNumeroPresupuesto, normalizePYPhone, addDays, escapeHtml } from './ui.js';
import { buildPdfHtml } from './pdf-template.js';

let currentUser = null;
let currentProfile = null;
let currentBudget = null; // null = nuevo
let items = [];
let itemSeq = 0;
let isDirty = false;

const budgetId = new URLSearchParams(window.location.search).get('id');

async function init() {
    const session = await requireAuth('index.html');
    if (!session) return;
    currentUser = session.user;

    // Cargar perfil
    const { data: profile, error: pErr } = await supabase
        .from('presu_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (pErr || !profile) {
        toast('Completá tu perfil primero', 'error');
        setTimeout(() => window.location.href = 'perfil.html?onboarding=1', 1200);
        return;
    }
    if (!profile.onboarding_completo) {
        window.location.href = 'perfil.html?onboarding=1';
        return;
    }
    currentProfile = profile;

    // Cargar presupuesto si hay id
    if (budgetId) {
        await loadBudget(budgetId);
    } else {
        // Nuevo: solo setear defaults
        $('#formaPago').value = profile.forma_pago_default || '';
        $('#validezDias').value = profile.validez_default || 15;
        $('#numeroView').textContent = 'Al guardar →';
        $('#pageTitle').textContent = 'Nuevo presupuesto';
        addItem();
    }

    setupListeners();
}

async function loadBudget(id) {
    showLoading(true);
    const { data: budget, error: bErr } = await supabase
        .from('presu_budgets')
        .select('*')
        .eq('id', id)
        .single();

    if (bErr || !budget) {
        showLoading(false);
        toast('No se encontró el presupuesto', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 1200);
        return;
    }

    const { data: itemsData } = await supabase
        .from('presu_items')
        .select('*')
        .eq('budget_id', id)
        .order('orden', { ascending: true });

    showLoading(false);

    currentBudget = budget;
    $('#pageTitle').textContent = 'Editar presupuesto';
    $('#numeroView').textContent = budget.numero;
    $('#estadoSelect').value = budget.estado;
    $('#cliNombre').value = budget.cliente_nombre || '';
    $('#cliRuc').value = budget.cliente_ruc || '';
    $('#cliDireccion').value = budget.cliente_direccion || '';
    $('#cliWhatsapp').value = budget.cliente_whatsapp || '';
    $('#formaPago').value = budget.forma_pago || '';
    $('#observaciones').value = budget.observaciones || '';
    // calcular días de validez
    const emision = new Date(budget.fecha_emision);
    const validez = new Date(budget.fecha_validez);
    const dias = Math.round((validez - emision) / (1000 * 60 * 60 * 24));
    $('#validezDias').value = dias || 15;

    items = (itemsData || []).map(i => ({
        id: ++itemSeq,
        dbId: i.id,
        descripcion: i.descripcion,
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
    }));
    renderItems();
    updateTotal();

    $('#btnDelete').classList.remove('hidden');
}

// ---------- ITEMS ----------
function addItem(descripcion = '', cantidad = 1, precio = 0) {
    itemSeq++;
    items.push({ id: itemSeq, descripcion, cantidad, precio_unitario: precio });
    renderItems();
    updateTotal();
    isDirty = true;
}

function removeItem(id) {
    items = items.filter(i => i.id !== id);
    renderItems();
    updateTotal();
    isDirty = true;
}

function updateItem(id, field, value) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (field === 'descripcion') item.descripcion = value;
    else item[field] = Number(value) || 0;
    updateTotal();
    isDirty = true;
}

function autosize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 320) + 'px';
}

function renderItems() {
    const c = $('#itemsContainer');
    if (items.length === 0) {
        c.innerHTML = '<p class="items-empty">Aún no agregaste items. Tocá "+ Agregar item" para empezar.</p>';
        return;
    }
    c.innerHTML = items.map((i, idx) => {
        const subtotal = (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0);
        return `
        <div class="item-card" data-id="${i.id}">
            <div class="item-header">
                <span class="item-index">Item ${idx + 1}</span>
                <button type="button" class="item-remove" data-remove="${i.id}" title="Eliminar item" aria-label="Eliminar item">×</button>
            </div>
            <div class="item-field">
                <label class="item-label">Descripción</label>
                <textarea class="item-desc-input" rows="2" data-field="descripcion"
                    placeholder="Ej: Instalación de toma doble schuko en living, con caño corrugado 3/4 embutido y cable 2x2.5mm">${escapeHtml(i.descripcion)}</textarea>
            </div>
            <div class="item-nums-grid">
                <div class="item-num-cell">
                    <label class="item-label">Cantidad</label>
                    <input type="number" inputmode="decimal" min="0" step="0.01" value="${i.cantidad}" data-field="cantidad">
                </div>
                <div class="item-num-cell">
                    <label class="item-label">Precio unit. (Gs)</label>
                    <input type="number" inputmode="numeric" min="0" step="1" value="${i.precio_unitario}" data-field="precio_unitario">
                </div>
                <div class="item-num-cell item-subtotal-cell">
                    <label class="item-label">Subtotal</label>
                    <div class="item-subtotal-value">${formatGs(subtotal)}</div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    c.querySelectorAll('.item-card input, .item-card textarea').forEach(el => {
        el.addEventListener('input', (e) => {
            const card = e.target.closest('.item-card');
            const id = Number(card.dataset.id);
            const field = e.target.dataset.field;
            updateItem(id, field, e.target.value);
            if (field === 'cantidad' || field === 'precio_unitario') {
                const item = items.find(x => x.id === id);
                const sub = (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0);
                card.querySelector('.item-subtotal-value').textContent = formatGs(sub);
            }
            if (e.target.tagName === 'TEXTAREA') autosize(e.target);
        });
    });

    c.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeItem(Number(e.currentTarget.dataset.remove));
        });
    });

    c.querySelectorAll('.item-desc-input').forEach(autosize);
}

function updateTotal() {
    const total = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0);
    $('#totalView').textContent = formatGs(total);
    return total;
}

// ---------- SAVE ----------
async function saveBudget() {
    const cliNombre = $('#cliNombre').value.trim();
    if (!cliNombre) {
        toast('Poné el nombre del cliente', 'error');
        $('#cliNombre').focus();
        return null;
    }
    if (items.length === 0 || items.every(i => !i.descripcion && !i.precio_unitario)) {
        toast('Agregá al menos un item con descripción y precio', 'error');
        return null;
    }

    showLoading(true);
    try {
        const validezDias = Number($('#validezDias').value) || 15;
        const hoy = new Date();
        const validez = addDays(hoy, validezDias);

        const total = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0);

        let budgetData = {
            profile_id: currentUser.id,
            estado: $('#estadoSelect').value,
            cliente_nombre: cliNombre,
            cliente_ruc: $('#cliRuc').value.trim() || null,
            cliente_direccion: $('#cliDireccion').value.trim() || null,
            cliente_whatsapp: $('#cliWhatsapp').value.trim() || null,
            fecha_emision: hoy.toISOString().slice(0, 10),
            fecha_validez: validez.toISOString().slice(0, 10),
            forma_pago: $('#formaPago').value.trim() || null,
            observaciones: $('#observaciones').value.trim() || null,
            total,
        };

        let savedBudget;
        if (currentBudget) {
            // UPDATE
            const { data, error } = await supabase
                .from('presu_budgets')
                .update(budgetData)
                .eq('id', currentBudget.id)
                .select()
                .single();
            if (error) throw error;
            savedBudget = data;

            // Borrar items viejos y reinsertar (más simple que diff)
            await supabase.from('presu_items').delete().eq('budget_id', savedBudget.id);
        } else {
            // INSERT — obtener próximo número via RPC
            const { data: nextN, error: nErr } = await supabase.rpc('presu_next_number', { p_profile_id: currentUser.id });
            if (nErr) throw nErr;
            budgetData.numero = formatNumeroPresupuesto(nextN);

            const { data, error } = await supabase
                .from('presu_budgets')
                .insert(budgetData)
                .select()
                .single();
            if (error) throw error;
            savedBudget = data;
        }

        // Insertar items
        const itemsToInsert = items
            .filter(i => i.descripcion || i.precio_unitario)
            .map((i, idx) => ({
                budget_id: savedBudget.id,
                orden: idx,
                descripcion: i.descripcion || '(sin descripción)',
                cantidad: i.cantidad || 0,
                precio_unitario: i.precio_unitario || 0,
                subtotal: (i.cantidad || 0) * (i.precio_unitario || 0),
            }));

        if (itemsToInsert.length) {
            const { error: iErr } = await supabase.from('presu_items').insert(itemsToInsert);
            if (iErr) throw iErr;
        }

        currentBudget = savedBudget;
        $('#numeroView').textContent = savedBudget.numero;
        $('#pageTitle').textContent = 'Editar presupuesto';
        $('#btnDelete').classList.remove('hidden');
        // Actualizar URL sin recargar
        if (!budgetId) {
            history.replaceState(null, '', `editor.html?id=${savedBudget.id}`);
        }
        isDirty = false;
        toast('Presupuesto guardado', 'success');
        return savedBudget;
    } catch (err) {
        console.error(err);
        toast('Error: ' + err.message, 'error');
        return null;
    } finally {
        showLoading(false);
    }
}

// ---------- PDF ----------
async function downloadPDF() {
    // Guardar primero si hay cambios
    if (isDirty || !currentBudget) {
        const saved = await saveBudget();
        if (!saved) return;
    }

    showLoading(true);

    // Renderizar el template en un contenedor offscreen limpio
    const container = $('#pdfTemplate');
    container.innerHTML = buildPdfHtml({
        profile: currentProfile,
        budget: currentBudget,
        items
    });

    const pdfEl = container.firstElementChild;
    const filename = `${currentBudget.numero}_${(currentBudget.cliente_nombre || '').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}.pdf`;

    // Scrollear al tope para evitar offsets
    const prevScroll = window.scrollY;
    window.scrollTo(0, 0);

    const opt = {
        margin: [0, 0, 0, 0],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: pdfEl.scrollWidth,
            windowHeight: pdfEl.scrollHeight,
            x: 0,
            y: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: { mode: ['avoid-all'] }
    };

    try {
        await html2pdf().set(opt).from(pdfEl).save();
        window.scrollTo(0, prevScroll);
        container.innerHTML = '';
    } catch (err) {
        console.error(err);
        toast('Error al generar PDF', 'error');
    } finally {
        showLoading(false);
    }
}

// ---------- WHATSAPP ----------
function sendWhatsapp() {
    if (!currentBudget) {
        toast('Guardá el presupuesto primero', 'error');
        return;
    }
    const phone = normalizePYPhone($('#cliWhatsapp').value);
    if (!phone) {
        toast('Cargá el WhatsApp del cliente', 'error');
        $('#cliWhatsapp').focus();
        return;
    }

    const msg = [
        `Hola ${currentBudget.cliente_nombre || 'estimado/a'}, ¿cómo estás?`,
        ``,
        `Te envío el presupuesto ${currentBudget.numero} de ${currentProfile.nombre_negocio}.`,
        ``,
        `Total: ${formatGs(currentBudget.total)}`,
        `Válido hasta: ${new Date(currentBudget.fecha_validez).toLocaleDateString('es-PY')}`,
        ``,
        `Cualquier consulta estoy a tu disposición.`
    ].join('\n');

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setTimeout(() => toast('Adjuntá el PDF en el chat de WhatsApp', 'success'), 300);
}

// ---------- DELETE ----------
async function deleteBudget() {
    if (!currentBudget) return;
    if (!confirm(`¿Eliminar presupuesto ${currentBudget.numero}? Esto no se puede deshacer.`)) return;

    showLoading(true);
    const { error } = await supabase.from('presu_budgets').delete().eq('id', currentBudget.id);
    showLoading(false);

    if (error) {
        toast('Error al eliminar', 'error');
        return;
    }
    toast('Presupuesto eliminado');
    setTimeout(() => window.location.href = 'dashboard.html', 500);
}

// ---------- STATE CHANGE ----------
async function onEstadoChange(e) {
    if (!currentBudget) {
        isDirty = true;
        return;
    }
    const nuevoEstado = e.target.value;
    const { error } = await supabase
        .from('presu_budgets')
        .update({ estado: nuevoEstado })
        .eq('id', currentBudget.id);

    if (error) {
        toast('No se pudo cambiar el estado', 'error');
        e.target.value = currentBudget.estado;
        return;
    }
    currentBudget.estado = nuevoEstado;
    toast('Estado actualizado: ' + nuevoEstado, 'success');
}

// ---------- LISTENERS ----------
function setupListeners() {
    $('#btnAddItem').addEventListener('click', () => addItem());
    $('#btnSave').addEventListener('click', saveBudget);
    $('#btnPDF').addEventListener('click', downloadPDF);
    $('#btnWhatsapp').addEventListener('click', sendWhatsapp);
    $('#btnDelete').addEventListener('click', deleteBudget);
    $('#estadoSelect').addEventListener('change', onEstadoChange);

    ['cliNombre', 'cliRuc', 'cliDireccion', 'cliWhatsapp', 'formaPago', 'observaciones', 'validezDias']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => { isDirty = true; });
        });

    // Warn al salir sin guardar
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

init();
