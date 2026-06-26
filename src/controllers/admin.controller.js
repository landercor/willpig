// src/controllers/admin.controller.js
import { supabaseAdmin as supabase } from '../config/db.js';
import { usuarioService } from '../services/usuario.service.js';
import { historiaService } from '../services/historia.service.js';
import { capituloService } from '../services/capitulo.service.js';

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

// Helper: objeto base de variables para el render
const BASE_RENDER = {
  stats: {},
  usuarios: [],
  historias: [],
  categorias: [],
  capitulos: [],
  etiquetas: [],
  notificaciones: [],
  miniaturas: [],
  // Nuevos catálogos
  idiomas: [],
  audiencias: [],
  tipos_derechos: [],
  clasificaciones: [],
  estados_cuento: [],
  estados_usuario: [],
  roles_usuario: [],
  mensaje: null,
  error: null
};

export const getDashboard = async (req, res) => {
  try {
    const [
      totalUsuarios,
      totalHistorias,
      { count: totalCategorias },
      totalCapitulos,
      { count: totalEtiquetas },
      { count: totalNotificaciones }
    ] = await Promise.all([
      usuarioService.getDashboardTotal(),
      historiaService.getDashboardTotal(),
      supabase.from('categorias').select('*', { count: 'exact', head: true }),
      capituloService.getDashboardTotal(),
      supabase.from('etiquetas').select('*', { count: 'exact', head: true }),
      supabase.from('notificaciones').select('*', { count: 'exact', head: true })
    ]);

    res.render('admin', {
      ...BASE_RENDER,
      loggerUser: req.session.user,
      seccion: 'dashboard',
      stats: { totalUsuarios, totalHistorias, totalCategorias, totalCapitulos, totalEtiquetas, totalNotificaciones },
      mensaje: req.query.msg || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error dashboard admin:', err);
    res.status(500).send('Error al cargar el panel');
  }
};

// ─────────────────────────────────────────────
// USUARIOS — CRUD
// ─────────────────────────────────────────────

export const getUsuarios = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const [
      { usuarios, count, totalPages },
      { data: roles_usuario },
      { data: estados_usuario }
    ] = await Promise.all([
      usuarioService.getUsuariosPaginated(page, limit, req.query),
      supabase.from('roles_usuario').select('*'),
      supabase.from('estados_usuario').select('*')
    ]);

    res.render('admin', {
      ...BASE_RENDER,
      loggerUser: req.session.user,
      seccion: 'usuarios',
      usuarios: usuarios || [],
      roles_usuario: roles_usuario || [],
      estados_usuario: estados_usuario || [],
      mensaje: req.query.msg || null,
      error: req.query.error || null,
      page,
      totalPages,
      query: req.query
    });
  } catch (err) {
    console.error('Error listar usuarios:', err);
    res.redirect('/admin?error=Error+al+cargar+usuarios');
  }
};

export const createUsuario = async (req, res) => {
  const { username, email, password, rol = 'lector' } = req.body;
  if (!email || !password || !username) {
    return res.redirect('/admin/usuarios?error=Faltan+datos+requeridos');
  }
  try {
    await usuarioService.createUser({ username, email, password, rol });
    res.redirect(`/admin/usuarios?msg=Usuario+${encodeURIComponent(username)}+creado+exitosamente`);
  } catch (err) {
    console.error('Error crear usuario:', err);
    res.redirect(`/admin/usuarios?error=${encodeURIComponent(err.message || 'Error+al+crear+usuario')}`);
  }
};

export const editUsuario = async (req, res) => {
  const { id } = req.params;
  const { username, email, rol, estado } = req.body;
  try {
    await usuarioService.updateUser(id, { username, email, rol, estado });
    res.redirect('/admin/usuarios?msg=Usuario+actualizado');
  } catch (err) {
    console.error('Error editar usuario:', err);
    res.redirect('/admin/usuarios?error=Error+al+actualizar');
  }
};

export const deleteUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await usuarioService.deleteUser(id);
    res.redirect('/admin/usuarios?msg=Usuario+eliminado');
  } catch (err) {
    console.error('Error eliminar usuario:', err);
    res.redirect('/admin/usuarios?error=Error+al+eliminar');
  }
};

// ─────────────────────────────────────────────
// HISTORIAS (CUENTOS) — CRUD
// ─────────────────────────────────────────────

export const getHistorias = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const [
      { historias, count, totalPages }, 
      { data: categorias }, 
      { data: capitulos },
      { data: audiencias },
      { data: idiomas },
      { data: tipos_derechos },
      { data: clasificaciones },
      { data: estados_cuento }
    ] = await Promise.all([
      historiaService.getHistoriasPaginated(page, limit, req.query),
      supabase.from('categorias').select('id_categoria, nombre').order('nombre', { ascending: true }),
      supabase.from('capitulos').select('id_capitulo, titulo, cuento_id, created_at, contenido').order('created_at', { ascending: true }),
      supabase.from('audiencias').select('*').order('id', { ascending: true }),
      supabase.from('idiomas').select('*').order('id', { ascending: true }),
      supabase.from('tipos_derechos').select('*').order('id', { ascending: true }),
      supabase.from('clasificaciones').select('*').order('id', { ascending: true }),
      supabase.from('estados_cuento').select('*').order('id', { ascending: true })
    ]);

    res.render('admin', {
      ...BASE_RENDER,
      loggerUser: req.session.user,
      seccion: 'historias',
      historias: historias || [],
      categorias: categorias || [],
      capitulos: capitulos || [],
      audiencias: audiencias || [],
      idiomas: idiomas || [],
      tipos_derechos: tipos_derechos || [],
      clasificaciones: clasificaciones || [],
      estados_cuento: estados_cuento || [],
      mensaje: req.query.msg || null,
      error: req.query.error || null,
      page,
      totalPages,
      query: req.query
    });
  } catch (err) {
    console.error('Error listar historias:', err);
    res.redirect('/admin?error=Error+al+cargar+historias');
  }
};

export const createHistoria = async (req, res) => {
  const {
    titulo, descripcion, portada_url, categoria_id,
    cuenta_usuario_id,
    estado = 'borrador', visibilidad = 'publica',
    audiencia = 'general', idioma = 'es',
    derechos = 'todos los derechos reservados', clasificacion = 'todo público'
  } = req.body;

  if (!titulo || !titulo.trim()) {
    return res.redirect('/admin/historias?error=El+titulo+es+requerido');
  }

  try {
    const finalUserId = cuenta_usuario_id || req.session?.userId || req.session?.user?.id;
    if (!finalUserId) {
      return res.redirect('/admin/historias?error=No+se+pudo+identificar+al+usuario.+Vuelve+a+iniciar+sesion');
    }

    let finalCategoriaId = categoria_id ? parseInt(categoria_id) : null;
    if (!finalCategoriaId) {
      const { data: firstCat } = await supabase.from('categorias').select('id_categoria').limit(1).single();
      if (firstCat) finalCategoriaId = firstCat.id_categoria;
    }

    // Resolviendo FKs para la config
    const [
      { data: aud }, { data: idi }, { data: der }, { data: cla }
    ] = await Promise.all([
      supabase.from('audiencias').select('id').eq('nombre', audiencia).single(),
      supabase.from('idiomas').select('id').eq('codigo', idioma).single(),
      supabase.from('tipos_derechos').select('id').eq('nombre', derechos).single(),
      supabase.from('clasificaciones').select('id').eq('nombre', clasificacion).single(),
    ]);

    const insertData = {
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      portada_url: portada_url?.trim() || null,
      cuenta_usuario_id: finalUserId,
      categoria_id: finalCategoriaId,
      estado, 
      visibilidad,
      audiencia_id: aud?.id,
      idioma_id: idi?.id,
      derechos_id: der?.id,
      clasificacion_id: cla?.id
    };

    await historiaService.createStory(insertData);
    res.redirect(`/admin/historias?msg=Historia+"${encodeURIComponent(titulo.trim())}"+creada+exitosamente`);
  } catch (err) {
    console.error('Error crear historia:', err);
    res.redirect(`/admin/historias?error=${encodeURIComponent(err.message || 'Error+al+crear')}`);
  }
};

export const editHistoria = async (req, res) => {
  const { id } = req.params;
  const { titulo, descripcion, portada_url, categoria_id, estado, visibilidad, audiencia, idioma, derechos, clasificacion } = req.body;
  try {
    const updates = {};
    if (titulo !== undefined && titulo.trim()) updates.titulo = titulo.trim();
    if (descripcion !== undefined) updates.descripcion = descripcion.trim() || null;
    if (portada_url !== undefined) updates.portada_url = portada_url.trim() || null;
    if (categoria_id) updates.categoria_id = parseInt(categoria_id);
    if (estado) updates.estado = estado;
    if (visibilidad) updates.visibilidad = visibilidad;
    
    // Resolver fks
    if (audiencia) {
      const { data: a } = await supabase.from('audiencias').select('id').eq('nombre', audiencia).single();
      if (a) updates.audiencia_id = a.id;
    }
    if (idioma) {
      const { data: i } = await supabase.from('idiomas').select('id').eq('codigo', idioma).single();
      if (i) updates.idioma_id = i.id;
    }
    if (derechos) {
      const { data: d } = await supabase.from('tipos_derechos').select('id').eq('nombre', derechos).single();
      if (d) updates.derechos_id = d.id;
    }
    if (clasificacion) {
      const { data: c } = await supabase.from('clasificaciones').select('id').eq('nombre', clasificacion).single();
      if (c) updates.clasificacion_id = c.id;
    }

    await historiaService.updateStory(id, updates);
    res.redirect('/admin/historias?msg=Historia+actualizada+correctamente');
  } catch (err) {
    console.error('Error editar historia:', err);
    res.redirect('/admin/historias?error=Error+al+actualizar');
  }
};

export const deleteHistoria = async (req, res) => {
  const { id } = req.params;
  try {
    await historiaService.deleteStory(id);
    res.redirect('/admin/historias?msg=Historia+eliminada');
  } catch (err) {
    console.error('Error eliminar historia:', err);
    res.redirect('/admin/historias?error=Error+al+eliminar');
  }
};

// ─────────────────────────────────────────────
// CAPÍTULOS, NOTIFICACIONES, ETIQUETAS, MINIATURAS, CATEGORIAS...
// (Restaurando el comportamiento original simplificado)
// ─────────────────────────────────────────────

// Generic Handler para Catálogos Simples (ID y Nombre)
const handleCatalogo = (tabla, seccion, pk = 'id') => ({
  get: async (req, res) => {
    try {
      const { data, error } = await supabase.from(tabla).select('*').order('id', { ascending: true });
      if (error && error.code !== '42P01') throw error; // Ignorar si la tabla no existe en alguna BD vieja

      res.render('admin', {
        ...BASE_RENDER,
        loggerUser: req.session.user,
        seccion,
        [seccion]: data || [],
        mensaje: req.query.msg || null,
        error: req.query.error || null
      });
    } catch (err) {
      console.error(`Error listar ${seccion}:`, err);
      res.redirect(`/admin?error=Error+al+cargar+${seccion}`);
    }
  },
  create: async (req, res) => {
    try {
      // Remover CSRF/campos raros y mapear body a columnas
      const { ...campos } = req.body;
      const { error } = await supabase.from(tabla).insert([campos]);
      if (error) throw error;
      res.redirect(`/admin/${seccion}?msg=Registro+creado`);
    } catch (err) {
      res.redirect(`/admin/${seccion}?error=Error+al+crear`);
    }
  },
  edit: async (req, res) => {
    try {
      const { id } = req.params;
      const { ...campos } = req.body;
      const { error } = await supabase.from(tabla).update(campos).eq(pk, id);
      if (error) throw error;
      res.redirect(`/admin/${seccion}?msg=Registro+actualizado`);
    } catch (err) {
      res.redirect(`/admin/${seccion}?error=Error+al+actualizar`);
    }
  },
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from(tabla).delete().eq(pk, id);
      if (error) throw error;
      res.redirect(`/admin/${seccion}?msg=Registro+eliminado`);
    } catch (err) {
      res.redirect(`/admin/${seccion}?error=Error+al+eliminar`);
    }
  }
});

// Instanciando Controladores de Catálogo Genéricos
export const catCategorias      = handleCatalogo('categorias', 'categorias', 'id_categoria');
export const catEtiquetas       = handleCatalogo('etiquetas', 'etiquetas', 'id_etiqueta');
export const catMiniaturas      = handleCatalogo('miniaturas', 'miniaturas', 'id_miniatura');
export const catNotificaciones  = handleCatalogo('notificaciones', 'notificaciones', 'id_notificacion');
export const catIdiomas         = handleCatalogo('idiomas', 'idiomas', 'id');
export const catAudiencias      = handleCatalogo('audiencias', 'audiencias', 'id');
export const catTiposDerechos   = handleCatalogo('tipos_derechos', 'tipos_derechos', 'id');
export const catClasificaciones = handleCatalogo('clasificaciones', 'clasificaciones', 'id');
export const catEstadosCuento   = handleCatalogo('estados_cuento', 'estados_cuento', 'id');
export const catEstadosUsuario  = handleCatalogo('estados_usuario', 'estados_usuario', 'id');
export const catRolesUsuario    = handleCatalogo('roles_usuario', 'roles_usuario', 'id');

// Compatibilidad (Wrappers)
export const getCategorias = catCategorias.get;
export const createCategoria = catCategorias.create;
export const editCategoria = catCategorias.edit;
export const deleteCategoria = catCategorias.delete;

export const getEtiquetas = catEtiquetas.get;
export const createEtiqueta = catEtiquetas.create;
export const editEtiqueta = catEtiquetas.edit;
export const deleteEtiqueta = catEtiquetas.delete;

export const getMiniaturas = catMiniaturas.get;
export const createMiniatura = catMiniaturas.create;
export const editMiniatura = catMiniaturas.edit;
export const deleteMiniatura = catMiniaturas.delete;

export const getNotificaciones = catNotificaciones.get;
export const createNotificacion = catNotificaciones.create;
export const editNotificacion = catNotificaciones.edit;
export const deleteNotificacion = catNotificaciones.delete;

// CAPITULOS
export const getCapitulos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const { capitulos, count, totalPages } = await capituloService.getCapitulosPaginated(page, limit);

    res.render('admin', {
      ...BASE_RENDER,
      loggerUser: req.session.user,
      seccion: 'capitulos',
      capitulos: capitulos || [],
      mensaje: req.query.msg || null,
      error: req.query.error || null,
      page,
      totalPages,
      query: req.query
    });
  } catch (err) {
    console.error('Error listar capitulos:', err);
    res.redirect('/admin?error=Error+al+cargar+capitulos');
  }
};

export const createCapitulo = async (req, res) => {
  const { titulo, cuento_id, contenido } = req.body;
  try {
    await capituloService.createCapitulo({ titulo, cuento_id, contenido });
    res.redirect('/admin/historias?msg=Capitulo+creado');
  } catch (err) {
    console.error('Error crear capitulo:', err);
    res.redirect('/admin/historias?error=Error+al+crear+capitulo');
  }
};

export const editCapitulo = async (req, res) => {
  const { id } = req.params;
  const { titulo, cuento_id, contenido } = req.body;
  try {
    await capituloService.updateCapitulo(id, { titulo, cuento_id, contenido });
    res.redirect('/admin/historias?msg=Capitulo+actualizado');
  } catch (err) {
    console.error('Error editar capitulo:', err);
    res.redirect('/admin/historias?error=Error+al+actualizar');
  }
};

export const deleteCapitulo = async (req, res) => {
  const { id } = req.params;
  try {
    await capituloService.deleteCapitulo(id);
    res.redirect('/admin/historias?msg=Capitulo+eliminado');
  } catch (err) {
    console.error('Error eliminar capitulo:', err);
    res.redirect('/admin/historias?error=Error+al+eliminar');
  }
};
