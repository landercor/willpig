import { supabaseAdmin as supabase } from '../config/db.js';
import { socialService } from '../services/social.service.js';

const getSessionUserId = (req) => (
  req.session?.user?.id ||
  req.session?.user?.id_cuenta_usuario ||
  req.session?.userId ||
  null
);

// ─────────────────────────────────────────
// COMENTARIOS
// ─────────────────────────────────────────

/** GET /social/comentarios/:cuentoId — listar comentarios de una historia */
export const getComentarios = async (req, res) => {
  const { cuentoId } = req.params;
  try {
    const { data, error } = await supabase
      .from('comentarios')
      .select(`
        id,
        contenido,
        created_at,
        usuario_id,
        cuenta_usuario ( username, avatar_url )
      `)
      .eq('cuento_id', cuentoId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.json({ comentarios: data || [] });
  } catch (e) {
    console.error('Error obteniendo comentarios:', e.message);
    return res.status(500).json({ error: 'No se pudieron cargar los comentarios.' });
  }
};

/** POST /social/comentarios/:cuentoId — publicar un comentario */
export const postComentario = async (req, res) => {
  const usuarioId = getSessionUserId(req);
  if (!usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión para comentar.' });

  const { cuentoId } = req.params;
  const contenido = (req.body.contenido || '').trim();

  if (!contenido || contenido.length < 1)  return res.status(400).json({ error: 'El comentario no puede estar vacío.' });
  if (contenido.length > 1000) return res.status(400).json({ error: 'El comentario es demasiado largo (máx. 1000 caracteres).' });

  try {
    const { data, error } = await supabase
      .from('comentarios')
      .insert([{ cuento_id: cuentoId, usuario_id: usuarioId, contenido }])
      .select(`
        id,
        contenido,
        created_at,
        usuario_id,
        cuenta_usuario ( username, avatar_url )
      `)
      .single();

    if (error) throw error;
    return res.status(201).json({ comentario: data });
  } catch (e) {
    console.error('Error publicando comentario:', e.message);
    return res.status(500).json({ error: 'No se pudo publicar el comentario.' });
  }
};

/** DELETE /social/comentarios/borrar/:comentarioId — borrar propio comentario */
export const deleteComentario = async (req, res) => {
  const usuarioId = getSessionUserId(req);
  if (!usuarioId) return res.status(401).json({ error: 'No autorizado.' });

  const { comentarioId } = req.params;

  try {
    // Verificar propiedad antes de borrar
    const { data: comentario, error: fetchErr } = await supabase
      .from('comentarios')
      .select('usuario_id')
      .eq('id', comentarioId)
      .single();

    if (fetchErr || !comentario) return res.status(404).json({ error: 'Comentario no encontrado.' });
    if (String(comentario.usuario_id) !== String(usuarioId)) return res.status(403).json({ error: 'No puedes borrar este comentario.' });

    const { error: delErr } = await supabase
      .from('comentarios')
      .delete()
      .eq('id', comentarioId);

    if (delErr) throw delErr;
    return res.json({ borrado: true });
  } catch (e) {
    console.error('Error borrando comentario:', e.message);
    return res.status(500).json({ error: 'No se pudo borrar el comentario.' });
  }
};

const parsePositiveId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const countRows = async (table, column, value) => {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);

  if (error) throw error;
  return count || 0;
};

const crearNotificacionNuevoSeguidor = async (seguidorId, seguidoId) => {
  const { error } = await supabase
    .from('notificaciones')
    .insert([{
      tipo: 'nuevo_seguidor',
      usuario_destino_id: seguidoId,
      usuario_origen_id: seguidorId
    }]);

  if (error) {
    // fallback columna alternativa
    await supabase
      .from('notificaciones')
      .insert([{
        cuenta_usuario_id: seguidoId,
        tipo: 'nuevo_seguidor',
        mensaje: 'Tienes un nuevo seguidor'
      }]).catch(e => console.error('Error creando notificación de seguidor:', e));
  }
};

// ─────────────────────────────────────────
// SEGUIDORES
// ─────────────────────────────────────────

export const seguirUsuario = async (req, res) => {
  const seguidorId = getSessionUserId(req);
  // Los IDs son UUIDs (string), no enteros
  const seguidoId = req.params.id;

  if (!seguidoId) return res.status(400).json({ error: 'Usuario inválido.' });
  if (!seguidorId) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  if (String(seguidorId) === String(seguidoId)) return res.status(400).json({ error: 'No puedes seguirte a ti mismo.' });

  try {
    const { error } = await supabase
      .from('seguidores')
      .upsert([{ seguidor_id: seguidorId, seguido_id: seguidoId }], { onConflict: 'seguidor_id,seguido_id', ignoreDuplicates: true });

    if (error) throw error;
    await crearNotificacionNuevoSeguidor(seguidorId, seguidoId).catch(() => {});
    const total = await countRows('seguidores', 'seguido_id', seguidoId);
    return res.json({ siguiendo: true, total });
  } catch (error) {
    console.error('Error siguiendo usuario:', error);
    return res.status(500).json({ error: 'No se pudo seguir al usuario.' });
  }
};

export const dejarDeSeguir = async (req, res) => {
  const seguidorId = getSessionUserId(req);
  const seguidoId = req.params.id;

  if (!seguidoId) return res.status(400).json({ error: 'Usuario inválido.' });
  if (!seguidorId) return res.status(401).json({ error: 'Debes iniciar sesión.' });

  try {
    const { error } = await supabase
      .from('seguidores')
      .delete()
      .eq('seguidor_id', seguidorId)
      .eq('seguido_id', seguidoId);

    if (error) throw error;
    const total = await countRows('seguidores', 'seguido_id', seguidoId);
    return res.json({ siguiendo: false, total });
  } catch (error) {
    console.error('Error dejando de seguir:', error);
    return res.status(500).json({ error: 'No se pudo dejar de seguir.' });
  }
};

export const estadoSeguimiento = async (req, res) => {
  const seguidorId = getSessionUserId(req);
  const seguidoId = req.params.id;

  if (!seguidoId) return res.status(400).json({ error: 'Usuario inválido.' });

  try {
    const { data, error } = await supabase
      .from('seguidores').select('id').eq('seguidor_id', seguidorId).eq('seguido_id', seguidoId).maybeSingle();
    if (error) throw error;
    return res.json({ siguiendo: Boolean(data) });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo consultar el seguimiento.' });
  }
};

// ─────────────────────────────────────────
// LIKES
// ─────────────────────────────────────────

export const darLike = async (req, res) => {
  const usuarioId = getSessionUserId(req);
  // IDs son UUIDs (string)
  const cuentoId = req.params.id;

  if (!cuentoId) return res.status(400).json({ error: 'Historia inválida.' });
  if (!usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión.' });

  try {
    const { error } = await supabase
      .from('likes_historias')
      .upsert([{ usuario_id: usuarioId, cuento_id: cuentoId }], { onConflict: 'usuario_id,cuento_id', ignoreDuplicates: true });

    if (error) throw error;
    const total = await countRows('likes_historias', 'cuento_id', cuentoId);
    return res.json({ liked: true, total });
  } catch (error) {
    console.error('Error dando like:', error);
    return res.status(500).json({ error: 'No se pudo dar like.' });
  }
};

export const quitarLike = async (req, res) => {
  const usuarioId = getSessionUserId(req);
  const cuentoId = req.params.id;

  if (!cuentoId) return res.status(400).json({ error: 'Historia inválida.' });
  if (!usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión.' });

  try {
    const { error } = await supabase
      .from('likes_historias').delete().eq('usuario_id', usuarioId).eq('cuento_id', cuentoId);
    if (error) throw error;
    const total = await countRows('likes_historias', 'cuento_id', cuentoId);
    return res.json({ liked: false, total });
  } catch (error) {
    console.error('Error quitando like:', error);
    return res.status(500).json({ error: 'No se pudo quitar el like.' });
  }
};

// ─────────────────────────────────────────
// LISTA DE LECTURA
// ─────────────────────────────────────────

export const agregarALista = async (req, res) => {
  const usuarioId = getSessionUserId(req);
  const cuentoId = req.params.id;

  if (!cuentoId) return res.status(400).json({ error: 'Historia inválida.' });
  if (!usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión.' });

  try {
    await socialService.agregarALista(usuarioId, cuentoId);
    return res.json({ enLista: true });
  } catch (error) {
    console.error('Error al agregar a lista:', error);
    return res.status(500).json({ error: 'No se pudo agregar a la lista.' });
  }
};

export const quitarDeLista = async (req, res) => {
  const usuarioId = getSessionUserId(req);
  const cuentoId = req.params.id;

  if (!cuentoId) return res.status(400).json({ error: 'Historia inválida.' });
  if (!usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión.' });

  try {
    await socialService.quitarDeLista(usuarioId, cuentoId);
    return res.json({ enLista: false });
  } catch (error) {
    console.error('Error al quitar de lista:', error);
    return res.status(500).json({ error: 'No se pudo quitar de la lista.' });
  }
};
