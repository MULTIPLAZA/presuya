// ============================================
// Vista pública del presupuesto — cliente sin cuenta.
// Abre p.html?t=<token>, muestra detalle, permite aprobar/rechazar.
// Usa RPCs SECURITY DEFINER: presu_get_public_budget, presu_respond_public_budget.
// ============================================
import { supabase } from './supabase-client.js';
import { $, toast, formatGs, escapeHtml } from './ui.js';
import { applyBrandColor } from './branding.js';

// El token puede venir:
//   1) Inyectado por la Pages Function (/p/<token>) en window.__PUBLIC_TOKEN
//   2) En el path /p/<token> directamente (backup si la Function falla)
//   3) En querystring ?t=<token> (links antiguos /p.html?t=...)
const token = window.__PUBLIC_TOKEN
    || (window.location.pathname.match(/\/p\/([A-Za-z0-9_-]+)/) || [])[1]
    || new URLSearchParams(window.location.search).get('t');

const ESTADO_LABELS = {
    borrador: { txt: 'Borrador', cls: 'banner-info' },
    enviado: { txt: 'Esperando tu respuesta', cls: 'banner-info' },
    aprobado: { txt: '✓ Presupuesto aprobado', cls: 'banner-ok' },
    rechazado: { txt: '✗ Presupuesto rechazado', cls: 'banner-bad' },
    vencido: { txt: '⚠ Presupuesto vencido', cls: 'banner-warn' },
};

async function init() {
    if (!token || token.length < 8) {
        showError('Link inválido', 'El link no parece correcto. Pedile al emisor que te mande el link de nuevo.');
        return;
    }
    const { data, error } = await supabase.rpc('presu_get_public_budget', { p_token: token });
    if (error || !data) {
        showError('No se encontró el presupuesto', 'Puede haber sido eliminado o el link estar mal. Contactá al emisor.');
        return;
    }
    render(data);
}

function render({ budget, items, profile }) {
    // Branding del emisor
    applyBrandColor(profile.color_primario, { persist: false });
    document.title = `Presupuesto ${budget.numero} — ${profile.nombre_negocio}`;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta && profile.color_primario) themeMeta.content = profile.color_primario;

    // Header del negocio
    if (profile.logo_url) {
        const img = $('#bizLogo');
        img.src = profile.logo_url;
        img.hidden = false;
    }
    $('#bizName').textContent = profile.nombre_negocio || '';
    const metaParts = [];
    if (profile.ruc) metaParts.push(`RUC ${profile.ruc}`);
    if (profile.direccion) metaParts.push(profile.direccion);
    if (profile.telefono) metaParts.push(profile.telefono);
    $('#bizMeta').innerHTML = metaParts.map(escapeHtml).join(' · ');

    // Banner de estado
    const eLabel = ESTADO_LABELS[budget.estado] || { txt: budget.estado, cls: 'banner-info' };
    const banner = $('#estadoBanner');
    banner.className = `estado-banner ${eLabel.cls}`;
    banner.textContent = eLabel.txt;

    // Header del presupuesto
    $('#numero').textContent = budget.numero || '—';
    $('#fecha').textContent = formatDate(budget.fecha_emision);

    // Cliente
    const clLines = [budget.cliente_nombre];
    if (budget.cliente_ruc) clLines.push('RUC ' + budget.cliente_ruc);
    if (budget.cliente_direccion) clLines.push(budget.cliente_direccion);
    $('#cliBlock').innerHTML = clLines.map(l => `<div>${escapeHtml(l)}</div>`).join('');

    // Items
    $('#itemsList').innerHTML = (items || []).map(i => `
        <div class="pub-item">
            <div class="pub-item-desc">${escapeHtml(i.descripcion || '')}</div>
            <div class="pub-item-line">
                <span>${i.cantidad} × ${formatGs(i.precio_unitario)}</span>
                <strong>${formatGs(i.subtotal)}</strong>
            </div>
        </div>
    `).join('');

    // Total
    $('#totalView').textContent = formatGs(budget.total);

    // Condiciones
    $('#fechaValidez').textContent = formatDate(budget.fecha_validez);
    if (budget.forma_pago) {
        $('#formaPago').textContent = budget.forma_pago;
    } else {
        $('#formaPagoRow').classList.add('hidden');
    }
    if (budget.observaciones) {
        $('#obsBlock').innerHTML = `<div class="obs-label">Observaciones</div><div class="obs-text">${escapeHtml(budget.observaciones).replace(/\n/g, '<br>')}</div>`;
    }

    // Contacto del emisor
    if (profile.telefono) {
        const phone = normalizePhone(profile.telefono);
        if (phone) {
            const link = $('#contactLink');
            link.href = `https://wa.me/${phone}`;
            link.textContent = `Contactar a ${profile.nombre_negocio} por WhatsApp`;
            link.classList.remove('hidden');
        }
    }

    // Zona de decisión (sólo si está pendiente y no vencido)
    const today = new Date().toISOString().slice(0, 10);
    const pendiente = ['enviado', 'borrador'].includes(budget.estado) && budget.fecha_validez >= today;
    if (pendiente) {
        $('#decisionArea').classList.remove('hidden');
        $('#btnApprove').addEventListener('click', () => respond('aprobado'));
        $('#btnReject').addEventListener('click', () => respond('rechazado'));
    } else if (budget.estado === 'aprobado' || budget.estado === 'rechazado') {
        showDone(budget.estado);
    }

    // Mostrar contenido
    $('#publicLoading').classList.add('hidden');
    $('#publicContent').classList.remove('hidden');
}

async function respond(estado) {
    const confirmMsg = estado === 'aprobado'
        ? '¿Confirmás la aprobación del presupuesto?'
        : '¿Confirmás que rechazás el presupuesto?';
    if (!confirm(confirmMsg)) return;

    $('#btnApprove').disabled = true;
    $('#btnReject').disabled = true;

    const { data, error } = await supabase.rpc('presu_respond_public_budget', {
        p_token: token,
        p_estado: estado,
    });

    if (error || !data?.ok) {
        const err = data?.error;
        if (err === 'ya_respondido') {
            toast('Este presupuesto ya fue respondido', 'error');
        } else if (err === 'vencido') {
            toast('El presupuesto venció', 'error');
        } else {
            toast('No se pudo registrar la respuesta', 'error');
        }
        $('#btnApprove').disabled = false;
        $('#btnReject').disabled = false;
        return;
    }

    $('#decisionArea').classList.add('hidden');
    showDone(estado);

    // Actualizar banner
    const eLabel = ESTADO_LABELS[estado];
    if (eLabel) {
        const banner = $('#estadoBanner');
        banner.className = `estado-banner ${eLabel.cls}`;
        banner.textContent = eLabel.txt;
    }
}

function showDone(estado) {
    const done = $('#responseDone');
    if (estado === 'aprobado') {
        $('#doneIcon').textContent = '✓';
        $('#doneIcon').className = 'icon ok';
        $('#doneTitle').textContent = '¡Presupuesto aprobado!';
        $('#doneMsg').textContent = 'Tu respuesta quedó registrada. El emisor ya fue avisado y se va a contactar para los próximos pasos.';
    } else {
        $('#doneIcon').textContent = '✗';
        $('#doneIcon').className = 'icon bad';
        $('#doneTitle').textContent = 'Presupuesto rechazado';
        $('#doneMsg').textContent = 'Registramos tu respuesta. Gracias por avisar.';
    }
    done.classList.remove('hidden');
}

function showError(title, msg) {
    $('#errTitle').textContent = title;
    $('#errMsg').textContent = msg;
    $('#publicLoading').classList.add('hidden');
    $('#publicError').classList.remove('hidden');
}

function formatDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function normalizePhone(raw) {
    let n = String(raw || '').replace(/\D/g, '');
    if (!n) return '';
    if (n.startsWith('0')) n = '595' + n.slice(1);
    else if (!n.startsWith('595') && n.length === 9) n = '595' + n;
    return n;
}

init();
