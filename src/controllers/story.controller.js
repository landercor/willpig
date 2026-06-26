// controllers/story.controller.js
import { supabaseAdmin as supabase } from '../config/db.js';
import { historiaService } from '../services/historia.service.js';
import { socialService } from '../services/social.service.js';
import { notificarSeguidoresNuevaHistoria } from '../services/notificacion.service.js';

// ── Helpers internos ──────────────────────────────────────────
const resolveEstadoId = async (nombre) => {
  const { data } = await supabase.from('estados_cuento').select('id').eq('nombre', nombre).single();
  return data?.id ?? 1;
};

const resolveCatalogoId = async (tabla, campo, valor) => {
  if (!valor) return null;
  const { data } = await supabase.from(tabla).select('id').eq(campo, valor).single();
  return data?.id ?? null;
};

// ── GET /api/cuentos — traer todos los cuentos públicos ────────
export const getStories = async (req, res) => {
  const estadoPublicadoId = await resolveEstadoId('publicado');

  const { data, error } = await supabase
    .from('cuentos')
    .select(`
      id_cuento, titulo, descripcion, portada_url, created_at,
      cuenta_usuario ( id_cuenta_usuario, username, avatar_url ),
      categorias ( nombre ),
      cuentos_config ( estado_id, es_publico ),
      cuentos_metricas ( vistas )
    `)
    .eq('cuentos_config.estado_id', estadoPublicadoId)
    .eq('cuentos_config.es_publico', true)
    .is('deleted_at', null);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// ── GET /api/cuentos/:id — detalle de historia ─────────────────
export const getStoryById = async (req, res) => {
  const { id } = req.params;

  try {
    const data = await historiaService.getStoryByIdForRead(id);

    if (!data) {
      return res.status(404).render('404', { message: "Cuento no encontrado" });
    }

    const sessionId = req.session?.user?.id || req.session?.user?.id_cuenta_usuario;
    const isAuthor  = !!sessionId && String(data.cuenta_usuario_id) === String(sessionId);
    const isPublic  = data.estado === 'publicado' && data.es_publico;

    if (!isPublic && !isAuthor) {
      return res.status(403).render('404', {
        message:    "Esta historia es privada o se encuentra en estado de borrador.",
        loggerUser: req.session.user,
      });
    }

    // Incrementar vistas con función atómica (1 sola operación en la BD)
    if (isPublic && !isAuthor) {
      await historiaService.incrementViews(id);
    }

    // Likes
    let isLiked = false;
    let likesCount = 0;
    try {
      const { count } = await supabase
        .from('likes_historias')
        .select('*', { count: 'exact', head: true })
        .eq('cuento_id', id);
      if (count) likesCount = count;

      if (req.session?.user) {
        const loggerId = req.session.user.id_cuenta_usuario || req.session.user.id;
        isLiked = await socialService.estadoLike(loggerId, id);
      }
    } catch (e) {
      console.error('Error fetching likes:', e.message);
    }

    // Lista de lectura
    let isInList = false;
    try {
      if (req.session?.user) {
        const loggerId = req.session.user.id_cuenta_usuario || req.session.user.id;
        isInList = await socialService.estadoLista(loggerId, id);
      }
    } catch (e) { /* ignorar */ }

    res.render('story', {
      cuento: data,
      likesCount,
      isLiked,
      isInList,
      user:       req.session.user,
      loggerUser: req.session.user,
    });
  } catch (error) {
    console.error('Error in getStoryById:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ── GET /api/cuentos/category/:id ─────────────────────────────
export const getStoriesByCategory = async (req, res) => {
  const { id } = req.params;
  const estadoPublicadoId = await resolveEstadoId('publicado');

  const { data, error } = await supabase
    .from('cuentos')
    .select(`
      id_cuento, titulo, descripcion, portada_url,
      cuenta_usuario ( id_cuenta_usuario, username ),
      categorias ( nombre ),
      cuentos_config ( estado_id, es_publico )
    `)
    .eq('categoria_id', id)
    .eq('cuentos_config.estado_id', estadoPublicadoId)
    .eq('cuentos_config.es_publico', true)
    .is('deleted_at', null);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// ── POST /api/cuentos/new — crear historia ─────────────────────
export const createStory = async (req, res) => {
  try {
    const {
      titulo, descripcion, categoria_id, visibilidad,
      audiencia, idioma, derechos, clasificacion, estado
    } = req.body;

    if (!req.session.user) return res.redirect('/auth/login');
    console.log("=== SESSION DEBUG ===", JSON.stringify(req.session, null, 2));

    const cuenta_usuario_id = req.session.userId || req.session.user.id_cuenta_usuario || req.session.user.id;

    let portada_url = null;
    if (req.file) {
      const fileExt  = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('portadas')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
      if (uploadError) throw uploadError;
      portada_url = supabase.storage.from('portadas').getPublicUrl(fileName).data.publicUrl;
    }

    // Resolver IDs de catálogo
    const [
      audiencia_id, idioma_id, derechos_id, clasificacion_id
    ] = await Promise.all([
      resolveCatalogoId('audiencias',      'nombre', audiencia     || 'general'),
      resolveCatalogoId('idiomas',         'codigo', idioma        || 'es'),
      resolveCatalogoId('tipos_derechos',  'nombre', derechos      || 'todos los derechos reservados'),
      resolveCatalogoId('clasificaciones', 'nombre', clasificacion || 'todo público'),
    ]);

    const nuevoEstado   = estado || 'borrador';
    const nuevaEsPublico = (visibilidad === 'publica') && (nuevoEstado === 'publicado');

    const newStory = await historiaService.createStory({
      titulo,
      descripcion,
      portada_url,
      cuenta_usuario_id,
      categoria_id: parseInt(categoria_id) || 1,
      estado:       nuevoEstado,
      es_publico:   nuevaEsPublico,
      audiencia_id,
      idioma_id,
      derechos_id,
      clasificacion_id,
    });

    if (nuevoEstado === 'publicado' && nuevaEsPublico) {
      await notificarSeguidoresNuevaHistoria(cuenta_usuario_id, newStory.id_cuento, newStory.titulo);
    }

    res.redirect(`/historias/editar-meta/${newStory.id_cuento}?success=true`);

  } catch (error) {
    console.error("Error creating story:", error);
    res.status(500).render('newstorys', {
      loggerUser: req.session.user,
      error:      "Error al crear la historia: " + error.message,
    });
  }
};

// ── GET /historias/mis ─────────────────────────────────────────
export const getMyStories = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/auth/login');
    const userId = req.session.user.id;
    const stories = await historiaService.getMyStories(userId);

    res.render('mystories', {
      tituloPagina: 'Mis Historias | Willpig Studio',
      stories:      stories || [],
      loggerUser:   req.session.user,
    });
  } catch (error) {
    console.error('Error al obtener mis historias:', error);
    res.status(500).send("Error al cargar tus historias");
  }
};

// ── GET /historias/editar/:id ──────────────────────────────────
export const getEditStory = async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.session.user) return res.redirect('/auth/login');

    const { data: cuento, error } = await supabase
      .from('cuentos')
      .select(`
        id_cuento, titulo, descripcion, portada_url, cuenta_usuario_id,
        capitulos ( id_capitulo, titulo, created_at, orden ),
        cuentos_config ( estado_id, es_publico, estados_cuento ( nombre ) )
      `)
      .eq('id_cuento', id)
      .single();

    if (error || !cuento) return res.status(404).render('404', { message: "Historia no encontrada" });

    const userId = req.session.userId || req.session.user.id_cuenta_usuario || req.session.user.id;
    if (String(cuento.cuenta_usuario_id) !== String(userId)) {
      return res.status(403).render('404', { message: "No tienes permiso para editar esta historia" });
    }

    if (cuento.capitulos) {
      cuento.capitulos.sort((a, b) => a.orden - b.orden || new Date(a.created_at) - new Date(b.created_at));
    }

    // Normalizar para la vista
    cuento.estado     = cuento.cuentos_config?.estados_cuento?.nombre ?? 'borrador';
    cuento.visibilidad = cuento.cuentos_config?.es_publico ? 'publica' : 'privada';

    res.render('manage_story', { cuento, loggerUser: req.session.user });
  } catch (error) {
    console.error('Error al obtener gestión de historia:', error);
    res.status(500).send("Error del servidor");
  }
};

// ── GET /historias/editar-meta/:id ────────────────────────────
export const getEditMetadata = async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.session.user) return res.redirect('/auth/login');

    const story = await historiaService.getStoryByIdForEdit(id);
    if (!story) return res.status(404).render('404', { message: "Historia no encontrada" });

    const userId = req.session.userId || req.session.user.id_cuenta_usuario || req.session.user.id;
    if (String(story.cuenta_usuario_id) !== String(userId)) {
      return res.status(403).render('404', { message: "No tienes permiso para editar esta historia" });
    }

    const [
      { data: categorias },
      { data: idiomas },
      { data: audiencias },
      { data: tiposDerechos },
      { data: clasificaciones },
      { data: estadosCuento },
    ] = await Promise.all([
      supabase.from('categorias').select('id_categoria, nombre').order('nombre'),
      supabase.from('idiomas').select('id, codigo, nombre'),
      supabase.from('audiencias').select('id, nombre'),
      supabase.from('tipos_derechos').select('id, nombre'),
      supabase.from('clasificaciones').select('id, nombre'),
      supabase.from('estados_cuento').select('id, nombre'),
    ]);

    res.render('editstory', {
      cuento:          story,
      loggerUser:      req.session.user,
      categorias:      categorias      || [],
      idiomas:         idiomas         || [],
      audiencias:      audiencias      || [],
      tiposDerechos:   tiposDerechos   || [],
      clasificaciones: clasificaciones || [],
      estadosCuento:   estadosCuento   || [],
    });
  } catch (error) {
    console.error('Error al obtener formulario de edición:', error);
    res.status(500).send("Error del servidor");
  }
};

// ── POST /historias/editar/:id ────────────────────────────────
export const editStory = async (req, res) => {
  const { id } = req.params;
  const {
    titulo, descripcion, categoria_id, visibilidad, estado,
    audiencia_id, idioma_id, derechos_id, clasificacion_id
  } = req.body;

  try {
    if (!req.session.user) return res.redirect('/auth/login');
    const userId = req.session.userId || req.session.user.id_cuenta_usuario || req.session.user.id;

    // Verificar autoría y obtener estado anterior
    const { data: cuento, error: fetchError } = await supabase
      .from('cuentos')
      .select(`
        cuenta_usuario_id, portada_url,
        cuentos_config ( estado_id, es_publico, estados_cuento ( nombre ) )
      `)
      .eq('id_cuento', id)
      .single();

    if (fetchError || !cuento) return res.status(404).render('404', { message: "Historia no encontrada" });
    if (String(cuento.cuenta_usuario_id) !== String(userId)) {
      return res.status(403).render('404', { message: "No tienes permiso para editar esta historia" });
    }

    const estadoAnterior = cuento.cuentos_config?.estados_cuento?.nombre ?? 'borrador';

    let portada_url = cuento.portada_url;
    if (req.file) {
      const fileExt  = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('portadas').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
      if (uploadError) throw uploadError;
      portada_url = supabase.storage.from('portadas').getPublicUrl(fileName).data.publicUrl;
    }

    const nuevoEstado    = estado || 'borrador';
    const nuevaEsPublico = visibilidad === 'publica' && nuevoEstado === 'publicado';

    await historiaService.updateStory(id, {
      titulo,
      descripcion,
      portada_url,
      categoria_id: parseInt(categoria_id) || 1,
      estado:       nuevoEstado,
      es_publico:   nuevaEsPublico,
      audiencia_id:     audiencia_id     ? parseInt(audiencia_id)     : undefined,
      idioma_id:        idioma_id        ? parseInt(idioma_id)        : undefined,
      derechos_id:      derechos_id      ? parseInt(derechos_id)      : undefined,
      clasificacion_id: clasificacion_id ? parseInt(clasificacion_id) : undefined,
    });

    // Notificar si pasó a publicado
    if (estadoAnterior === 'borrador' && nuevoEstado === 'publicado' && nuevaEsPublico) {
      await notificarSeguidoresNuevaHistoria(userId, id, titulo);
    }

    res.redirect(`/historias/editar/${id}`);
  } catch (error) {
    console.error('Error al actualizar la historia:', error);
    res.status(500).send("Error al actualizar la historia");
  }
};

// ── GET /historias/nueva ──────────────────────────────────────
export const getCreateStoryForm = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/auth/login');

    const [
      { data: categorias, error },
      { data: idiomas },
      { data: audiencias },
      { data: tiposDerechos },
      { data: clasificaciones },
      { data: estadosCuento },
    ] = await Promise.all([
      supabase.from('categorias').select('*'),
      supabase.from('idiomas').select('id, codigo, nombre'),
      supabase.from('audiencias').select('id, nombre'),
      supabase.from('tipos_derechos').select('id, nombre'),
      supabase.from('clasificaciones').select('id, nombre'),
      supabase.from('estados_cuento').select('id, nombre'),
    ]);

    if (error) throw error;

    res.render('newstorys', {
      loggerUser:      req.session.user,
      categorias:      categorias      || [],
      idiomas:         idiomas         || [],
      audiencias:      audiencias      || [],
      tiposDerechos:   tiposDerechos   || [],
      clasificaciones: clasificaciones || [],
      estadosCuento:   estadosCuento   || [],
    });
  } catch (error) {
    console.error('Error al cargar el formulario de creación:', error);
    res.render('newstorys', {
      loggerUser:      req.session.user,
      categorias:      [],
      idiomas:         [],
      audiencias:      [],
      tiposDerechos:   [],
      clasificaciones: [],
      estadosCuento:   [],
      error:           error.message,
    });
  }
};