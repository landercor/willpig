import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function migrate() {
  console.log('--- Iniciando Migración de Datos 3NF ---');

  // 1. Cargar diccionarios (catálogos)
  const [{ data: roles }, { data: estadosUser }, { data: estadosCuento }, { data: audiencias }, { data: idiomas }, { data: derechos }, { data: clasificaciones }] = await Promise.all([
    supabase.from('roles_usuario').select('*'),
    supabase.from('estados_usuario').select('*'),
    supabase.from('estados_cuento').select('*'),
    supabase.from('audiencias').select('*'),
    supabase.from('idiomas').select('*'),
    supabase.from('tipos_derechos').select('*'),
    supabase.from('clasificaciones').select('*')
  ]);

  const mapByName = (arr) => arr.reduce((acc, el) => ({ ...acc, [(el.nombre || el.codigo).toLowerCase()]: el.id }), {});
  const rMap = mapByName(roles || []);
  const euMap = mapByName(estadosUser || []);
  const ecMap = mapByName(estadosCuento || []);
  const auMap = mapByName(audiencias || []);
  const idMap = mapByName(idiomas || []);
  const deMap = mapByName(derechos || []);
  const clMap = mapByName(clasificaciones || []);

  // =========================================================================
  // MIGRACIÓN DE USUARIOS
  // =========================================================================
  console.log('\n[1/2] Migrando Usuarios y Credenciales...');
  const { data: users, error: usersErr } = await supabase.from('cuenta_usuario').select('*');
  if (usersErr) throw usersErr;

  let credsInserted = 0;
  let usersUpdated = 0;

  for (const user of users || []) {
    // Hashear contraseña si existe
    if (user.clave) {
      // Verificar si ya migramos
      const { data: existingCred } = await supabase.from('cuenta_credenciales').select('cuenta_usuario_id').eq('cuenta_usuario_id', user.id_cuenta_usuario).maybeSingle();
      if (!existingCred) {
        const hash = await bcrypt.hash(user.clave, 10);
        const { error: insErr } = await supabase.from('cuenta_credenciales').insert({
          cuenta_usuario_id: user.id_cuenta_usuario,
          clave_hash: hash
        });
        if (insErr) console.error(`Error al insertar credencial para ${user.email}:`, insErr.message);
        else credsInserted++;
      }
    }

    // Actualizar rol_id y estado_id
    if (!user.rol_id || !user.estado_id) {
      const rol_id = rMap[(user.rol || 'lector').toLowerCase()] || rMap['lector'];
      const estado_id = euMap[(user.estado || 'activa').toLowerCase()] || euMap['activa'];
      
      const { error: updErr } = await supabase.from('cuenta_usuario')
        .update({ rol_id, estado_id })
        .eq('id_cuenta_usuario', user.id_cuenta_usuario);
      
      if (updErr) console.error(`Error al actualizar usuario ${user.email}:`, updErr.message);
      else usersUpdated++;
    }
  }
  console.log(`✓ Credenciales hasheadas creadas: ${credsInserted}`);
  console.log(`✓ Usuarios con FKs actualizados: ${usersUpdated}`);

  // =========================================================================
  // MIGRACIÓN DE CUENTOS (Historias)
  // =========================================================================
  console.log('\n[2/2] Migrando Cuentos (Config y Métricas)...');
  const { data: cuentos, error: cuentosErr } = await supabase.from('cuentos').select('*');
  if (cuentosErr) throw cuentosErr;

  let configInserted = 0;
  let metricasInserted = 0;

  for (const cuento of cuentos || []) {
    // Migrar config
    const { data: existingConfig } = await supabase.from('cuentos_config').select('cuento_id').eq('cuento_id', cuento.id_cuento).maybeSingle();
    if (!existingConfig) {
      const { error: cfgErr } = await supabase.from('cuentos_config').insert({
        cuento_id: cuento.id_cuento,
        audiencia_id: auMap[(cuento.audiencia || 'general').toLowerCase()] || auMap['general'],
        idioma_id: idMap[(cuento.idioma || 'es').toLowerCase()] || idMap['es'],
        derechos_id: deMap[(cuento.derechos || 'todos los derechos reservados').toLowerCase()] || deMap['todos los derechos reservados'],
        clasificacion_id: clMap[(cuento.clasificacion || 'todo público').toLowerCase()] || clMap['todo público'],
        estado_id: ecMap[(cuento.estado || 'borrador').toLowerCase()] || ecMap['borrador'],
        es_publico: cuento.visibilidad === 'publica' || cuento.is_public === true
      });
      if (cfgErr) console.error(`Error config para cuento ${cuento.id_cuento}:`, cfgErr.message);
      else configInserted++;
    }

    // Migrar métricas
    const { data: existingMetricas } = await supabase.from('cuentos_metricas').select('cuento_id').eq('cuento_id', cuento.id_cuento).maybeSingle();
    if (!existingMetricas) {
      const { error: metErr } = await supabase.from('cuentos_metricas').insert({
        cuento_id: cuento.id_cuento,
        vistas: cuento.vistas || 0
      });
      if (metErr) console.error(`Error métricas para cuento ${cuento.id_cuento}:`, metErr.message);
      else metricasInserted++;
    }
  }

  console.log(`✓ Configuraciones creadas: ${configInserted}`);
  console.log(`✓ Métricas creadas: ${metricasInserted}`);

  console.log('\n--- Migración Finalizada ---');
  console.log('Nota: Los campos obsoletos (ej. `clave`, `rol` en cuenta_usuario y `vistas`, `estado` en cuentos)');
  console.log('pueden ser borrados manualmente de la base de datos después de comprobar que todo funciona.');
}

migrate().catch(console.error);
