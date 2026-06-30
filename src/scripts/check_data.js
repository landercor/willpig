import { supabaseAdmin } from 'file:///c:/Users/mello/Documents/Sobre WillPig/willpig_studio/src/config/db.js';

async function check() {
  const { data: users, error: uErr } = await supabaseAdmin
    .from('cuenta_usuario')
    .select('id_cuenta_usuario, username, email, rol, estado');
  
  const { data: cats, error: cErr } = await supabaseAdmin
    .from('categorias')
    .select('*');

  console.log('--- USERS ---');
  console.log(users);
  console.log('--- CATEGORIES ---');
  console.log(cats);
  process.exit(0);
}
check();
