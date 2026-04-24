#!/usr/bin/env node
// ============================================
// Presuya — Crear usuario (admin)
//
// Uso:
//   node create-user.mjs <email> <password> [nombre_negocio]
//
// Ejemplo:
//   node create-user.mjs juan@ejemplo.com Juan1234 "Juan Electricidad"
//
// Qué hace:
//   1. Crea el usuario en auth.users con email ya confirmado (no espera email).
//   2. Crea/asegura el perfil en presu_profiles con el nombre de negocio.
//
// Requisitos:
//   - npm install (una sola vez, dentro de la carpeta admin/)
//   - copiar .env.example como .env y pegar SERVICE_ROLE_KEY
// ============================================

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const [, , emailArg, passwordArg, ...nombreParts] = process.argv;
const email = (emailArg || '').trim().toLowerCase();
const password = passwordArg || '';
const nombreNegocio = nombreParts.join(' ').trim() || 'Mi Negocio';

if (!email || !password) {
    console.error('Uso: node create-user.mjs <email> <password> [nombre_negocio]');
    process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || serviceKey.startsWith('pega-aca')) {
    console.error('Error: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    console.error('Copiá .env.example como .env y completá las credenciales.');
    process.exit(1);
}

if (password.length < 6) {
    console.error('Error: la contraseña tiene que tener al menos 6 caracteres.');
    process.exit(1);
}

const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    console.log(`\n→ Creando usuario ${email} ...`);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });

    if (cErr) {
        if (String(cErr.message || '').toLowerCase().includes('already')) {
            console.error(`  ✗ Ya existe un usuario con ese email.`);
        } else {
            console.error(`  ✗ ${cErr.message}`);
        }
        process.exit(1);
    }

    const userId = created.user.id;
    console.log(`  ✓ Usuario creado. id=${userId}`);

    // Crear/actualizar perfil
    const { error: pErr } = await admin
        .from('presu_profiles')
        .upsert({
            id: userId,
            nombre_negocio: nombreNegocio,
            email,
        }, { onConflict: 'id' });

    if (pErr) {
        console.error(`  ✗ Se creó el usuario pero falló el perfil: ${pErr.message}`);
        console.error('    Podés completarlo manualmente desde la app (al hacer login).');
        process.exit(1);
    }

    console.log(`  ✓ Perfil inicial listo (nombre_negocio = "${nombreNegocio}")`);
    console.log('\nListo. Credenciales para el cliente:');
    console.log(`  URL:        https://presuya.pages.dev/`);
    console.log(`  Email:      ${email}`);
    console.log(`  Password:   ${password}`);
    console.log(`  (decile que al ingresar complete sus datos en "Mi Negocio")\n`);
}

main().catch(err => {
    console.error('Error inesperado:', err);
    process.exit(1);
});
