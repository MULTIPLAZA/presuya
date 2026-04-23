// ============================================
// Template HTML del PDF (se genera en memoria)
// ============================================
import { escapeHtml, formatGs, formatDate } from './ui.js';

export function buildPdfHtml({ profile, budget, items }) {
    const color = profile.color_primario || '#F5A623';
    const fechaEmision = formatDate(budget.fecha_emision);
    const fechaValidez = formatDate(budget.fecha_validez);
    const total = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0);

    const itemsHtml = items.map((i, idx) => {
        const cant = Number(i.cantidad) || 0;
        const pu = Number(i.precio_unitario) || 0;
        const sub = cant * pu;
        return `
            <tr>
                <td style="padding:9px 10px;border-bottom:1px solid #EEE;">${idx + 1}</td>
                <td style="padding:9px 10px;border-bottom:1px solid #EEE;">${escapeHtml(i.descripcion || '(sin descripción)')}</td>
                <td style="padding:9px 10px;border-bottom:1px solid #EEE;text-align:center;">${cant}</td>
                <td style="padding:9px 10px;border-bottom:1px solid #EEE;text-align:right;">${formatGs(pu)}</td>
                <td style="padding:9px 10px;border-bottom:1px solid #EEE;text-align:right;font-weight:700;">${formatGs(sub)}</td>
            </tr>
        `;
    }).join('');

    return `
<div style="width:210mm;min-height:297mm;padding:18mm 16mm;background:white;color:#1A1A1A;font-family:Helvetica,Arial,sans-serif;font-size:11pt;position:relative;box-sizing:border-box;">

    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:14px;border-bottom:3px solid ${color};margin-bottom:20px;">
        <div style="display:flex;align-items:flex-start;gap:14px;flex:1;">
            ${profile.logo_url ? `<img src="${profile.logo_url}" alt="logo" style="height:55px;width:auto;max-width:140px;object-fit:contain;" crossorigin="anonymous">` : ''}
            <div style="font-size:9pt;color:#4A4A4A;line-height:1.4;">
                <strong style="display:block;font-size:11pt;color:#1A1A1A;margin-bottom:2px;">${escapeHtml(profile.nombre_negocio || '')}</strong>
                ${profile.ruc ? `<div>RUC: ${escapeHtml(profile.ruc)}</div>` : ''}
                ${profile.direccion ? `<div>${escapeHtml(profile.direccion)}</div>` : ''}
                ${profile.telefono ? `<div>Tel: ${escapeHtml(profile.telefono)}</div>` : ''}
                ${profile.email ? `<div>${escapeHtml(profile.email)}</div>` : ''}
                ${profile.web ? `<div>${escapeHtml(profile.web)}</div>` : ''}
            </div>
        </div>
        <div style="text-align:right;min-width:220px;">
            <h1 style="font-size:22pt;color:#1A1A1A;font-weight:800;letter-spacing:1px;margin-bottom:8px;">PRESUPUESTO</h1>
            <div style="font-size:9.5pt;color:#4A4A4A;">
                <div style="display:flex;justify-content:space-between;gap:10px;padding:2px 0;border-bottom:1px dashed #E0E0E0;">
                    <span style="color:#8A8A8A;">Nº</span>
                    <strong style="color:#1A1A1A;">${escapeHtml(budget.numero)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;gap:10px;padding:2px 0;border-bottom:1px dashed #E0E0E0;">
                    <span style="color:#8A8A8A;">Fecha</span>
                    <strong style="color:#1A1A1A;">${fechaEmision}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;gap:10px;padding:2px 0;">
                    <span style="color:#8A8A8A;">Válido hasta</span>
                    <strong style="color:#1A1A1A;">${fechaValidez}</strong>
                </div>
            </div>
        </div>
    </div>

    <!-- CLIENTE -->
    <div style="background:#FAFAFA;padding:12px 14px;border-radius:6px;border-left:4px solid ${color};margin-bottom:18px;">
        <h3 style="font-size:9pt;color:${color};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;font-weight:700;">Cliente</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:10pt;">
            <div><span style="color:#8A8A8A;">Nombre:</span> <strong>${escapeHtml(budget.cliente_nombre || '—')}</strong></div>
            <div><span style="color:#8A8A8A;">RUC / CI:</span> <strong>${escapeHtml(budget.cliente_ruc || '—')}</strong></div>
            <div><span style="color:#8A8A8A;">Dirección:</span> <strong>${escapeHtml(budget.cliente_direccion || '—')}</strong></div>
            <div><span style="color:#8A8A8A;">WhatsApp:</span> <strong>${escapeHtml(budget.cliente_whatsapp || '—')}</strong></div>
        </div>
    </div>

    <!-- ITEMS -->
    <table style="width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:18px;">
        <thead>
            <tr style="background:#1A1A1A;color:white;">
                <th style="padding:10px;text-align:left;font-weight:600;font-size:9pt;width:40px;">#</th>
                <th style="padding:10px;text-align:left;font-weight:600;font-size:9pt;">Descripción</th>
                <th style="padding:10px;text-align:center;font-weight:600;font-size:9pt;width:60px;">Cant.</th>
                <th style="padding:10px;text-align:right;font-weight:600;font-size:9pt;width:130px;">P. Unitario</th>
                <th style="padding:10px;text-align:right;font-weight:600;font-size:9pt;width:140px;">Subtotal</th>
            </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
    </table>

    <!-- TOTAL -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:18px;">
        <div style="min-width:280px;">
            <div style="background:${color};color:#1A1A1A;padding:12px 14px;border-radius:6px;font-size:14pt;font-weight:700;display:flex;justify-content:space-between;">
                <span>TOTAL</span>
                <strong>${formatGs(total)}</strong>
            </div>
            ${profile.iva_incluido !== false ? '<div style="text-align:right;font-size:8.5pt;color:#8A8A8A;margin-top:6px;font-style:italic;">Precios con IVA 10% incluido</div>' : ''}
        </div>
    </div>

    <!-- CONDICIONES -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:#FAFAFA;padding:10px 12px;border-radius:6px;font-size:9.5pt;">
            <h4 style="font-size:8.5pt;color:${color};text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;font-weight:700;">Forma de pago</h4>
            <p style="color:#4A4A4A;">${escapeHtml(budget.forma_pago || '—')}</p>
        </div>
        ${budget.observaciones ? `
            <div style="background:#FAFAFA;padding:10px 12px;border-radius:6px;font-size:9.5pt;">
                <h4 style="font-size:8.5pt;color:${color};text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;font-weight:700;">Observaciones</h4>
                <p style="color:#4A4A4A;white-space:pre-wrap;">${escapeHtml(budget.observaciones)}</p>
            </div>
        ` : ''}
    </div>

    <!-- FOOTER -->
    <div style="position:absolute;bottom:18mm;left:16mm;right:16mm;padding-top:14px;border-top:2px solid ${color};display:flex;justify-content:space-between;align-items:flex-end;font-size:8.5pt;color:#4A4A4A;">
        <div style="text-align:center;min-width:200px;">
            <div style="border-top:1px solid #1A1A1A;margin-top:40px;margin-bottom:5px;"></div>
            <div>${escapeHtml(profile.nombre_negocio || '')}</div>
        </div>
        <div style="text-align:right;max-width:50%;font-style:italic;">
            Gracias por su confianza.${profile.telefono ? ` Consultas: ${escapeHtml(profile.telefono)}.` : ''}
        </div>
    </div>

</div>
    `;
}
