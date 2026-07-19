import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../config/db.js';

const safeNext = (value) => value && value.startsWith('/') && !value.startsWith('//') ? value : '/principal';
const normalizeEmail = value => String(value || '').trim().toLowerCase();

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
  const userEmail = normalizeEmail(correo || email);
  const userPassword = contrasena || password;
  try {
    if (!username || !userEmail || !userPassword) {
      return res.render('register', { error: 'Por favor, completa todos los campos requeridos (nombre de usuario, correo y contraseña) para poder registrarte.', next: next || '' });
    }
    const exists = await findUserByEmail(userEmail);
    if (exists) return res.render('register', { error: 'Este correo electrónico ya se encuentra registrado. Si es tuyo, intenta iniciar sesión o recuperar tu contraseña.', next: next || '' });

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
    console.error('Error en registro:', error.message || error);
    res.render('register', { error: 'Ocurrió un problema de conexión al intentar registrar tu cuenta. Por favor, inténtalo de nuevo más tarde.', next: next || '' });
  }
}

export async function login(req, res) {
  const { correo, email, contrasena, password, next } = req.body;
  const userEmail = normalizeEmail(correo || email);
  const userPassword = contrasena || password;
  const redirectTo = safeNext(next);
  try {
    if (!userEmail || !userPassword) return res.render('login', { error: 'Por favor, ingresa tu correo y contraseña para iniciar sesión.', next: redirectTo });
    const user = await findUserByEmail(userEmail);
    if (!user || user.estado === 'suspendida' || user.estado === 'deshabilitada') {
      return res.render('login', { error: 'El correo o la contraseña no son correctos, o la cuenta está inactiva. Asegúrate de escribirlos bien (distingue mayúsculas y minúsculas).', next: redirectTo });
    }
    const { data: cred } = await supabaseAdmin.from('cuenta_credenciales').select('clave_hash').eq('cuenta_usuario_id', user.id_cuenta_usuario).maybeSingle();
    const ok = cred?.clave_hash ? await bcrypt.compare(userPassword, cred.clave_hash) : false;
    if (!ok) return res.render('login', { error: 'El correo o la contraseña no son correctos. Asegúrate de escribirlos bien (distingue mayúsculas y minúsculas).', next: redirectTo });
    await supabaseAdmin.from('cuenta_credenciales').update({ ultimo_login: new Date().toISOString(), intentos_fallidos: 0 }).eq('cuenta_usuario_id', user.id_cuenta_usuario);
    req.session.userId = user.id_cuenta_usuario;
    req.session.user = sessionUser(user);
    res.redirect(redirectTo);
  } catch (error) {
    res.render('login', { error: 'Ocurrió un problema al iniciar sesión. Inténtalo de nuevo más tarde o revisa tus datos.', next: redirectTo });
  }
}

export async function forgotPassword(req, res) {
  const correo = normalizeEmail(req.body.correo || req.body.email);
  if (!correo) return res.render('olvido', { error: 'Por favor, introduce un correo electrónico válido (ejemplo: usuario@correo.com).' });
  const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo: req.protocol + '://' + req.get('host') + '/auth/callback' });
  if (error) console.error('Error en olvido:', error.message || error);
  res.render('olvido', { error: error ? 'No pudimos enviar el correo por un problema técnico. Inténtalo más tarde.' : 'Te enviamos un correo de recuperacion.' });
}
export function authCallback(_req, res) { res.redirect('/auth/nuevaclave'); }
export async function resetPassword(req, res) {
  const { nuevaClave, confirmarClave, recoveryAccessToken, recoveryRefreshToken } = req.body;
  if (!nuevaClave || nuevaClave !== confirmarClave) return res.render('nuevaclave', { error: 'Las contraseñas no coinciden. Asegúrate de escribirlas exactamente igual en ambos campos.' });
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(nuevaClave)) return res.render('nuevaclave', { error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.' });
  if (!recoveryAccessToken || !recoveryRefreshToken) return res.render('nuevaclave', { error: 'El enlace de recuperación no es válido o expiró. Solicita uno nuevo.' });
  const recoveryClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: sessionError } = await recoveryClient.auth.setSession({ access_token: recoveryAccessToken, refresh_token: recoveryRefreshToken });
  const { data: authData, error: authError } = await recoveryClient.auth.getUser();
  if (sessionError || authError || !authData.user?.email) return res.render('nuevaclave', { error: 'El enlace de recuperación no es válido o expiró. Solicita uno nuevo.' });
  const { error: updateAuthError } = await recoveryClient.auth.updateUser({ password: nuevaClave });
  if (updateAuthError) return res.render('nuevaclave', { error: 'No fue posible actualizar la contraseña. Solicita un enlace nuevo.' });
  const user = await findUserByEmail(normalizeEmail(authData.user.email));
  if (!user) return res.render('nuevaclave', { error: 'No encontramos ninguna cuenta asociada a ese correo electrónico. Verifica que esté bien escrito.' });
  const clave_hash = await bcrypt.hash(nuevaClave, 10);
  await supabaseAdmin.from('cuenta_credenciales').upsert({ cuenta_usuario_id: user.id_cuenta_usuario, clave_hash, token_reset: null, token_reset_expiry: null });
  res.redirect('/auth/login');
}
export function logout(req, res) { req.session.destroy(() => res.redirect('/auth/login')); }
