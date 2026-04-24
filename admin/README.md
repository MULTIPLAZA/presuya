# Presuya — Admin scripts

Scripts locales para administrar la app. **No se despliegan** a Cloudflare Pages
(el `service_role` key nunca debe salir de tu PC).

## Setup (una sola vez)

```bash
cd admin
npm install
cp .env.example .env
# editá .env y pegá tu SUPABASE_SERVICE_ROLE_KEY
# la sacás de: Supabase Dashboard → Project Settings → API → service_role (secret)
```

## Crear un usuario

```bash
node create-user.mjs <email> <password> "<nombre del negocio>"
```

Ejemplo:

```bash
node create-user.mjs juan@ejemplo.com Juan1234 "Juan Electricidad"
```

Qué hace:

1. Crea el usuario en `auth.users` con email ya confirmado (el cliente no necesita
   revisar el correo).
2. Crea su perfil en `presu_profiles` con el nombre del negocio que le pases.
3. Te imprime las credenciales listas para pasarle al cliente por WhatsApp.

El cliente entra a `https://presuya.pages.dev/`, pone email + password, y la
primera pantalla ya le pide completar el resto (RUC, dirección, logo, color de
marca, etc).

## Importante: desactivar el signup público

Además de haber sacado la UI de "Crear cuenta" del login, hay que **apagar el
signup a nivel API** en Supabase. Si no, un atacante podría seguir creando
cuentas con un curl:

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. **Authentication → Providers → Email**.
3. Desactivar **"Enable sign ups"** (o "Allow new users to sign up").
4. Guardar.
