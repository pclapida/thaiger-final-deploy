/**
 * Convierte una cuenta existente en administradora (o crea una nueva).
 *
 *   node scripts/create-admin.js correo@ejemplo.com "MiPassword123"
 *
 * Requiere las variables de entorno del proyecto de Supabase:
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY=<service_role key>   (necesaria para asignar el rol)
 *
 * Nunca escribas las llaves dentro de este archivo: son secretas y quedarían
 * guardadas en el historial de git.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

const [email, password, name = 'Administrador Thaiger'] = process.argv.slice(2);

if (!supabaseUrl || !serviceKey) {
  console.error('Falta configurar SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno.');
  process.exit(1);
}

if (!email || !password) {
  console.error('Uso: node scripts/create-admin.js <correo> <password> ["Nombre"]');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`Creando/actualizando la cuenta ${email}...`);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  let userId = data?.user?.id;

  if (error) {
    if (!/already/i.test(error.message)) {
      console.error('Error al crear el usuario:', error.message);
      process.exit(1);
    }

    console.log('La cuenta ya existía; se buscará su id para darle permisos.');
    const { data: list, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('No se pudo consultar la lista de usuarios:', listError.message);
      process.exit(1);
    }
    userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  }

  if (!userId) {
    console.error('No se pudo determinar el id del usuario.');
    process.exit(1);
  }

  const { error: dbError } = await supabase
    .from('users')
    .upsert({ id: userId, email, name, role: 'admin' });

  if (dbError) {
    console.error('Error al asignar el rol de administrador:', dbError.message);
    process.exit(1);
  }

  console.log(`Listo. ${email} ya es administrador (id ${userId}).`);
}

main();
