import { supabaseAdmin as db } from '../config/db.js';

const storyReadSelect = '*, cuenta_usuario(id_cuenta_usuario, username, avatar_url), categorias(nombre), capitulos(id_capitulo, titulo, created_at)';
const userId = req => req.session?.user?.id;
async function uploadCover(file) {
  if (!file) return null;
  const ext = file.originalname.split('.').pop() || 'jpg';
  const name = Date.now() + '-' + Math.random().toString(16).slice(2) + '.' + ext;
  const { error } = await db.storage.from('portadas').upload(name, file.buffer, { contentType: file.mimetype, upsert: true });
  if (error) throw error;
  return db.storage.from('portadas').getPublicUrl(name).data.publicUrl;
}
async function catalogs() {
  const [categorias, idiomas, audiencias, tiposDerechos, clasificaciones, estadosCuento] = await Promise.all([
    db.from('categorias').select('id_categoria, nombre').order('nombre'),
    db.from('idiomas').select('id, codigo, nombre').order('nombre'),
    db.from('audiencias').select('id, nombre').order('nombre'),
    db.from('tipos_derechos').select('id, nombre').order('nombre'),
    db.from('clasificaciones').select('id, nombre').order('nombre'),
    db.from('estados_cuento').select('id, nombre').order('nombre'),
  ]);
  return { categorias: categorias.data || [], idiomas: idiomas.data || [], audiencias: audiencias.data || [], tiposDerechos: tiposDerechos.data || [], clasificaciones: clasificaciones.data || [], estadosCuento: estadosCuento.data || [] };
}
function optionValue(value, allowed, fallback) {
  const normalized = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return allowed.find(item => normalized.includes(item)) || fallback;
}
function normalizeStory(body, cover, ownerId) {
  const estado = optionValue(body.estado, ['borrador', 'progreso', 'publicado'], 'borrador');
  const visibilidad = optionValue(body.visibilidad, ['privada', 'publica'], 'privada');
  return {
    titulo: body.titulo,
    descripcion: body.descripcion || null,
    portada_url: cover,
    audiencia: optionValue(body.audiencia, ['general', 'adolescentes', 'adultos'], 'general'),
    idioma: optionValue(body.idioma, ['es', 'en'], 'es'),
    derechos: optionValue(body.derechos, ['todos', 'compartido', 'libre'], 'todos'),
    clasificacion: optionValue(body.clasificacion, ['todo', 'maduro'], 'todo'),
    estado,
    visibilidad,
    is_public: estado === 'publicado' && visibilidad === 'publica',
    cuenta_usuario_id: ownerId,
    categoria_id: Number(body.categoria_id) || 1,
  };
}
export async function getStories(_req, res) {
  const { data, error } = await db.from('cuentos').select(storyReadSelect).is('deleted_at', null).eq('estado', 'publicado').eq('visibilidad', 'publica');
  res.status(error ? 500 : 200).json(error ? { error: error.message } : data || []);
}
export async function getStoriesByCategory(req, res) {
  const { data, error } = await db.from('cuentos').select(storyReadSelect).eq('categoria_id', req.params.id).eq('estado', 'publicado').eq('visibilidad', 'publica').is('deleted_at', null);
  res.status(error ? 500 : 200).json(error ? { error: error.message } : data || []);
}
export async function getStoryById(req, res) {
  const { data: cuento, error } = await db.from('cuentos').select(storyReadSelect).eq('id_cuento', req.params.id).is('deleted_at', null).maybeSingle();
  if (error || !cuento) return res.status(404).render('404', { message: 'Historia no encontrada.', loggerUser: req.session?.user || null });
  cuento.capitulos = (cuento.capitulos || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const owner = String(cuento.cuenta_usuario_id) === String(userId(req));
  const visible = cuento.estado === 'publicado' && cuento.visibilidad === 'publica';
  if (!visible && !owner) return res.status(403).render('404', { message: 'Esta historia no esta disponible.', loggerUser: req.session?.user || null });

  const [{ count: likesCount }, liked, listed, following] = await Promise.all([
    db.from('likes_historias').select('*', { count: 'exact', head: true }).eq('cuento_id', cuento.id_cuento),
    userId(req) ? db.from('likes_historias').select('id').eq('cuento_id', cuento.id_cuento).eq('usuario_id', userId(req)).maybeSingle() : Promise.resolve({ data: null }),
    userId(req) ? db.from('lista_lectura').select('id').eq('cuento_id', cuento.id_cuento).eq('usuario_id', userId(req)).maybeSingle() : Promise.resolve({ data: null }),
    userId(req) ? db.from('seguidores').select('seguidor_id').eq('seguidor_id', userId(req)).eq('seguido_id', cuento.cuenta_usuario_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  res.render('story', { cuento, likesCount: likesCount || 0, isLiked: !!liked?.data, isInList: !!listed?.data, isFollowing: !!following?.data, user: req.session?.user || null, loggerUser: req.session?.user || null });
}
export async function getCreateStoryForm(req, res) { res.render('newstorys', { loggerUser: req.session.user, ...(await catalogs()) }); }
export async function createStory(req, res) {
  try {
    const portada = await uploadCover(req.file);
    const row = normalizeStory(req.body, portada, userId(req));
    const { data, error } = await db.from('cuentos').insert(row).select('id_cuento').single();
    if (error) throw error;
    res.redirect('/historias/editar-meta/' + data.id_cuento + '?success=true');
  } catch (error) {
    res.status(500).render('newstorys', { loggerUser: req.session.user, ...(await catalogs()), error: error.message });
  }
}
export async function getMyStories(req, res) {
  const { data } = await db.from('cuentos').select('*').eq('cuenta_usuario_id', userId(req)).is('deleted_at', null).order('created_at', { ascending: false });
  res.render('mystories', { tituloPagina: 'Mis Historias | Willpig Studio', stories: data || [], loggerUser: req.session.user });
}
export async function getEditStory(req, res) {
  const { data: cuento } = await db.from('cuentos').select('*, capitulos(id_capitulo, titulo, created_at)').eq('id_cuento', req.params.id).maybeSingle();
  if (!cuento) return res.status(404).render('404', { message: 'Historia no encontrada.', loggerUser: req.session.user });
  if (String(cuento.cuenta_usuario_id) !== String(userId(req))) return res.status(403).render('404', { message: 'No tienes permiso.', loggerUser: req.session.user });
  cuento.capitulos = (cuento.capitulos || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.render('manage_story', { cuento, loggerUser: req.session.user });
}
export async function getEditMetadata(req, res) {
  const { data: cuento } = await db.from('cuentos').select('*').eq('id_cuento', req.params.id).maybeSingle();
  if (!cuento) return res.status(404).render('404', { message: 'Historia no encontrada.', loggerUser: req.session.user });
  if (String(cuento.cuenta_usuario_id) !== String(userId(req))) return res.status(403).render('404', { message: 'No tienes permiso.', loggerUser: req.session.user });
  res.render('editstory', { cuento, loggerUser: req.session.user, ...(await catalogs()) });
}
export async function editStory(req, res) {
  const { data: current } = await db.from('cuentos').select('*').eq('id_cuento', req.params.id).maybeSingle();
  if (!current || String(current.cuenta_usuario_id) !== String(userId(req))) return res.status(403).render('404', { message: 'No tienes permiso.', loggerUser: req.session.user });
  const portada = await uploadCover(req.file) || current.portada_url;
  const row = normalizeStory(req.body, portada, current.cuenta_usuario_id);
  delete row.cuenta_usuario_id;
  await db.from('cuentos').update(row).eq('id_cuento', req.params.id);
  res.redirect('/historias/editar/' + req.params.id);
}
