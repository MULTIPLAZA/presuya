// ============================================
// Helpers de UI (toast, loading, utils)
// ============================================

export function $(sel) {
    return typeof sel === 'string' ? document.querySelector(sel) : sel;
}

export function $$(sel) {
    return Array.from(document.querySelectorAll(sel));
}

let toastTimer = null;
export function toast(msg, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.className = 'toast ' + type;
    }, 2800);
}

export function showLoading(show = true) {
    const el = document.getElementById('loading');
    if (!el) return;
    el.classList.toggle('hidden', !show);
}

export function formatGs(n) {
    const num = Number(n) || 0;
    return 'Gs ' + num.toLocaleString('es-PY', { maximumFractionDigits: 0 });
}

export function formatDate(d) {
    const date = d instanceof Date ? d : new Date(d);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

export function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

export function formatNumeroPresupuesto(n, year = new Date().getFullYear()) {
    return `PRES-${year}-${String(n).padStart(4, '0')}`;
}

export function normalizePYPhone(raw) {
    let n = String(raw || '').replace(/\D/g, '');
    if (!n) return '';
    if (n.startsWith('0')) n = '595' + n.slice(1);
    else if (!n.startsWith('595') && n.length === 9) n = '595' + n;
    return n;
}
