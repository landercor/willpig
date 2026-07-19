import bcrypt from 'bcryptjs';
import { supabaseAdmin as db } from '../config/db.js';
export const catalogNames = ['categorias', 'etiquetas', 'notificaciones', 'idiomas', 'audiencias', 'tipos_derechos', 'clasificaciones', 'estados_cuento', 'estados_usuario', 'roles_usuario'];
const tablePk = { categorias: 'id_categoria', etiquetas: 'id_etiqueta', notificaciones: 'id_notificacion', idiomas: 'id', audiencias: 'id', tipos_derechos: 'id', clasificaciones: 'id', estados_cuento: 'id', estados_usuario: 'id', roles_usuario: 'id' };
async function base(seccion) {
  const [roles, estados, categorias, etiquetas] = await Promise.all([
    db.from('roles_usuario').select('*').order('nombre'),
    db.from('estados_usuario').select('*').order('nombre'),
    db.from('categorias').select('*').order('nombre'),
    db.from('etiquetas').select('*').order('nombre'),
  ]);
  return {
    seccion,
    stats: {},
    usuarios: [],
    historias: [],
    capitulos: [],
    comentarios: [],
    categorias: categorias.data || [],
    etiquetas: etiquetas.data || [],
    miniaturas: [],
    notificaciones: [],
    idiomas: [],
    audiencias: [],
    tipos_derechos: [],
    clasificaciones: [],

    estados_cuento: [],
    estados_usuario: estados.data || [],
    roles_usuario: roles.data || [],
    page: 1, totalPages: 1, query: {}
  };
}
async function renderAdmin(req, res, seccion, extra = {}) {
  res.render('admin', {
    ...(await base(seccion)),
    ...extra, 
    loggerUser: req.session.user,
    csrfToken: res.locals.csrfToken
  });
}
export async function getDashboard(req, res) {
  const [u, h, c, e, n] = await Promise.all(['cuenta_usuario', 'cuentos', 'categorias', 'etiquetas', 'notificaciones'].map(t => db.from(t).select('*', { count: 'exact', head: true })));
  renderAdmin(req, res, 'dashboard', {
    stats: { totalUsuarios: u.count || 0, totalHistorias: h.count || 0, totalCategorias: c.count || 0, totalEtiquetas: e.count || 0, totalNotificaciones: n.count || 0 }
  });
}
export async function getUsuarios(req, res) { const { data } = await db.from('cuenta_usuario').select('*').order('fecha_registro', { ascending: false }); renderAdmin(req, res, 'usuarios', { usuarios: data || [], query: req.query }); }
export async function createUsuario(req, res) { const hash = await bcrypt.hash(req.body.password || '123456', 10); const { data } = await db.from('cuenta_usuario').insert({ username: req.body.username, email: req.body.email, clave: '', rol: req.body.rol || 'lector', estado: 'activa' }).select('id_cuenta_usuario').single(); if (data) await db.from('cuenta_credenciales').insert({ cuenta_usuario_id: data.id_cuenta_usuario, clave_hash: hash }); res.redirect('/admin/usuarios'); }
export async function editUsuario(req, res) { 
  console.log('📝 editUsuario called with:');
  console.log('  id:', req.params.id);
  console.log('  body:', req.body);
  
  const { data, error } = await db.from('cuenta_usuario')
    .update({ 
      username: req.body.username, 
      email: req.body.email, 
      rol: req.body.rol, 
      estado: req.body.estado, 
      updated_at: new Date().toISOString() 
    })
    .eq('id_cuenta_usuario', req.params.id)
    .select();
  
  if (error) {
    console.error('❌ Error updating user:', error);
    return res.status(500).render('404', { 
      message: `Error actualizando usuario: ${error.message}`,
      loggerUser: req.session?.user || null
    });
  }
  
  console.log('✓ User updated successfully:', data);
  res.redirect('/admin/usuarios'); 
}
export async function deleteUsuario(req, res) { await db.from('cuenta_usuario').delete().eq('id_cuenta_usuario', req.params.id); res.redirect('/admin/usuarios'); }
export async function getHistorias(req, res) { const { data } = await db.from('cuentos').select('*, cuenta_usuario(username), categorias(nombre)').order('created_at', { ascending: false }); renderAdmin(req, res, 'historias', { historias: data || [] }); }
export async function createHistoria(req, res) { await db.from('cuentos').insert({ titulo: req.body.titulo || 'Sin titulo', descripcion: req.body.descripcion || null, cuenta_usuario_id: req.body.cuenta_usuario_id, categoria_id: Number(req.body.categoria_id) || 1, estado: req.body.estado || 'borrador', visibilidad: req.body.visibilidad || 'privada' }); res.redirect('/admin/historias'); }
export async function editHistoria(req, res) { await db.from('cuentos').update({ titulo: req.body.titulo, descripcion: req.body.descripcion, estado: req.body.estado, visibilidad: req.body.visibilidad, updated_at: new Date().toISOString() }).eq('id_cuento', req.params.id); res.redirect('/admin/historias'); }
export async function deleteHistoria(req, res) { await db.from('cuentos').update({ deleted_at: new Date().toISOString() }).eq('id_cuento', req.params.id); res.redirect('/admin/historias'); }
export async function getCapitulos(req, res) { const { data } = await db.from('capitulos').select('*, cuentos(titulo)').order('created_at', { ascending: false }); renderAdmin(req, res, 'capitulos', { capitulos: data || [] }); }
export async function createCapitulo(req, res) { await db.from('capitulos').insert({ titulo: req.body.titulo, contenido: req.body.contenido || '', cuento_id: Number(req.body.cuento_id) }); res.redirect('/admin/capitulos'); }
export async function editCapitulo(req, res) { await db.from('capitulos').update({ titulo: req.body.titulo, contenido: req.body.contenido || '', updated_at: new Date().toISOString() }).eq('id_capitulo', req.params.id); res.redirect('/admin/capitulos'); }
export async function deleteCapitulo(req, res) { await db.from('capitulos').delete().eq('id_capitulo', req.params.id); res.redirect('/admin/capitulos'); }
export async function getComentarios(req, res) { const { data } = await db.from('comentarios').select('*, cuenta_usuario(username), cuentos(titulo)').order('created_at', { ascending: false }); renderAdmin(req, res, 'comentarios', { comentarios: data || [] }); }
export async function deleteComentario(req, res) { await db.from('comentarios').delete().eq('id', req.params.id); res.redirect('/admin/comentarios'); }
export const getCatalogo = name => async (req, res) => {
  // La bandeja es privada: administración solo puede emitir comunicaciones.
  if (name === 'notificaciones') return renderAdmin(req, res, name, { notificaciones: [] });
  const query = db.from(name).select(name === 'notificaciones' ? '*, cuenta_usuario(username)' : '*').order(tablePk[name]); const { data } = await query; const rows = name === 'notificaciones' ? (data || []).map(n => ({ ...n, mensaje: n.contenido, leida: n.vista, username: n.cuenta_usuario?.username || n.cuenta_usuario_id })) : data || []; renderAdmin(req, res, name, { [name]: rows });
};
export const createCatalogo = name => async (req, res) => {
  let row = {};
  if (name === 'notificaciones') {
    if (req.body.enviar_a_todos === 'on') {
      const { data: users } = await db.from('cuenta_usuario').select('id_cuenta_usuario').eq('estado', 'activa');
      const contenido = req.body.contenido || req.body.mensaje || '';
      if (contenido && users?.length) await db.from('notificaciones').insert(users.map(user => ({ tipo: req.body.tipo || 'novedad', contenido, cuenta_usuario_id: user.id_cuenta_usuario, vista: false })));
      return res.redirect('/admin/notificaciones');
    }
    let user_id = req.body.cuenta_usuario_id;
    if (req.body.username_destinatario) {
      const { data: user } = await db.from('cuenta_usuario').select('id_cuenta_usuario').eq('username', req.body.username_destinatario).single();
      if (user) user_id = user.id_cuenta_usuario;
      else return res.status(404).send('Usuario no encontrado');
    }
    if (!user_id) return res.status(400).send('Indica un usuario destinatario o marca "Enviar a todos".');
    row = { tipo: req.body.tipo || 'actualizacion', contenido: req.body.contenido || req.body.mensaje || '', cuenta_usuario_id: user_id, vista: false };
  } else if (name === 'idiomas') {
    row = { codigo: req.body.codigo, nombre: req.body.nombre };
  } else {
    row = { nombre: req.body.nombre };
  }
  await db.from(name).insert(row); res.redirect('/admin/' + name);
};
export const editCatalogo = name => async (req, res) => {
  const row = name === 'idiomas' ? { codigo: req.body.codigo, nombre: req.body.nombre } : { nombre: req.body.nombre }; await db.from(name).update(row).eq(tablePk[name], req.params.id); res.redirect('/admin/' + name);
};
export const deleteCatalogo = name => async (req, res) => { await db.from(name).delete().eq(tablePk[name], req.params.id); res.redirect('/admin/' + name); };
