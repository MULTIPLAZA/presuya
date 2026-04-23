# Presuya

PWA para técnicos, instaladores y contratistas en Paraguay — crea y envía presupuestos profesionales desde el celular.

## Qué hace

- Registro / login con email+password (Supabase Auth).
- Onboarding del negocio: nombre, RUC, dirección, teléfono, logo, color de marca.
- Crear presupuestos con items libres (descripción + cantidad + precio).
- Cambiar estado: borrador → enviado → aprobado / rechazado / vencido.
- Descarga de PDF con branding propio.
- Envío por WhatsApp con mensaje pre-armado.
- Dashboard con filtros y buscador.
- Numeración correlativa automática (`PRES-AÑO-0001`) por usuario.
- Multi-tenant: cada usuario solo ve lo suyo (Row Level Security en Supabase).
- PWA instalable en celular.

## Stack

- HTML + JS vanilla (ESM) + CSS mobile-first.
- Supabase (Auth + PostgreSQL + Storage).
- html2pdf.js (CDN) para generar PDFs.
- Sin build step. Sin framework.

## Primera configuración

### 1. Supabase

Estamos reusando el proyecto de **CRM-contactos** (las tablas nuevas van con prefijo `presu_` para no pisarnos).

1. Abrir el SQL Editor del proyecto Supabase.
2. Copiar y ejecutar todo el contenido de `supabase/schema.sql`.
3. Esto crea:
    - Tablas `presu_profiles`, `presu_budgets`, `presu_items`.
    - Triggers (auto crear perfil al registrarse, recalcular total, updated_at).
    - Función RPC `presu_next_number` para numeración atómica.
    - Bucket de Storage `presu-logos` con policies.
    - RLS por `auth.uid()`.

### 2. Credenciales

Editar `js/config.js` y pegar las credenciales del proyecto Supabase:

```js
export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU-ANON-KEY';
```

(En CRM-contactos están en su `.env`, mismo proyecto = mismas credenciales.)

### 3. Íconos PWA

Falta generar `assets/icons/icon-192.png` e `icon-512.png`. Mientras tanto la PWA funciona sin íconos reales pero no se ve bien al instalar. Se puede generar con [realfavicongenerator.net](https://realfavicongenerator.net/).

## Correr localmente

```bash
npx http-server -p 8765 -c-1
# abrir http://localhost:8765
```

(No funciona abriendo `index.html` directo con `file://` porque los módulos ESM requieren origen HTTP.)

## Deploy a Cloudflare Pages

1. Crear repo en GitHub, push.
2. Cloudflare Pages → Create project → Connect to Git.
3. Build command: **(vacío)** · Output: `/`.
4. URL queda: `presuya.pages.dev`. Después podés apuntar custom domain.

## Estructura

```
presuya/
├── index.html          # login / signup
├── dashboard.html      # listado + filtros
├── editor.html         # crear/editar presupuesto
├── perfil.html         # onboarding + datos del negocio
├── manifest.json       # PWA
├── service-worker.js
├── css/styles.css      # mobile-first
├── js/
│   ├── config.js           ← pegar credenciales acá
│   ├── supabase-client.js
│   ├── ui.js
│   ├── auth.js
│   ├── dashboard.js
│   ├── perfil.js
│   ├── editor.js
│   └── pdf-template.js
├── assets/icons/
└── supabase/schema.sql ← ejecutar en Supabase SQL Editor
```

## Roadmap (fase 2)

- Link público de aprobación (cliente tap "Aceptar"/"Rechazar").
- Libreta de clientes recurrentes.
- Plantillas de items reutilizables.
- Stats por mes (aprobado/enviado/rechazado, monto total cotizado).
- Pasarela de pago (modelo pago único).
- Multi-usuario por empresa (equipos).
