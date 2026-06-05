import { supabaseAdmin } from './src/config/db.js';
async function test() {
  const { data, error } = await supabaseAdmin
    .from('cuentos')
    .select(`id_cuento, titulo, descripcion, portada_url, estado, visibilidad, audiencia, idioma, vistas, created_at, categoria_id, cuenta_usuario ( username )`)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log(`Total historias devueltas por la query: ${data.length}`);
    console.log(data);
  }
  process.exit(0);
}
test();
