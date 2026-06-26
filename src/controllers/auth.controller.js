// src/controllers/auth.controller.js
import { supabase, supabaseAdmin } from "../config/db.js";
import bcrypt from "bcrypt";

const getSafeRedirect = (nextUrl) => {
  if (!nextUrl || typeof nextUrl !== "string") return "/principal";
  if (!nextUrl.startsWith("/") || nextUrl.startsWith("//")) return "/principal";
  return nextUrl;
};

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return 'lector';
  return role.trim().toLowerCase();
};

const findLocalUser = async (email) => {
  const { data: user, error } = await supabaseAdmin
    .from("cuenta_usuario")
    .select(`
      id_cuenta_usuario, username, email, avatar_url,
      roles_usuario ( nombre ),
      estados_usuario ( nombre )
    `)
    .eq("email", email)
    .single();
  return { user, error };
};

const createLocalProfile = async ({ username, email, password }) => {
  const [{ data: rolRow }, { data: estadoRow }] = await Promise.all([
    supabaseAdmin.from('roles_usuario').select('id').eq('nombre', 'lector').single(),
    supabaseAdmin.from('estados_usuario').select('id').eq('nombre', 'activa').single(),
  ]);

  const { data: newUser, error: insertError } = await supabaseAdmin
    .from('cuenta_usuario')
    .insert([{
      username,
      email,
      clave: '',
      rol_id:    rolRow?.id    ?? 1,
      estado_id: estadoRow?.id ?? 1,
    }])
    .select('id_cuenta_usuario')
    .single();

  if (insertError) throw insertError;

  const clave_hash = await bcrypt.hash(password, 10);
  const { error: credError } = await supabaseAdmin
    .from('cuenta_credenciales')
    .insert([{ cuenta_usuario_id: newUser.id_cuenta_usuario, clave_hash }]);

  if (credError) throw credError;

  return newUser;
};

const ensureLocalCredentials = async (userId, password) => {
  const { data: credenciales, error } = await supabaseAdmin
    .from('cuenta_credenciales')
    .select('clave_hash')
    .eq('cuenta_usuario_id', userId)
    .single();

  if (!error && credenciales) return true;

  const clave_hash = await bcrypt.hash(password, 10);
  const { error: insertError } = await supabaseAdmin
    .from('cuenta_credenciales')
    .insert([{ cuenta_usuario_id: userId, clave_hash }]);

  if (insertError) throw insertError;
  return true;
};

// ── Registro ────────────────────────────────────────────────────────────────

export const register = async (req, res) => {
  try {
    const { username, correo, contrasena, next } = req.body;
    console.log("Registering user:", { username, correo, next });

    if (!username || !correo || !contrasena) {
      return res.render("register", { error: "Todos los campos son obligatorios.", next });
    }

    const { data: existingUser } = await supabaseAdmin
      .from('cuenta_usuario')
      .select('id_cuenta_usuario')
      .eq('email', correo)
      .single();

    if (existingUser) {
      return res.render("register", {
        error: "Este correo ya está registrado. Por favor inicia sesión o recupera tu contraseña."
      });
    }

    // 1. Registrar en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: correo,
      password: contrasena,
      options: { data: { username } }
    });

    if (authError) {
      console.error("Supabase Auth Error:", authError);
      const message = authError.code === 'user_already_exists'
        ? "Este correo ya está registrado. Por favor inicia sesión o recupera tu contraseña."
        : "Error en el servicio de autenticación: " + authError.message;
      return res.render("register", { error: message });
    }

    // 2. Resolver IDs de catálogo
    const [{ data: rolRow }, { data: estadoRow }] = await Promise.all([
      supabaseAdmin.from('roles_usuario').select('id').eq('nombre', 'lector').single(),
      supabaseAdmin.from('estados_usuario').select('id').eq('nombre', 'activa').single(),
    ]);

    // 3. Insertar perfil público en cuenta_usuario (SIN clave)
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('cuenta_usuario')
      .insert([{
        username,
        email: correo,
        clave: '',
        rol_id:    rolRow?.id    ?? 1,
        estado_id: estadoRow?.id ?? 1,
      }])
      .select('id_cuenta_usuario')
      .single();

    if (insertError) {
      console.error("Error inserting user in DB:", insertError);
      return res.render("register", { error: "Error al guardar el perfil del usuario." });
    }

    // 4. Insertar hash en tabla separada cuenta_credenciales
    const clave_hash = await bcrypt.hash(contrasena, 10);
    const { error: credError } = await supabaseAdmin
      .from('cuenta_credenciales')
      .insert([{ cuenta_usuario_id: newUser.id_cuenta_usuario, clave_hash }]);

    if (credError) {
      console.error("Error inserting credentials:", credError);
      // La cuenta se creó pero sin credenciales — loggear pero no bloquear
    }

    console.log("User registered successfully:", newUser.id_cuenta_usuario);
    const redirectUrl = next && typeof next === 'string' ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login";
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("Error in register:", err);
    return res.render("register", { error: "Hubo un error en el registro: " + err.message, next: req.body.next || "" });
  }
};

// ── Login ────────────────────────────────────────────────────────────────────

export const login = async (req, res) => {
  const next = getSafeRedirect(req.body.next || req.query.next);

  try {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
      return res.render("login", { error: "Completa los campos.", next });
    }

    let user = null;
    let error = null;
    let authenticatedWithLocal = false;
    let authData = null;
    let authError = null;

    const localUserResult = await findLocalUser(correo);
    user = localUserResult.user;
    error = localUserResult.error;

    if (user && !error) {
      const { data: credenciales, error: credError } = await supabaseAdmin
        .from("cuenta_credenciales")
        .select("clave_hash")
        .eq("cuenta_usuario_id", user.id_cuenta_usuario)
        .single();

      if (!credError && credenciales) {
        authenticatedWithLocal = await bcrypt.compare(contrasena, credenciales.clave_hash);
      }
    }

    if (!authenticatedWithLocal) {
      const supabaseResult = await supabase.auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });
      authData = supabaseResult.data;
      authError = supabaseResult.error;

      if (!authError && authData?.session && authData?.user) {
        if (!user) {
          ({ user, error } = await findLocalUser(correo));
        }

        if (!user || error) {
          const username = authData.user.user_metadata?.username || correo.split("@")[0];
          const newUser = await createLocalProfile({
            username,
            email: correo,
            password: contrasena,
          });

          user = {
            id_cuenta_usuario: newUser.id_cuenta_usuario,
            username,
            email: correo,
            avatar_url: null,
            roles_usuario: { nombre: 'lector' },
            estados_usuario: { nombre: 'activa' },
          };
        }

        await ensureLocalCredentials(user.id_cuenta_usuario, contrasena);
      } else if (!authenticatedWithLocal) {
        console.error("Supabase Auth login error:", authError);
        return res.render("login", { error: "Usuario o contraseña incorrectos.", next });
      }
    }

    if (!user || error) {
      return res.render("login", { error: "Usuario o contraseña incorrectos.", next });
    }

    await supabaseAdmin
      .from("cuenta_credenciales")
      .update({ ultimo_login: new Date().toISOString(), intentos_fallidos: 0 })
      .eq("cuenta_usuario_id", user.id_cuenta_usuario);

    req.session.userId = user.id_cuenta_usuario;
    req.session.user = {
      id:       user.id_cuenta_usuario,
      username: user.username,
      email:    user.email,
      rol:      normalizeRole(user.roles_usuario?.nombre),
      estado:   user.estados_usuario?.nombre ?? 'activa',
      avatar:   user.avatar_url,
    };

    return res.redirect(next);
  } catch (err) {
    console.error("Error in login:", err);
    return res.render("login", { error: "Error al iniciar sesion: " + err.message, next });
  }
};

// ── Recuperación de contraseña ────────────────────────────────────────────────

export const forgotPassword = async (req, res) => {
  try {
    const { correo } = req.body;
    if (!correo) {
      return res.render("nuevaclave", { error: "Introduce un correo válido." });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${req.protocol}://${req.get('host')}/auth/callback`,
    });

    if (error) {
      console.error("Error enviando correo de recuperación:", error.message);
      return res.render("nuevaclave", { error: "No pudimos enviar el correo: " + error.message });
    }

    return res.render("nuevaclave", {
      error: "Te hemos enviado un correo. Por favor, revisa tu bandeja de entrada."
    });
  } catch (err) {
    console.error("Error in forgotPassword:", err);
    return res.render("nuevaclave", { error: "Ocurrió un error inesperado." });
  }
};

export const authCallback = async (req, res) => {
  return res.redirect("/auth/nuevaclave");
};

export const resetPassword = async (req, res) => {
  try {
    const { nuevaClave, confirmarClave } = req.body;

    if (!nuevaClave || !confirmarClave) {
      return res.render("nuevaclave", { error: "Completa ambos campos." });
    }
    if (nuevaClave !== confirmarClave) {
      return res.render("nuevaclave", { error: "Las contraseñas no coinciden." });
    }

    // 1. Actualizar en Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.updateUser({
      password: nuevaClave
    });

    if (authError) {
      return res.render("nuevaclave", { error: "Error al actualizar la contraseña: " + authError.message });
    }

    // 2. Sincronizar hash en cuenta_credenciales (tabla separada)
    const clave_hash = await bcrypt.hash(nuevaClave, 10);
    const { error: dbError } = await supabaseAdmin
      .from('cuenta_credenciales')
      .update({ clave_hash, token_reset: null, token_reset_expiry: null })
      .eq('cuenta_usuario_id', (
        await supabaseAdmin.from('cuenta_usuario').select('id_cuenta_usuario').eq('email', user.email).single()
      ).data?.id_cuenta_usuario);

    if (dbError) {
      console.error("Error sincronizando clave en DB:", dbError.message);
    }

    await supabase.auth.signOut();
    return res.redirect("/auth/login");
  } catch (err) {
    console.error("Error in resetPassword:", err);
    return res.render("nuevaclave", { error: "Ocurrió un error inesperado." });
  }
};

export const logout = async (req, res) => {
  try {
    await supabase.auth.signOut();
    req.session.destroy((err) => {
      if (err) console.error("Error destroying session:", err);
      res.redirect("/auth/login");
    });
  } catch (err) {
    console.error("Error in logout:", err);
    res.redirect("/auth/login");
  }
};
