# Presuya — Admin

Hay DOS formas de crear usuarios:

1. **Desde la web (`/admin.html`)** — recomendado día a día.
2. **Desde terminal (`create-user.mjs`)** — útil si la web está caída o
   para crear al primer admin antes de que exista la env var.

## 1) Panel web — `/admin.html`

Ideal para crear licencias desde el celular sin abrir la terminal.

### Setup (una sola vez)

#### Paso 1 — Tener cuenta admin

El dueño necesita una cuenta en Presuya. Si todavía no la tiene,
crearla con el script local (ver sección 2 más abajo) y anotar el
`user_id` que imprime.

#### Paso 2 — Configurar env vars en Cloudflare Pages

1. Entrar a https://dash.cloudflare.com → Pages → proyecto **presuya**.
2. Ir a **Settings → Environment variables**.
3. Agregar en **Production** (y en Preview si se usa):

   | Nombre | Valor | Tipo |
   |---|---|---|
   | `SUPABASE_URL` | `https://bziztkhunfvwetnlczbj.supabase.co` | Plaintext |
   | `SUPABASE_ANON_KEY` | (la anon key, misma que en `js/config.js`) | Plaintext |
   | `SUPABASE_SERVICE_ROLE_KEY` | (el service_role de Supabase — **Encrypted**) | **Encrypted** |
   | `ADMIN_USER_IDS` | `<user_id del dueño>` (separados por coma si son varios) | Plaintext |

4. **Save** y redeploy (cualquier commit nuevo activa el rebuild, o
   tocar **Retry deployment** en el último deploy).

#### Paso 3 — Usar

Ir a `https://presuya.pages.dev/admin.html`, login con la cuenta admin,
llenar email + nombre del negocio (la contraseña se auto-genera), tocar
**Crear licencia**, copiar el mensaje y pegarlo en WhatsApp al cliente.

## 2) Script de terminal — `create-user.mjs`

Útil para el primer admin o cuando el panel web no está disponible.

### Setup

```bash
cd admin
npm install
cp .env.example .env
# editá .env y pegá tu SUPABASE_SERVICE_ROLE_KEY
```

### Uso

```bash
node create-user.mjs <email> <password> "<nombre del negocio>"
```

Ejemplo:

```bash
node create-user.mjs juan@ejemplo.com Juan1234 "Juan Electricidad"
```

Qué hace:

1. Crea el usuario en `auth.users` con email ya confirmado.
2. Crea su perfil en `presu_profiles` con el nombre del negocio.
3. Imprime las credenciales + el **user_id** (útil para la env var
   `ADMIN_USER_IDS`).

## Desactivar signup público

Además de haber sacado la UI de "Crear cuenta" del login, hay que
**apagar el signup a nivel API** en Supabase:

1. Supabase Dashboard → tu proyecto.
2. **Authentication → Providers → Email**.
3. Desactivar **"Enable sign ups"**.
4. Save.

Sin esto, un atacante podría seguir creando cuentas con un curl aunque
no vea el formulario en la web.
