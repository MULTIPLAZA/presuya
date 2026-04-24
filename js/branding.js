// ============================================
// Branding dinámico: aplica el color primario
// del negocio a toda la UI (variables CSS + meta theme-color).
// Persiste en localStorage para evitar "flash" en próximas cargas.
// ============================================

const DEFAULT_COLOR = '#F5A623';
const STORAGE_KEY = 'presu_brand_color';

function hexToRgb(hex) {
    const m = String(hex || '').replace('#', '').match(/.{2}/g);
    if (!m || m.length !== 3) return { r: 245, g: 166, b: 35 };
    return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}

function rgbToHex({ r, g, b }) {
    return '#' + [r, g, b].map(v => {
        const h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
        return h.length === 1 ? '0' + h : h;
    }).join('');
}

// Oscurece multiplicando cada componente por (1 - amt)
function darken(hex, amt = 0.14) {
    const { r, g, b } = hexToRgb(hex);
    const f = 1 - amt;
    return rgbToHex({ r: r * f, g: g * f, b: b * f });
}

// Aclara mezclando con blanco (mix ratio = amt: 0 = hex original, 1 = blanco)
function lighten(hex, amt = 0.88) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex({
        r: r + (255 - r) * amt,
        g: g + (255 - g) * amt,
        b: b + (255 - b) * amt,
    });
}

export function applyBrandColor(hex, { persist = true } = {}) {
    const color = (hex && /^#[0-9a-f]{6}$/i.test(hex)) ? hex : DEFAULT_COLOR;
    const { r, g, b } = hexToRgb(color);
    const root = document.documentElement;
    root.style.setProperty('--primary', color);
    root.style.setProperty('--primary-dark', darken(color, 0.14));
    root.style.setProperty('--primary-light', lighten(color, 0.88));
    root.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.18)`);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', color);
    if (persist) {
        try { localStorage.setItem(STORAGE_KEY, color); } catch {}
    }
}

export function getStoredBrandColor() {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_COLOR; }
    catch { return DEFAULT_COLOR; }
}

// Aplicar desde localStorage al cargar el módulo (sin persistir de nuevo)
applyBrandColor(getStoredBrandColor(), { persist: false });
