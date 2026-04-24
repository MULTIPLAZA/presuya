// ============================================
// Cloudflare Pages Function
// Ruta: /p/:token
//
// Renderiza el HTML de la vista pública con los Open Graph tags
// (título, descripción, imagen) ya rellenados con los datos del
// negocio emisor, para que el preview de WhatsApp / Facebook /
// Twitter muestre el LOGO DEL NEGOCIO, no un logo genérico.
//
// Flujo:
//   1. Recibe el token en la URL.
//   2. Llama a la RPC pública presu_get_public_budget para traer
//      logo_url, nombre_negocio, color_primario, número y total.
//   3. Devuelve un HTML con las meta tags OG ya inyectadas y el
//      mismo body que p.html — el JS del browser toma el control
//      desde ahí.
// ============================================

const SUPABASE_URL = 'https://bziztkhunfvwetnlczbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6aXp0a2h1bmZ2d2V0bmxjemJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzcwNDUsImV4cCI6MjA5MTMxMzA0NX0.zkDcRuL4ArAOEFqGmm-q8eTgo79BiNxdg4iV9ojsfHM';

const DEFAULT_COLOR = '#F5A623';

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatGs(n) {
    const num = Number(n) || 0;
    return 'Gs ' + num.toLocaleString('es-PY', { maximumFractionDigits: 0 });
}

async function fetchBudget(token) {
    try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/presu_get_public_budget`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_token: token }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data || null;
    } catch {
        return null;
    }
}

export async function onRequestGet(context) {
    const { params, request } = context;
    const token = String(params.token || '').slice(0, 64);
    const origin = new URL(request.url).origin;

    const data = token.length >= 8 ? await fetchBudget(token) : null;

    let ogTitle = 'Presupuesto — Presuya';
    let ogDescription = 'Tu cliente te compartió un presupuesto para que lo veas y lo apruebes online.';
    let ogImage = `${origin}/assets/icons/icon.svg`;
    let themeColor = DEFAULT_COLOR;
    let pageTitle = 'Presupuesto — Presuya';

    if (data && data.budget && data.profile) {
        const b = data.budget;
        const p = data.profile;
        const negocio = p.nombre_negocio || 'Presuya';
        pageTitle = `Presupuesto ${b.numero || ''} — ${negocio}`.trim();
        ogTitle = pageTitle;
        ogDescription = `${negocio} te envió un presupuesto por ${formatGs(b.total)}. Tocá para verlo y aprobarlo online.`;
        if (p.logo_url) ogImage = p.logo_url;
        if (p.color_primario) themeColor = p.color_primario;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="${escapeHtml(themeColor)}">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(pageTitle)}</title>

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Presuya">
    <meta property="og:title" content="${escapeHtml(ogTitle)}">
    <meta property="og:description" content="${escapeHtml(ogDescription)}">
    <meta property="og:image" content="${escapeHtml(ogImage)}">
    <meta property="og:image:alt" content="Logo de ${escapeHtml((data && data.profile && data.profile.nombre_negocio) || 'Presuya')}">
    <meta property="og:url" content="${escapeHtml(origin)}/p/${escapeHtml(token)}">
    <meta property="og:locale" content="es_PY">

    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
    <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
    <meta name="twitter:image" content="${escapeHtml(ogImage)}">

    <link rel="icon" type="image/svg+xml" href="/assets/icons/icon.svg">
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="public-body">

    <div class="public-shell">

        <div id="publicLoading" class="public-loading">
            <div class="spinner"></div>
            <p>Cargando presupuesto...</p>
        </div>

        <div id="publicError" class="public-error hidden">
            <div class="icon">⚠️</div>
            <h2 id="errTitle">No se pudo cargar el presupuesto</h2>
            <p id="errMsg">El link puede estar vencido o ser inválido. Pedile al emisor que te mande el link de nuevo.</p>
        </div>

        <div id="publicContent" class="public-content hidden">

            <header class="public-header" id="publicHeader">
                <img id="bizLogo" class="biz-logo" alt="" hidden>
                <div class="biz-info">
                    <div class="biz-name" id="bizName">—</div>
                    <div class="biz-meta" id="bizMeta"></div>
                </div>
            </header>

            <div class="estado-banner" id="estadoBanner"></div>

            <section class="public-card">
                <div class="public-numero">
                    <div>
                        <div class="lbl">Presupuesto</div>
                        <div class="val" id="numero">—</div>
                    </div>
                    <div class="right">
                        <div class="lbl">Fecha</div>
                        <div class="val" id="fecha">—</div>
                    </div>
                </div>

                <h3 class="sub">Para</h3>
                <div class="cli-block" id="cliBlock">—</div>
            </section>

            <section class="public-card">
                <h3 class="sub">Detalle</h3>
                <div id="itemsList" class="public-items"></div>

                <div class="public-total">
                    <span>Total</span>
                    <span id="totalView">Gs 0</span>
                </div>
            </section>

            <section class="public-card" id="condicionesCard">
                <h3 class="sub">Condiciones</h3>
                <div class="kv"><span>Válido hasta:</span><strong id="fechaValidez">—</strong></div>
                <div class="kv" id="formaPagoRow"><span>Forma de pago:</span><strong id="formaPago">—</strong></div>
                <div class="obs" id="obsBlock"></div>
            </section>

            <div id="decisionArea" class="decision-area hidden">
                <h3>¿Aprobás este presupuesto?</h3>
                <p>Elegí una opción. La respuesta se registra y le llega al emisor.</p>
                <div class="decision-buttons">
                    <button type="button" class="btn btn-success btn-block" id="btnApprove">✓ Aprobar presupuesto</button>
                    <button type="button" class="btn btn-danger-soft btn-block" id="btnReject">✗ Rechazar</button>
                </div>
            </div>

            <div id="responseDone" class="decision-done hidden">
                <div class="icon" id="doneIcon">✓</div>
                <h3 id="doneTitle">¡Listo!</h3>
                <p id="doneMsg">Tu respuesta quedó registrada. El emisor va a recibir el aviso.</p>
            </div>

            <footer class="public-foot">
                <a id="contactLink" href="#" target="_blank" rel="noopener" class="hidden">Contactar al emisor</a>
                <div class="powered">Generado con <a href="https://presuya.pages.dev/" target="_blank" rel="noopener">Presuya</a></div>
            </footer>

        </div>
    </div>

    <div id="toast" class="toast"></div>

    <script>window.__PUBLIC_TOKEN = ${JSON.stringify(token)};</script>
    <script type="module" src="/js/public-view.js"></script>
</body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            // Cache corto: 5 min en edge, para que si el cliente cambia de logo el preview se actualice pronto.
            'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
    });
}
