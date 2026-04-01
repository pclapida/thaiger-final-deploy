import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ymgbcedizhhoelwjkoxj.supabase.co';
const supabaseKey = 'sb_publishable_1Dsv1G_Jyq27zK_rV2ABBQ_tljg1m6i';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const email = 'pclapida@gmail.com';
  const password = 'Josepapa1.';
  const name = 'Juan (Admin)';

  console.log(`Intentando crear cuenta para ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name
      }
    }
  });

  if (error) {
    console.error('Error al registrar usuario:', error.message);
    return;
  }

  if (data.user) {
    console.log('Usuario creado en Supabase Auth con ID:', data.user.id);
    
    const { error: dbError } = await supabase.from('users').upsert({
      id: data.user.id,
      email: data.user.email,
      name: name,
      role: 'admin'
    });

    if (dbError) {
      console.error('Error al dar permisos de admin:', dbError.message);
    } else {
      console.log('¡Éxito! El usuario ha sido creado y convertido en ADMIN.');
    }
  }
}

createAdmin();
