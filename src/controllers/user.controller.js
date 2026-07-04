import bcrypt from 'bcrypt';
import upload from '../middlewares/upload.js';
import { supabaseAdmin as db } from '../config/db.js';
export const uploadProfileImages = upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]);
const userId = req => req.session?.user?.id;
async function uploadImage(file, bucket) { if (!file) return null; const ext = file.originalname.split('.').pop() || 'jpg'; const name = Date.now() + '-' + Math.random().toString(16).slice(2) + '.' + ext; const { error } = await db.storage.from(bucket).upload(name, file.buffer, { contentType: file.mimetype, upsert: true }); if (error) throw error; return db.storage.from(bucket).getPublicUrl(name).data.publicUrl; }
export async function apiRegister(req, res) { const clave_hash = await bcrypt.hash(req.body.password || req.body.contrasena || '123456', 10); const { data, error } = await db.from('cuenta_usuario').insert({ username: req.body.username, email: req.body.email, clave: '', rol: 'lector', estado: 'activa' }).select('id_cuenta_usuario').single(); if (!error) await db.from('cuenta_credenciales').insert({ cuenta_usuario_id: data.id_cuenta_usuario, clave_hash }); res.status(error ? 400 : 201).json(error ? { error: error.message } : data); }
export async function apiLogin(_req, res) { res.status(501).json({ error: 'Usa /auth/login para iniciar sesion.' }); }
export async function getProfile(req, res) {
  const current = userId(req);
  const { data: u } = await db.from('cuenta_usuario').select('*').eq('id_cuenta_usuario', req.params.id).maybeSingle();
  if (!u) return res.status(404).render('404', { message: 'Usuario no encontrado.', loggerUser: req.session?.user || null });
  const isOwner = String(current) === String(u.id_cuenta_usuario);
  const [{ data: works }, { data: list }, followers, following, followState] = await Promise.all([
    (isOwner ? db.from('cuentos').select('*').eq('cuenta_usuario_id', u.id_cuenta_usuario).is('deleted_at', null) : db.from('cuentos').select('*').eq('cuenta_usuario_id', u.id_cuenta_usuario).is('deleted_at', null).eq('estado', 'publicado').eq('visibilidad', 'publica')).order('created_at', { ascending: false }),
    db.from('lista_lectura').select('cuentos(*)').eq('usuario_id', u.id_cuenta_usuario),
    db.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguido_id', u.id_cuenta_usuario),
    db.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguidor_id', u.id_cuenta_usuario),
    current ? db.from('seguidores').select('seguidor_id').eq('seguidor_id', current).eq('seguido_id', u.id_cuenta_usuario).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const profile = { title: u.username };
  const user = { _id: u.id_cuenta_usuario, username: u.username, name: u.username, avatar: u.avatar_url, coverImage: u.portada_url, bio: u.biografia, joined: u.fecha_registro ? new Date(u.fecha_registro).toLocaleDateString('es') : '', isOwner, isFollowing: !!followState.data, followersCount: followers.count || 0, followingCount: following.count || 0, works: works || [], readingList: (list || []).map(x => x.cuentos).filter(Boolean) };
  res.render('profile', { profile, user, loggerUser: req.session?.user || null });
}
export async function getEditProfile(req, res) { const { data } = await db.from('cuenta_usuario').select('*').eq('id_cuenta_usuario', userId(req)).maybeSingle(); res.render('profile-edit', { userData: data || {}, loggerUser: req.session.user }); }
export async function postEditProfile(req, res) { const avatar_url = await uploadImage(req.files?.avatar?.[0], 'avatars'); const portada_url = await uploadImage(req.files?.coverImage?.[0], 'portadas'); const updates = { biografia: req.body.biografia || null, updated_at: new Date().toISOString() }; if (avatar_url) updates.avatar_url = avatar_url; if (portada_url) updates.portada_url = portada_url; await db.from('cuenta_usuario').update(updates).eq('id_cuenta_usuario', userId(req)); res.redirect('/usuario/perfil'); }
export async function getUserNotifications(req, res) { const { data } = await db.from('notificaciones').select('*').eq('cuenta_usuario_id', userId(req)).order('created_at', { ascending: false }); res.json({ notificaciones: data || [] }); }
export async function markUserNotificationsRead(req, res) { await db.from('notificaciones').update({ vista: true }).eq('cuenta_usuario_id', userId(req)); res.json({ ok: true }); }
