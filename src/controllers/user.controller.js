// src/controllers/user.controller.js
import { supabaseAdmin as supabase } from "../config/db.js";
import bcrypt from "bcrypt";
import multer from "multer";

export const uploadProfileImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
}).fields([
  { name: 'avatar',      maxCount: 1 },
  { name: 'coverImage',  maxCount: 1 }
]);

const uploadProfileImageToStorage = async (file, userId, kind) => {
  const fileExt  = file.originalname.split('.').pop();
  const fileName = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const filePath = `profiles/${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('portadas')
    .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from('portadas').getPublicUrl(filePath);
  return publicUrlData.publicUrl;
};

// ── API Register ──────────────────────────────────────────────
export const apiRegister = async (req, res) => {
  const { username, email, clave } = req.body;
  try {
    // Resolver IDs de catálogo
    const [{ data: rolRow }, { data: estadoRow }] = await Promise.all([
      supabase.from('roles_usuario').select('id').eq('nombre', 'lector').single(),
      supabase.from('estados_usuario').select('id').eq('nombre', 'activa').single(),
    ]);

    // Insertar perfil público
    const { data, error } = await supabase
      .from('cuenta_usuario')
      .insert([{
        username, email,
        rol_id:    rolRow?.id    ?? 1,
        estado_id: estadoRow?.id ?? 1,
      }])
      .select('id_cuenta_usuario')
      .single();
    if (error) throw error;

    // Insertar credenciales
    const clave_hash = await bcrypt.hash(clave, 10);
    await supabase
      .from('cuenta_credenciales')
      .insert([{ cuenta_usuario_id: data.id_cuenta_usuario, clave_hash }]);

    res.status(201).json({ message: "Usuario registrado", id: data.id_cuenta_usuario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
};

// ── API Login ─────────────────────────────────────────────────
export const apiLogin = async (req, res) => {
  const { email, clave } = req.body;
  try {
    // Select explícito — SIN clave_hash
    const { data: rows, error } = await supabase
      .from('cuenta_usuario')
      .select(`
        id_cuenta_usuario, username, email, avatar_url,
        roles_usuario ( nombre ),
        estados_usuario ( nombre )
      `)
      .eq('email', email);

    if (error) throw error;
    if (!rows || rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const user = rows[0];

    // Obtener hash desde tabla separada
    const { data: cred } = await supabase
      .from('cuenta_credenciales')
      .select('clave_hash')
      .eq('cuenta_usuario_id', user.id_cuenta_usuario)
      .single();

    if (!cred) return res.status(401).json({ error: "Clave incorrecta" });

    const valid = await bcrypt.compare(clave, cred.clave_hash);
    if (!valid) return res.status(401).json({ error: "Clave incorrecta" });

    req.session.user = {
      id:       user.id_cuenta_usuario,
      username: user.username,
      email:    user.email,
      rol:      user.roles_usuario?.nombre   ?? 'lector',
      avatar:   user.avatar_url,
    };

    res.json({ message: "Inicio de sesión exitoso", user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
};

// ── Perfil de Usuario ─────────────────────────────────────────
export const getProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: userData, error: userError } = await supabase
      .from('cuenta_usuario')
      .select(`
        username, email, biografia, avatar_url, portada_url, fecha_registro,
        roles_usuario ( nombre ),
        estados_usuario ( nombre )
      `)
      .eq('id_cuenta_usuario', id)
      .single();

    if (userError || !userData) {
      return res.status(404).render('404', { message: "Usuario no encontrado", loggerUser: req.session.user || null });
    }

    const isOwner = req.session?.user && (String(req.session.user.id) === String(id));

    // Obras del usuario
    let query = supabase
      .from('cuentos')
      .select(`
        id_cuento, titulo, portada_url,
        cuentos_config ( estado_id, es_publico, estados_cuento ( nombre ) ),
        cuentos_metricas ( vistas )
      `)
      .eq('cuenta_usuario_id', id)
      .is('deleted_at', null);

    if (!isOwner) {
      query = query.eq('cuentos_config.es_publico', true);
    }
    const { data: userWorks } = await query.order('created_at', { ascending: false });

    const normalizedWorks = (userWorks || []).map(c => ({
      ...c,
      estado:    c.cuentos_config?.estados_cuento?.nombre ?? 'borrador',
      es_publico: c.cuentos_config?.es_publico ?? false,
      vistas:    c.cuentos_metricas?.vistas ?? 0,
    }));

    // Contadores de seguidores
    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
      supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguido_id', id),
      supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguidor_id', id),
    ]);

    // Estado de seguimiento
    let isFollowing = false;
    if (req.session?.user && !isOwner) {
      const loggerId = req.session.user.id_cuenta_usuario || req.session.user.id;
      const { data: followState } = await supabase
        .from('seguidores')
        .select('id')
        .match({ seguidor_id: loggerId, seguido_id: id })
        .maybeSingle();
      if (followState) isFollowing = true;
    }

    // Lista de lectura
    let readingList = [];
    try {
      const { data: listaItems } = await supabase
        .from('lista_lectura')
        .select(`
          cuento_id,
          cuentos (
            id_cuento, titulo, portada_url,
            cuentos_config ( es_publico, estados_cuento ( nombre ) )
          )
        `)
        .eq('usuario_id', id)
        .order('created_at', { ascending: false });

      if (listaItems) {
        readingList = listaItems
          .filter(item => item.cuentos)
          .map(item => ({
            ...item.cuentos,
            estado:    item.cuentos.cuentos_config?.estados_cuento?.nombre ?? 'borrador',
            es_publico: item.cuentos.cuentos_config?.es_publico ?? false,
          }));
        if (!isOwner) {
          readingList = readingList.filter(c => c.es_publico && c.estado === 'publicado');
        }
      }
    } catch (e) {
      console.log('Lista de lectura no disponible:', e.message);
    }

    const joinedDate = userData.fecha_registro
      ? new Date(userData.fecha_registro).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })
      : 'Recientemente';

    const userProfile = {
      _id:           id,
      name:          userData.username,
      username:      userData.username,
      avatar:        userData.avatar_url,
      coverImage:    userData.portada_url || null,
      bio:           userData.biografia || null,
      joined:        joinedDate,
      rol:           userData.roles_usuario?.nombre ?? 'lector',
      works:         normalizedWorks,
      readingList,
      followersCount: followersCount || 0,
      followingCount: followingCount || 0,
      isFollowing,
      isOwner,
    };

    res.render('profile', {
      profile:    { title: `Perfil de ${userData.username}` },
      user:       userProfile,
      loggerUser: req.session.user || null,
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).send("Error al obtener perfil");
  }
};

// ── Edición de Perfil ─────────────────────────────────────────
export const getEditProfile = async (req, res) => {
  if (!req.session?.user) return res.redirect('/auth/login');
  const userId = req.session.user.id || req.session.user.id_cuenta_usuario;

  try {
    const { data: userData, error } = await supabase
      .from('cuenta_usuario')
      .select('username, email, biografia, avatar_url, portada_url')
      .eq('id_cuenta_usuario', userId)
      .single();

    if (error || !userData) return res.redirect(`/usuario/profile/${userId}`);

    res.render('profile-edit', {
      userData,
      loggerUser: req.session.user,
      csrfToken:  req.session.csrfToken || '',
    });
  } catch (error) {
    console.error('Error al cargar formulario edición:', error);
    res.redirect(`/usuario/perfil`);
  }
};

export const postEditProfile = async (req, res) => {
  if (!req.session?.user) return res.redirect('/auth/login');
  const userId = req.session.user.id || req.session.user.id_cuenta_usuario;

  try {
    const { biografia } = req.body;
    const updates = { biografia };

    if (req.files?.avatar?.[0]) {
      updates.avatar_url = await uploadProfileImageToStorage(req.files.avatar[0], userId, 'avatar');
      req.session.user.avatar = updates.avatar_url;
    }
    if (req.files?.coverImage?.[0]) {
      updates.portada_url = await uploadProfileImageToStorage(req.files.coverImage[0], userId, 'cover');
    }

    const { error } = await supabase
      .from('cuenta_usuario')
      .update(updates)
      .eq('id_cuenta_usuario', userId);
    if (error) throw error;

    res.redirect(`/usuario/profile/${userId}`);
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.redirect('/usuario/perfil/editar');
  }
};

export const updateProfile = async (req, res) => {
  const { id } = req.params;
  const { username, biografia, avatar_url } = req.body;
  try {
    const { error } = await supabase
      .from('cuenta_usuario')
      .update({ username, biografia, avatar_url })
      .eq('id_cuenta_usuario', id);
    if (error) throw error;
    res.json({ message: "Perfil actualizado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar perfil" });
  }
};

// ── Notificaciones ────────────────────────────────────────────
const getSessionUserId = (req) => (
  req.session?.user?.id ||
  req.session?.user?.id_cuenta_usuario ||
  null
);

const fetchUserNotifications = async (userId) => {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('usuario_destino_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (!error) return data || [];
  return [];
};

export const getUserNotifications = async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  try {
    const notificaciones = await fetchUserNotifications(userId);
    return res.json({ notificaciones });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    return res.status(500).json({ error: 'No se pudieron cargar las notificaciones.' });
  }
};

export const markUserNotificationsRead = async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  try {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('usuario_destino_id', userId)
      .eq('leida', false);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al marcar notificaciones:', error);
    return res.status(500).json({ error: 'No se pudieron actualizar las notificaciones.' });
  }
};
