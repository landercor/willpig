// src/controllers/admin.controller.js
import { supabaseAdmin as supabase } from '../config/db.js';

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
  mensaje: null,
  error: null
};

export const getDashboard = async (req, res) => {
  try {
    const [
      { count: totalUsuarios },
      { count: totalHistorias },
      { count: totalCategorias },
      { count: totalCapitulos },
      { count: totalEtiquetas },
      { count: totalNotificaciones }
    ] = await Promise.all([
      supabase.from('cuenta_usuario').select('*', { count: 'exact', head: true }),
      supabase.from('cuentos').select('*', { count: 'exact', head: true }),
      supabase.from('categorias').select('*', { count: 'exact', head: true }),
      supabase.from('capitulos').select('*', { count: 'exact', head: true }),
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
    const { data: usuarios, error } = await supabase
      .from('cuenta_usuario')
      .select('id_cuenta_usuario, username, email, rol, estado, fecha_registro')
      .order('fecha_registro', { ascending: false });

    if (error) throw error;

    res.render('admin', {
      ...BASE_RENDER,
      loggerUser: req.session.user,
      seccion: 'usuarios',
      usuarios: usuarios || [],
      mensaje: req.query.msg || null,
      error: req.query.error || null
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
    // 1. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, rol }
    });
    if (authError) throw authError;

    // 2. Actualizar el perfil en cuenta_usuario (supabase trigger puede ya haberlo creado)
    // Intentamos actualizar el registro creado por el trigger, si falla insertamos manualmente
    const { error: updateError } = await supabase
      .from('cuenta_usuario')
      .update({ username, rol, estado: 'activa' })
      .eq('email', email);

    if (updateError) {
      // Si no existe todavía, insertar manualmente
      await supabase.from('cuenta_usuario').insert([{ username, email, rol, estado: 'activa' }]);
    }

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
    const { error } = await supabase
      .from('cuenta_usuario')
      .update({ username, email, rol, estado })
      .eq('id_cuenta_usuario', id);

    if (error) throw error;
    res.redirect('/admin/usuarios?msg=Usuario+actualizado');
  } catch (err) {
    console.error('Error editar usuario:', err);
    res.redirect('/admin/usuarios?error=Error+al+actualizar');
  }
};

export const deleteUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('cuenta_usuario')
      .delete()
      .eq('id_cuenta_usuario', id);

    if (error) throw error;
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
    const [{ data: historias, error }, { data: categorias }, { data: capitulos }] = await Promise.all([
      supabase
        .from('cuentos')
        .select(`id_cuento, titulo, descripcion, portada_url, estado, visibilidad, audiencia, idioma, vistas, created_at, categoria_id, cuenta_usuario ( username )`)
        .order('created_at', { ascending: false }),
      supabase.from('categorias').select('id_categoria, nombre').order('nombre', { ascending: true }),
      supabase.from('capitulos').select('id_capitulo, titulo, cuento_id, created_at, contenido').order('created_at', { ascending: true })
    ]);

    if (error) throw error;

    res.render('admin', {
      ...BASE_RENDER,
      loggerUser: req.session.user,
      seccion: 'historias',
      historias: historias || [],
      categorias: categorias || [],
      capitulos: capitulos || [],
      mensaje: req.query.msg || null,
      error: req.query.error || null
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
    derechos = 'todos', clasificacion = 'todo'
  } = req.body;

  if (!titulo || !titulo.trim()) {
    return res.redirect('/admin/historias?error=El+titulo+es+requerido');
  }

  try {
    const finalUserId = cuenta_usuario_id
      || req.session?.userId
      || req.session?.user?.id;

    console.log('=== DEBUG createHistoria ===> cuenta_usuario_id del form:', cuenta_usuario_id, '| de sesión:', req.session?.userId);

    if (!finalUserId) {
      return res.redirect('/admin/historias?error=No+se+pudo+identificar+al+usuario.+Vuelve+a+iniciar+sesion');
    }

    // categoria_id es NOT NULL en la BD - si no viene, obtener la primera disponible
    let finalCategoriaId = categoria_id ? parseInt(categoria_id) : null;
    if (!finalCategoriaId) {
      const { data: firstCat } = await supabase
        .from('categorias')
        .select('id_categoria')
        .limit(1)
        .single();
      if (firstCat) finalCategoriaId = firstCat.id_categoria;
    }

    const insertData = {
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      portada_url: portada_url?.trim() || null,
      cuenta_usuario_id: finalUserId,
      categoria_id: finalCategoriaId,
      estado, visibilidad, audiencia, idioma, derechos, clasificacion
    };

    const { error } = await supabase.from('cuentos').insert([insertData]);
    if (error) throw error;

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
    if (audiencia) updates.audiencia = audiencia;
    if (idioma) updates.idioma = idioma;
    if (derechos) updates.derechos = derechos;
    if (clasificacion) updates.clasificacion = clasificacion;

    const { error } = await supabase
      .from('cuentos')
      .update(updates)
      .eq('id_cuento', id);

    if (error) throw error;
    res.redirect('/admin/historias?msg=Historia+actualizada+correctamente');
  } catch (err) {
    console.error('Error editar historia:', err);
    res.redirect('/admin/historias?error=Error+al+actualizar');
  }
};

export const deleteHistoria = async (req, res) => {
  const { id } = req.params;
  try {
    // Eliminar capítulos primero para respetar FK
    await supabase.from('capitulos').delete().eq('cuento_id', id);

    const { error } = await supabase
      .from('cuentos')
      .delete()
      .eq('id_cuento', id);

    if (error) throw error;
    res.redirect('/admin/historias?msg=Historia+eliminada');
  } catch (err) {
    console.error('Error eliminar historia:', err);
    res.redirect('/admin/historias?error=Error+al+eliminar');
  }
};

// ─────────────────────────────────────────────
// CATEGORÍAS — CRUD
// ─────────────────────────────────────────────

export const getCategorias = async (req, res) => {
  try {
    const { data: categorias, error } = await supabase
      .from('categorias')
      .select('id_categoria, nombre')
      .order('nombre', { ascending: true });

    if (error) throw error;

    res.render('admin', {
      ...BASE_RENDER,
      loggerUser: req.session.user,
      seccion: 'categorias',
      categorias: categorias || [],
      mensaje: req.query.msg || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error listar categorias:', err);
    res.redirect('/admin?error=Error+al+cargar+categorias');
  }
};

export const createCategoria = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.redirect('/admin/categorias?error=El+nombre+es+requerido');
  }
  try {
    const { error } = await supabase
      .from('categorias')
      .insert([{ nombre: nombre.trim() }]);

    if (error) throw error;
    res.redirect('/admin/categorias?msg=Categoria+creada');
  } catch (err) {
    console.error('Error crear categoria:', err);
    res.redirect('/admin/categorias?error=Error+al+crear');
  }
};

export const editCategoria = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  try {
    const { error } = await supabase
      .from('categorias')
      .update({ nombre: nombre.trim() })
      .eq('id_categoria', id);

    if (error) throw error;
    res.redirect('/admin/categorias?msg=Categoria+actualizada');
  } catch (err) {
    console.error('Error editar categoria:', err);
    res.redirect('/admin/categorias?error=Error+al+actualizar');
  }
};

export const deleteCategoria = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id_categoria', id);

    if (error) throw error;
    res.redirect('/admin/categorias?msg=Categoria+eliminada');
  } catch (err) {
    console.error('Error eliminar categoria:', err);
    res.redirect('/admin/categorias?error=Error+al+eliminar');
  }
};

// ─────────────────────────────────────────────
// CAPÍTULOS — CRUD
// ─────────────────────────────────────────────

export const getCapitulos = async (req, res) => {
  try {
    const { data: capitulos, error } = await supabase
      .from('capitulos')
      .select('id_capitulo, titulo, cuento_id, created_at, cuentos(titulo)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.render('admin', {
      ...BASE_RENDER,
      loggerUser: req.session.user,
      seccion: 'capitulos',
      capitulos: capitulos || [],
      mensaje: req.query.msg || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error listar capitulos:', err);
    res.redirect('/admin?error=Error+al+cargar+capitulos');
  }
};

export const createCapitulo = async (req, res) => {
  const { titulo, cuento_id, contenido } = req.body;
  try {
    const { error } = await supabase
      .from('capitulos')
      .insert([{ titulo, cuento_id, contenido }]);

    if (error) throw error;
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
    const { error } = await supabase
      .from('capitulos')
      .update({ titulo, cuento_id, contenido })
      .eq('id_capitulo', id);

    if (error) throw error;
    res.redirect('/admin/historias?msg=Capitulo+actualizado');
  } catch (err) {
    console.error('Error editar capitulo:', err);
    res.redirect('/admin/historias?error=Error+al+actualizar');
  }
};

export const deleteCapitulo = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('capitulos')
      .delete()
      .eq('id_capitulo', id);

    if (error) throw error;
    res.redirect('/admin/historias?msg=Capitulo+eliminado');
  } catch (err) {
    console.error('Error eliminar capitulo:', err);
    res.redirect('/admin/historias?error=Error+al+eliminar');
  }
};

// ─────────────────────────────────────────────
// ETIQUETAS — CRUD
// ─────────────────────────────────────────────

export const getEtiquetas = async (req, res) => {
  try {
    const { data: etiquetas, error } = await supabase
      .from('etiquetas')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;

    res.render('admin', {
      loggerUser: req.session.user,
      seccion: 'etiquetas',
      stats: {},
      usuarios: [],
      historias: [],
      categorias: [],
      capitulos: [],
      etiquetas: etiquetas || [],
      notificaciones: [],
      miniaturas: [],
      mensaje: req.query.msg || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error listar etiquetas:', err);
    res.redirect('/admin?error=Error+al+cargar+etiquetas');
  }
};

export const createEtiqueta = async (req, res) => {
  const { nombre } = req.body;
  try {
    const { error } = await supabase
      .from('etiquetas')
      .insert([{ nombre }]);

    if (error) throw error;
    res.redirect('/admin/etiquetas?msg=Etiqueta+creada');
  } catch (err) {
    console.error('Error crear etiqueta:', err);
    res.redirect('/admin/etiquetas?error=Error+al+crear+etiqueta');
  }
};

export const editEtiqueta = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  try {
    const { error } = await supabase
      .from('etiquetas')
      .update({ nombre })
      .eq('id_etiqueta', id);

    if (error) throw error;
    res.redirect('/admin/etiquetas?msg=Etiqueta+actualizada');
  } catch (err) {
    console.error('Error editar etiqueta:', err);
    res.redirect('/admin/etiquetas?error=Error+al+actualizar');
  }
};

export const deleteEtiqueta = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('etiquetas')
      .delete()
      .eq('id_etiqueta', id);

    if (error) throw error;
    res.redirect('/admin/etiquetas?msg=Etiqueta+eliminada');
  } catch (err) {
    console.error('Error eliminar etiqueta:', err);
    res.redirect('/admin/etiquetas?error=Error+al+eliminar');
  }
};

// ─────────────────────────────────────────────
// NOTIFICACIONES — CRUD
// ─────────────────────────────────────────────

export const getNotificaciones = async (req, res) => {
  try {
    const { data: notificaciones, error } = await supabase
      .from('notificaciones')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw error;

    res.render('admin', {
      ...BASE_RENDER,
      loggerUser: req.session.user,
      seccion: 'notificaciones',
      notificaciones: notificaciones || [],
      mensaje: req.query.msg || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error listar notificaciones:', err);
    res.redirect('/admin?error=Error+al+cargar+notificaciones');
  }
};

export const createNotificacion = async (req, res) => {
  const { cuenta_usuario_id, tipo, mensaje } = req.body;
  try {
    const { error } = await supabase
      .from('notificaciones')
      .insert([{ cuenta_usuario_id, tipo, mensaje }]);

    if (error) throw error;
    res.redirect('/admin/notificaciones?msg=Notificacion+creada');
  } catch (err) {
    console.error('Error crear notificacion:', err);
    res.redirect('/admin/notificaciones?error=Error+al+crear+notificacion');
  }
};

export const editNotificacion = async (req, res) => {
  const { id } = req.params;
  const { tipo, mensaje, leida } = req.body;
  try {
    const { error } = await supabase
      .from('notificaciones')
      .update({ tipo, mensaje, leida: leida === 'true' })
      .eq('id_notificacion', id);

    if (error) throw error;
    res.redirect('/admin/notificaciones?msg=Notificacion+actualizada');
  } catch (err) {
    console.error('Error editar notificacion:', err);
    res.redirect('/admin/notificaciones?error=Error+al+actualizar');
  }
};

export const deleteNotificacion = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('notificaciones')
      .delete()
      .eq('id_notificacion', id);

    if (error) throw error;
    res.redirect('/admin/notificaciones?msg=Notificacion+eliminada');
  } catch (err) {
    console.error('Error eliminar notificacion:', err);
    res.redirect('/admin/notificaciones?error=Error+al+eliminar');
  }
};

// ─────────────────────────────────────────────
// MINIATURAS — CRUD
// ─────────────────────────────────────────────

export const getMiniaturas = async (req, res) => {
  try {
    const { data: miniaturas, error } = await supabase
      .from('miniaturas')
      .select('*')
      .order('id_miniatura', { ascending: false });

    // Si la tabla no existe o da error, enviamos array vacío para no quebrar la app
    const listado = error ? [] : (miniaturas || []);

    res.render('admin', {
      loggerUser: req.session.user,
      seccion: 'miniaturas',
      stats: {},
      usuarios: [],
      historias: [],
      categorias: [],
      capitulos: [],
      etiquetas: [],
      notificaciones: [],
      miniaturas: listado,
      mensaje: req.query.msg || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error listar miniaturas:', err);
    res.redirect('/admin?error=Error+al+cargar+miniaturas');
  }
};

export const createMiniatura = async (req, res) => {
  const { nombre, url } = req.body;
  try {
    const { error } = await supabase
      .from('miniaturas')
      .insert([{ nombre, url }]);

    if (error) throw error;
    res.redirect('/admin/miniaturas?msg=Miniatura+creada');
  } catch (err) {
    console.error('Error crear miniatura:', err);
    res.redirect('/admin/miniaturas?error=Error+al+crear');
  }
};

export const editMiniatura = async (req, res) => {
  const { id } = req.params;
  const { nombre, url } = req.body;
  try {
    const { error } = await supabase
      .from('miniaturas')
      .update({ nombre, url })
      .eq('id_miniatura', id);

    if (error) throw error;
    res.redirect('/admin/miniaturas?msg=Miniatura+actualizada');
  } catch (err) {
    console.error('Error editar miniatura:', err);
    res.redirect('/admin/miniaturas?error=Error+al+actualizar');
  }
};

export const deleteMiniatura = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('miniaturas')
      .delete()
      .eq('id_miniatura', id);

    if (error) throw error;
    res.redirect('/admin/miniaturas?msg=Miniatura+eliminada');
  } catch (err) {
    console.error('Error eliminar miniatura:', err);
    res.redirect('/admin/miniaturas?error=Error+al+eliminar');
  }
};
