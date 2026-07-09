import { supabaseAdmin } from '../config/db.js';
import bcrypt from 'bcrypt';

async function test() {
  const usersWithPlaintext = [
    { email: 'Eticaextendida@gmail.com', plain: '123456' }, 
    { email: 'santiago074se@gmail.com', plain: 'r12345t' },
    { email: 'christirojas0@gmail.com', plain: '123456' },
    { email: 'landeref@gmail.com', plain: ',.,213243' },
    { email: 'landereF8@gmail.com', plain: ',.,213243' },
    { email: 'landereF82@gmail.com', plain: ',.,213243' }
  ];

  for (const item of usersWithPlaintext) {
    const { data: user } = await supabaseAdmin
      .from("cuenta_usuario")
      .select("id_cuenta_usuario")
      .eq("email", item.email)
      .single();

    if (user) {
      const { data: cred } = await supabaseAdmin
        .from("cuenta_credenciales")
        .select("clave_hash")
        .eq("cuenta_usuario_id", user.id_cuenta_usuario)
        .single();
      
      if (cred) {
        const matches = await bcrypt.compare(item.plain, cred.clave_hash);
        console.log(`Email: ${item.email}, Plain: "${item.plain}", Matches Hash: ${matches}`);
      } else {
        console.log(`Email: ${item.email} has no credentials in cuenta_credenciales`);
      }
    } else {
      console.log(`Email: ${item.email} not found in cuenta_usuario`);
    }
  }

  process.exit(0);
}

test();
