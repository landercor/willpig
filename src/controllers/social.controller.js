import { supabaseAdmin as db } from '../config/db.js';
const userId = req => req.session?.user?.id;
async function count(table, col, val) { const { count } = await db.from(table).select('*', { count: 'exact', head: true }).eq(col, val); return count || 0; }
export async function seguirUsuario(req, res) { 
  if (String(userId(req)) === String(req.params.id)) return res.status(400).json({ error: 'No puedes seguirte a ti mismo.' }); 
  await db.from('seguidores').upsert({ seguidor_id: userId(req), seguido_id: req.params.id }); 
  await db.from('notificaciones').insert({ cuenta_usuario_id: req.params.id, tipo: 'nuevo_seguidor', contenido: 'Tienes un nuevo seguidor.', vista: false });
  res.json({ siguiendo: true, total: await count('seguidores', 'seguido_id', req.params.id) }); 
}
export async function dejarDeSeguir(req, res) { await db.from('seguidores').delete().eq('seguidor_id', userId(req)).eq('seguido_id', req.params.id); res.json({ siguiendo: false, total: await count('seguidores', 'seguido_id', req.params.id) }); }
export async function estadoSeguimiento(req, res) { const { data } = await db.from('seguidores').select('seguidor_id').eq('seguidor_id', userId(req)).eq('seguido_id', req.params.id).maybeSingle(); res.json({ siguiendo: !!data }); }
export async function darLike(req, res) { 
  await db.from('likes_historias').upsert({ usuario_id: userId(req), cuento_id: Number(req.params.id) }, { onConflict: 'usuario_id,cuento_id' }); 
  const { data: cuento } = await db.from('cuentos').select('cuenta_usuario_id').eq('id_cuento', req.params.id).maybeSingle();
  if (cuento && String(cuento.cuenta_usuario_id) !== String(userId(req))) {
    await db.from('notificaciones').insert({ cuenta_usuario_id: cuento.cuenta_usuario_id, tipo: 'like', contenido: 'A alguien le gustó tu historia.', vista: false });
  }
  res.json({ liked: true, total: await count('likes_historias', 'cuento_id', req.params.id) }); 
}
export async function quitarLike(req, res) { await db.from('likes_historias').delete().eq('usuario_id', userId(req)).eq('cuento_id', req.params.id); res.json({ liked: false, total: await count('likes_historias', 'cuento_id', req.params.id) }); }
export async function agregarALista(req, res) { await db.from('lista_lectura').upsert({ usuario_id: userId(req), cuento_id: Number(req.params.id) }, { onConflict: 'usuario_id,cuento_id' }); res.json({ enLista: true }); }
export async function quitarDeLista(req, res) { await db.from('lista_lectura').delete().eq('usuario_id', userId(req)).eq('cuento_id', req.params.id); res.json({ enLista: false }); }
export async function getComentarios(req, res) { const { data } = await db.from('comentarios').select('*, cuenta_usuario(id_cuenta_usuario, username, avatar_url)').eq('cuento_id', req.params.cuentoId).order('created_at', { ascending: false }); res.json({ comentarios: data || [] }); }
export async function postComentario(req, res) { 
  const contenido = String(req.body.contenido || '').trim(); 
  if (!contenido) return res.status(400).json({ error: 'El comentario no puede estar vacio.' }); 
  const { data, error } = await db.from('comentarios').insert({ cuento_id: Number(req.params.cuentoId), usuario_id: userId(req), contenido }).select('*, cuenta_usuario(id_cuenta_usuario, username, avatar_url)').single(); 
  const { data: cuento } = await db.from('cuentos').select('cuenta_usuario_id').eq('id_cuento', req.params.cuentoId).maybeSingle();
  if (cuento && String(cuento.cuenta_usuario_id) !== String(userId(req))) {
    await db.from('notificaciones').insert({ cuenta_usuario_id: cuento.cuenta_usuario_id, tipo: 'comentario', contenido: 'Han comentado en tu historia.', vista: false });
  }
  res.status(error ? 500 : 201).json(error ? { error: error.message } : { comentario: data }); 
}
export async function deleteComentario(req, res) { await db.from('comentarios').delete().eq('id', req.params.comentarioId).eq('usuario_id', userId(req)); res.json({ ok: true }); }
