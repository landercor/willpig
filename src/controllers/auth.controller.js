import bcrypt from 'bcrypt';
import { supabase, supabaseAdmin } from '../config/db.js';

const safeNext = (value) => value && value.startsWith('/') && !value.startsWith('//') ? value : '/principal';

async function roleId(nombre) {
  const { data } = await supabaseAdmin.from('roles_usuario').select('id').eq('nombre', nombre).maybeSingle();
  return data?.id || null;
}
async function stateId(nombre) {
  const { data } = await supabaseAdmin.from('estados_usuario').select('id').eq('nombre', nombre).maybeSingle();
  return data?.id || null;
}
function sessionUser(user) {
  return {
    id: user.id_cuenta_usuario,
    id_cuenta_usuario: user.id_cuenta_usuario,
    username: user.username,
    email: user.email,
    avatar: user.avatar_url,
    rol: (user.roles_usuario?.nombre || user.rol || 'lector').toLowerCase(),
    estado: user.estados_usuario?.nombre || user.estado || 'activa',
  };
}
async function findUserByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('cuenta_usuario')
    .select('id_cuenta_usuario, username, email, avatar_url, rol, estado, roles_usuario(nombre), estados_usuario(nombre)')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function register(req, res) {
  const { username, correo, email, contrasena, password, next } = req.body;
  const userEmail = correo || email;
  const userPassword = contrasena || password;
  try {
    if (!username || !userEmail || !userPassword) {
      return res.render('register', { error: 'Todos los campos son obligatorios.', next: next || '' });
    }
    const exists = await findUserByEmail(userEmail);
    if (exists) return res.render('register', { error: 'Este correo ya esta registrado.', next: next || '' });

    const [{ error: authError }, rol_id, estado_id, clave_hash] = await Promise.all([
      supabase.auth.signUp({ email: userEmail, password: userPassword, options: { data: { username } } }),
      roleId('lector'),
      stateId('activa'),
      bcrypt.hash(userPassword, 10),
    ]);
    if (authError && authError.code !== 'user_already_exists') throw authError;

    const { data: user, error } = await supabaseAdmin
      .from('cuenta_usuario')
      .insert({ username, email: userEmail, clave: '', rol: 'lector', estado: 'activa', rol_id, estado_id })
      .select('id_cuenta_usuario')
      .single();
    if (error) throw error;

    await supabaseAdmin.from('cuenta_credenciales').insert({ cuenta_usuario_id: user.id_cuenta_usuario, clave_hash });
    res.redirect('/auth/login?next=' + encodeURIComponent(safeNext(next)));
  } catch (error) {
    res.render('register', { error: 'Error al registrar: ' + error.message, next: next || '' });
  }
}

export async function login(req, res) {
  const { correo, email, contrasena, password, next } = req.body;
  const userEmail = correo || email;
  const userPassword = contrasena || password;
  const redirectTo = safeNext(next);
  try {
    if (!userEmail || !userPassword) return res.render('login', { error: 'Completa los campos.', next: redirectTo });
    const user = await findUserByEmail(userEmail);
    if (!user || user.estado === 'suspendida' || user.estado === 'deshabilitada') {
      return res.render('login', { error: 'Usuario o contrasena incorrectos.', next: redirectTo });
    }
    const { data: cred } = await supabaseAdmin.from('cuenta_credenciales').select('clave_hash').eq('cuenta_usuario_id', user.id_cuenta_usuario).maybeSingle();
    const ok = cred?.clave_hash ? await bcrypt.compare(userPassword, cred.clave_hash) : false;
    if (!ok) return res.render('login', { error: 'Usuario o contrasena incorrectos.', next: redirectTo });
    await supabaseAdmin.from('cuenta_credenciales').update({ ultimo_login: new Date().toISOString(), intentos_fallidos: 0 }).eq('cuenta_usuario_id', user.id_cuenta_usuario);
    req.session.userId = user.id_cuenta_usuario;
    req.session.user = sessionUser(user);
    res.redirect(redirectTo);
  } catch (error) {
    res.render('login', { error: 'Error al iniciar sesion: ' + error.message, next: redirectTo });
  }
}

export async function forgotPassword(req, res) {
  const correo = req.body.correo || req.body.email;
  if (!correo) return res.render('olvido', { error: 'Introduce un correo valido.' });
  const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo: req.protocol + '://' + req.get('host') + '/auth/callback' });
  res.render('olvido', { error: error ? 'No pudimos enviar el correo: ' + error.message : 'Te enviamos un correo de recuperacion.' });
}
export function authCallback(_req, res) { res.redirect('/auth/nuevaclave'); }
export async function resetPassword(req, res) {
  const { nuevaClave, confirmarClave, correo } = req.body;
  if (!nuevaClave || nuevaClave !== confirmarClave) return res.render('nuevaclave', { error: 'Las contrasenas no coinciden.' });
  if (!correo) return res.render('nuevaclave', { error: 'Ingresa el correo de la cuenta.' });
  const user = await findUserByEmail(correo);
  if (!user) return res.render('nuevaclave', { error: 'No encontramos esa cuenta.' });
  const clave_hash = await bcrypt.hash(nuevaClave, 10);
  await supabaseAdmin.from('cuenta_credenciales').upsert({ cuenta_usuario_id: user.id_cuenta_usuario, clave_hash, token_reset: null, token_reset_expiry: null });
  res.redirect('/auth/login');
}
export function logout(req, res) { req.session.destroy(() => res.redirect('/auth/login')); }
