import { supabaseAdmin as db } from '../config/db.js';
const userId = req => req.session?.user?.id;
async function storyOwner(cuentoId) { const { data } = await db.from('cuentos').select('cuenta_usuario_id, titulo').eq('id_cuento', cuentoId).maybeSingle(); return data; }
export async function createChapter(req, res) {
  const owner = await storyOwner(req.body.cuento_id);
  if (!owner || String(owner.cuenta_usuario_id) !== String(userId(req))) return res.status(403).json({ error: 'No tienes permiso.' });
  const { error } = await db.from('capitulos').insert({ titulo: req.body.titulo, contenido: req.body.contenido, cuento_id: Number(req.body.cuento_id) });
  if (error) return res.status(500).json({ error: error.message });
  res.redirect('/historias/editar/' + req.body.cuento_id);
}
export async function getChapters(req, res) { const { data } = await db.from('capitulos').select('*').eq('cuento_id', req.params.id).order('created_at'); res.json(data || []); }
export async function readChapter(req, res) {
  const { data: capitulo } = await db.from('capitulos').select('*, cuentos(titulo, id_cuento, cuenta_usuario_id, categoria_id, estado, visibilidad, vistas, cuenta_usuario(id_cuenta_usuario, username, avatar_url))').eq('id_capitulo', req.params.id).maybeSingle();
  if (!capitulo) return res.status(404).render('404', { message: 'Capitulo no encontrado.', loggerUser: req.session?.user || null });
  
  const owner = String(capitulo.cuentos.cuenta_usuario_id) === String(userId(req));
  const visible = capitulo.cuentos.estado === 'publicado' && capitulo.cuentos.visibilidad === 'publica';
  
  if (!visible && !owner) return res.status(403).render('404', { message: 'Esta historia no esta disponible.', loggerUser: req.session?.user || null });
  if (visible && !owner) await db.from('cuentos').update({ vistas: (capitulo.cuentos.vistas || 0) + 1 }).eq('id_cuento', capitulo.cuentos.id_cuento);

  const { data: all } = await db.from('capitulos').select('id_capitulo').eq('cuento_id', capitulo.cuento_id).order('created_at');
  const idx = (all || []).findIndex(c => String(c.id_capitulo) === String(req.params.id));
  const [{ data: sugerencias }, { count: likesCount }, { count: comentariosCount }] = await Promise.all([
    db.from('cuentos')
      .select('id_cuento, titulo, portada_url, vistas, cuenta_usuario(username)')
      .eq('categoria_id', capitulo.cuentos.categoria_id).eq('estado', 'publicado').eq('visibilidad', 'publica')
      .neq('id_cuento', capitulo.cuento_id).is('deleted_at', null).order('vistas', { ascending: false }).limit(4),
    db.from('likes_historias').select('*', { count: 'exact', head: true }).eq('cuento_id', capitulo.cuentos.id_cuento),
    db.from('comentarios').select('*', { count: 'exact', head: true }).eq('cuento_id', capitulo.cuentos.id_cuento),
  ]);
  res.render('read', {
    capitulo,
    cuento: capitulo.cuentos,
    prevId: idx > 0 ? all[idx - 1].id_capitulo : null,
    nextId: idx >= 0 && idx < all.length - 1 ? all[idx + 1].id_capitulo : null,
    totalCapitulos: (all || []).length,
    likesCount: likesCount || 0,
    comentariosCount: comentariosCount || 0,
    sugerencias: sugerencias || [],
    loggerUser: req.session?.user || null
  });
}
export async function getChapterEditor(req, res) {
  let chapter = { titulo: '', contenido: '', cuento_id: req.params.storyId };
  let storyTitle = 'Nueva Historia';
  if (req.params.id) {
    const { data } = await db.from('capitulos').select('*, cuentos(titulo, cuenta_usuario_id)').eq('id_capitulo', req.params.id).maybeSingle();
    if (!data || String(data.cuentos.cuenta_usuario_id) !== String(userId(req))) return res.status(403).render('404', { message: 'No tienes permiso.', loggerUser: req.session.user });
    chapter = data; storyTitle = data.cuentos.titulo;
  } else {
    const story = await storyOwner(req.params.storyId);
    if (!story || String(story.cuenta_usuario_id) !== String(userId(req))) return res.status(403).render('404', { message: 'No tienes permiso.', loggerUser: req.session.user });
    storyTitle = story.titulo;
  }
  res.render('chapter_editor', { chapter, storyTitle, loggerUser: req.session.user });
}
export async function updateChapter(req, res) {
  const { data: cap } = await db.from('capitulos').select('cuento_id, cuentos(cuenta_usuario_id)').eq('id_capitulo', req.params.id).maybeSingle();
  if (!cap || String(cap.cuentos.cuenta_usuario_id) !== String(userId(req))) return res.status(403).json({ error: 'No tienes permiso.' });
  const { error } = await db.from('capitulos').update({ titulo: req.body.titulo, contenido: req.body.contenido, updated_at: new Date().toISOString() }).eq('id_capitulo', req.params.id);
  res.status(error ? 500 : 200).json(error ? { error: error.message } : { message: 'Capitulo actualizado.' });
}
export async function deleteChapter(req, res) {
  const { data: cap } = await db.from('capitulos').select('cuentos(cuenta_usuario_id)').eq('id_capitulo', req.params.id).maybeSingle();
  if (!cap || String(cap.cuentos.cuenta_usuario_id) !== String(userId(req))) return res.status(403).json({ error: 'No tienes permiso.' });
  await db.from('capitulos').delete().eq('id_capitulo', req.params.id);
  res.json({ message: 'Capitulo eliminado.' });
}
