// controllers/story.controller.js
import { supabaseAdmin as supabase } from '../config/db.js';
import { historiaService } from '../services/historia.service.js';
import { socialService } from '../services/social.service.js';

// GET /api/cuentos — traer todos los cuentos públicos y publicados
export const getStories = async (req, res) => {
  const { data, error } = await supabase
    .from('cuentos')
    .select(`
      id_cuento,
      titulo,
      descripcion,
      portada_url,
      estado,
      audiencia,
      created_at,
      cuenta_usuario ( id_cuenta_usuario, username, avatar_url ),
      categorias ( nombre )
    `)
    .eq('estado', 'publicado')
    .eq('visibilidad', 'publica')

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

// GET /api/cuentos/:id — traer un cuento con sus capítulos
export const getStoryById = async (req, res) => {
  const { id } = req.params

  try {
    const data = await historiaService.getStoryByIdForRead(id);

    if (!data) {
      return res.status(404).render('404', { message: "Cuento no encontrado" });
    }

    // --- VALIDACIÓN DE PRIVACIDAD ---
    const sessionId = req.session?.user?.id || req.session?.user?.id_cuenta_usuario;
    const isAuthor = !!sessionId && String(data.cuenta_usuario_id) === String(sessionId);
    const isPublic = data.estado === 'publicado' && data.visibilidad === 'publica';

    if (!isPublic && !isAuthor) {
      return res.status(403).render('404', {
        message: "Esta historia es privada o se encuentra en estado de borrador.",
        loggerUser: req.session.user
      });
    }
    // --------------------------------

    // Increment views for public stories loaded by someone else
    if (isPublic && !isAuthor) {
      await historiaService.incrementViews(id);
      await supabase.from('cuentos').update({ vistas: (data.vistas || 0) + 1 }).eq('id_cuento', id);
    }

    // Likes data
    let isLiked = false;
    let likesCount = 0;
    
    try {
      const { count } = await supabase.from('likes_historias').select('*', { count: 'exact', head: true }).eq('cuento_id', id);
      if (count) likesCount = count;

      if (req.session && req.session.user) {
        const loggerId = req.session.user.id_cuenta_usuario || req.session.user.id;
        isLiked = await socialService.estadoLike(loggerId, id);
      }
    } catch (e) {
      console.error('Error fetching likes:', e.message);
    }

    // Lista de lectura state
    let isInList = false;
    try {
      if (req.session?.user) {
        const loggerId = req.session.user.id_cuenta_usuario || req.session.user.id;
        isInList = await socialService.estadoLista(loggerId, id);
      }
    } catch (e) { /* tabla puede no existir aún */ }

    res.render('story', {
      cuento: data,
      likesCount,
      isLiked,
      isInList,
      user: req.session.user,
      loggerUser: req.session.user
    })
  } catch (error) {
    console.error('Error in getStoryById:', error);
    return res.status(500).json({ error: error.message })
  }
}

// GET /api/cuentos/category/:id — cuentos por categoría
export const getStoriesByCategory = async (req, res) => {
  const { id } = req.params

  const { data, error } = await supabase
    .from('cuentos')
    .select(`
      id_cuento,
      titulo,
      descripcion,
      portada_url,
      cuenta_usuario ( id_cuenta_usuario, username ),
      categorias ( nombre )
    `)
    .eq('categoria_id', id)
    .eq('estado', 'publicado')
    .eq('visibilidad', 'publica')

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

// POST /api/cuentos/new — crear un cuento
export const createStory = async (req, res) => {
  try {
    const {
      titulo,
      descripcion,
      audiencia,
      idioma,
      derechos,
      clasificacion,
      categoria_id, // Ensure this comes from form
      visibilidad
    } = req.body

    // Validate user session
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    console.log("=== SESSION DEBUG ===", JSON.stringify(req.session, null, 2));
    const cuenta_usuario_id = req.session.userId || req.session.user.id_cuenta_usuario || req.session.user.id;

    let portada_url = null;

    // Handle file upload
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('portadas')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('portadas')
        .getPublicUrl(filePath);

      portada_url = publicUrlData.publicUrl;
    }

    const { data, error } = await supabase
      .from('cuentos')
      .insert([{
        titulo,
        descripcion,
        portada_url,
        audiencia: audiencia || 'general',
        idioma,
        derechos: derechos || 'todos',
        clasificacion,
        categoria_id: parseInt(categoria_id) || 1,
        cuenta_usuario_id,
        estado: req.body.estado || 'borrador', // Por defecto borrador
        visibilidad: visibilidad || 'publica' // Por defecto publica
      }])
      .select()

    if (error) throw error;

    // Redirige al formulario de edición (metadatos/portada)
    const newStory = data[0];
    res.redirect(`/historias/editar-meta/${newStory.id_cuento}?success=true`);

  } catch (error) {
    console.error("Error creating story:", error);
    res.status(500).render('newstorys', {
      loggerUser: req.session.user,
      error: "Error al crear la historia: " + error.message
    });
  }
}

// GET /historias/mis — Ver mis historias (propias)
export const getMyStories = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }

    const userId = req.session.user.id;

    const { data: stories, error } = await supabase
      .from('cuentos')
      .select(`
        id_cuento,
        titulo,
        descripcion,
        portada_url,
        estado,
        vistas,
        created_at
      `)
      .eq('cuenta_usuario_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.render('mystories', {
      tituloPagina: 'Mis Historias | Willpig Studio',
      stories: stories || [],
      loggerUser: req.session.user
    });

  } catch (error) {
    console.error('Error al obtener mis historias:', error);
    res.status(500).send("Error al cargar tus historias");
  }
}

// GET /historias/editar/:id — Gestionar una historia (Panel del Autor)
export const getEditStory = async (req, res) => {
  const { id } = req.params;

  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }

    const { data: cuento, error } = await supabase
      .from('cuentos')
      .select(`
        id_cuento,
        titulo,
        descripcion,
        portada_url,
        estado,
        visibilidad,
        cuenta_usuario_id,
        capitulos ( id_capitulo, titulo, created_at )
      `)
      .eq('id_cuento', id)
      .single();

    if (error || !cuento) {
      return res.status(404).render('404', { message: "Historia no encontrada" });
    }

    // Verificar autoría
    const userId = req.session.userId || req.session.user.id_cuenta_usuario || req.session.user.id;
    if (String(cuento.cuenta_usuario_id) !== String(userId)) {
      return res.status(403).render('404', { message: "No tienes permiso para editar esta historia" });
    }

    // Ordenar capítulos
    if (cuento.capitulos) {
      cuento.capitulos.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    res.render('manage_story', {
      cuento,
      loggerUser: req.session.user
    });

  } catch (error) {
    console.error('Error al obtener gestión de historia:', error);
    res.status(500).send("Error del servidor");
  }
}

// GET /historias/editar-meta/:id — Formulario de edición (Metadatos)
export const getEditMetadata = async (req, res) => {
  const { id } = req.params;

  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }

    const { data: cuento, error } = await supabase
      .from('cuentos')
      .select(`
        id_cuento,
        titulo,
        descripcion,
        portada_url,
        estado,
        visibilidad,
        audiencia,
        idioma,
        derechos,
        clasificacion,
        categoria_id,
        cuenta_usuario_id
      `)
      .eq('id_cuento', id)
      .single();

    if (error || !cuento) {
      return res.status(404).render('404', { message: "Historia no encontrada" });
    }

    // Verificar autoría
    const userId = req.session.userId || req.session.user.id_cuenta_usuario || req.session.user.id;
    if (String(cuento.cuenta_usuario_id) !== String(userId)) {
      return res.status(403).render('404', { message: "No tienes permiso para editar esta historia" });
    }

    res.render('editstory', {
      cuento,
      loggerUser: req.session.user
    });

  } catch (error) {
    console.error('Error al obtener formulario de edición:', error);
    res.status(500).send("Error del servidor");
  }
}

// Función eliminada, manejada por chapter.controller.js
// POST /historias/editar/:id — Actualizar una historia
export const editStory = async (req, res) => {
  const { id } = req.params;
  const {
    titulo,
    descripcion,
    audiencia,
    idioma,
    derechos,
    clasificacion,
    categoria_id,
    visibilidad,
    estado
  } = req.body;

  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }

    // Identificar usuario
    const userId = req.session.userId || req.session.user.id_cuenta_usuario || req.session.user.id;

    // Verificar autoría antes de actualizar
    const { data: cuento, error: fetchError } = await supabase
      .from('cuentos')
      .select('cuenta_usuario_id, portada_url')
      .eq('id_cuento', id)
      .single();

    if (fetchError || !cuento) {
      return res.status(404).render('404', { message: "Historia no encontrada" });
    }

    if (String(cuento.cuenta_usuario_id) !== String(userId)) {
      return res.status(403).render('404', { message: "No tienes permiso para editar esta historia" });
    }

    let portada_url = cuento.portada_url;

    // Manejar nueva portada si existe
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('portadas')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('portadas')
        .getPublicUrl(filePath);

      portada_url = publicUrlData.publicUrl;
    }

    const { error: updateError } = await supabase
      .from('cuentos')
      .update({
        titulo,
        descripcion,
        portada_url,
        audiencia: audiencia || 'general',
        idioma,
        derechos: derechos || 'todos',
        clasificacion,
        categoria_id: parseInt(categoria_id) || 1,
        visibilidad: visibilidad || 'publica',
        estado: estado || 'borrador'
      })
      .eq('id_cuento', id);

    if (updateError) throw updateError;

    res.redirect(`/historias/editar/${id}`);

  } catch (error) {
    console.error('Error al actualizar la historia:', error);
    res.status(500).send("Error al actualizar la historia");
  }
};
