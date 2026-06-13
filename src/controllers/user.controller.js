// src/controllers/user.controller.js
import { supabaseAdmin as supabase } from "../config/db.js";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configuración de multer para subidas locales
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
export const uploadProfileImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
}).fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]);

// --- API Endpoints (JSON) ---

export const apiRegister = async (req, res) => {
  const { username, email, clave } = req.body;
  try {
    const hashedPass = await bcrypt.hash(clave, 10);
    const { data, error } = await supabase
      .from('cuenta_usuario')
      .insert([{ username, email, clave: hashedPass }])
      .select();

    if (error) throw error;
    const newUser = data[0];
    res.status(201).json({ message: "Usuario registrado", id: newUser.id_cuenta_usuario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
};

export const apiLogin = async (req, res) => {
  const { email, clave } = req.body;
  try {
    const { data: rows, error } = await supabase
      .from('cuenta_usuario')
      .select('*')
      .eq('email', email);

    if (error) throw error;
    if (rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const user = rows[0];
    const valid = await bcrypt.compare(clave, user.clave);
    if (!valid) return res.status(401).json({ error: "Clave incorrecta" });

    req.session.user = {
      id: user.id_cuenta_usuario,
      username: user.username,
      email: user.email,
      rol: user.rol,
      avatar: user.avatar_url
    };

    res.json({ message: "Inicio de sesión exitoso", user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
};

// --- Perfil de Usuario ---

export const getProfile = async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Datos del usuario incluyendo bio y portada
    const { data: userData, error: userError } = await supabase
      .from('cuenta_usuario')
      .select('username, email, biografia, avatar_url, portada_url, rol, created_at')
      .eq('id_cuenta_usuario', id)
      .single();

    if (userError || !userData) {
      return res.status(404).render('404', { message: "Usuario no encontrado", loggerUser: req.session.user || null });
    }

    const isOwner = req.session?.user && (String(req.session.user.id) === String(id));

    // 2. Obras del usuario
    let query = supabase
      .from('cuentos')
      .select('id_cuento, titulo, portada_url, vistas, estado, visibilidad')
      .eq('cuenta_usuario_id', id);

    if (!isOwner) {
      query = query.eq('estado', 'publicado').eq('visibilidad', 'publica');
    }
    const { data: userWorks } = await query.order('created_at', { ascending: false });

    // 3. Contadores de seguidores y siguiendo
    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
      supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguido_id', id),
      supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguidor_id', id)
    ]);

    // 4. Estado de seguimiento
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

    // 5. Lista de lectura del usuario
    let readingList = [];
    try {
      const { data: listaItems } = await supabase
        .from('lista_lectura')
        .select('cuento_id, cuentos(id_cuento, titulo, portada_url, estado, visibilidad)')
        .eq('usuario_id', id)
        .order('created_at', { ascending: false });

      if (listaItems) {
        readingList = listaItems
          .filter(item => item.cuentos)
          .map(item => item.cuentos);
        // Si no es el dueño, solo mostrar las públicas
        if (!isOwner) {
          readingList = readingList.filter(c => c.estado === 'publicado' && c.visibilidad === 'publica');
        }
      }
    } catch (e) {
      // Tabla puede no existir aún
      console.log('Lista de lectura no disponible:', e.message);
    }

    // Fecha de unión formateada
    const joinedDate = userData.created_at
      ? new Date(userData.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })
      : 'Recientemente';

    const userProfile = {
      _id: id,
      name: userData.username,
      username: userData.username,
      avatar: userData.avatar_url,
      coverImage: userData.portada_url || null,
      bio: userData.biografia || null,
      joined: joinedDate,
      works: userWorks || [],
      readingList,
      followersCount: followersCount || 0,
      followingCount: followingCount || 0,
      isFollowing,
      isOwner
    };

    res.render('profile', {
      profile: { title: `Perfil de ${userData.username}` },
      user: userProfile,
      loggerUser: req.session.user || null
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).send("Error al obtener perfil");
  }
};

// GET /usuario/perfil/editar → mostrar formulario con datos actuales
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
      csrfToken: req.session.csrfToken || ''
    });
  } catch (error) {
    console.error('Error al cargar formulario edición:', error);
    res.redirect(`/usuario/perfil`);
  }
};

// POST /usuario/perfil/editar → guardar cambios
export const postEditProfile = async (req, res) => {
  if (!req.session?.user) return res.redirect('/auth/login');
  const userId = req.session.user.id || req.session.user.id_cuenta_usuario;

  try {
    const { biografia } = req.body;
    const updates = { biografia };

    // Imagen de avatar subida
    if (req.files?.avatar?.[0]) {
      updates.avatar_url = `/uploads/profiles/${req.files.avatar[0].filename}`;
      // Actualizar también en sesión
      req.session.user.avatar = updates.avatar_url;
    }

    // Imagen de portada/banner subida
    if (req.files?.coverImage?.[0]) {
      updates.portada_url = `/uploads/profiles/${req.files.coverImage[0].filename}`;
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