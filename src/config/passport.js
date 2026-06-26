import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { supabaseAdmin } from "./db.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return 'lector';
  return role.trim().toLowerCase();
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback",
      },
      async function (accessToken, refreshToken, profile, cb) {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          if (!email) return cb(new Error("No email found in Google profile"));

          // 1. Buscar usuario por email — select EXPLÍCITO, sin clave_hash
          const { data: user, error: searchError } = await supabaseAdmin
            .from("cuenta_usuario")
            .select(`
              id_cuenta_usuario, username, email, avatar_url,
              roles_usuario ( nombre ),
              estados_usuario ( nombre )
            `)
            .eq("email", email)
            .single();

          if (user) {
            // Normalizar rol/estado para la sesión
            return cb(null, {
              ...user,
              rol:    normalizeRole(user.roles_usuario?.nombre),
              estado: user.estados_usuario?.nombre ?? 'activa',
            });
          }

          // 2. Si no existe, crear cuenta nueva
          const avatarUrl = profile.photos && profile.photos.length > 0
            ? profile.photos[0].value
            : null;

          // Resolver IDs de catálogo
          const [{ data: rolRow }, { data: estadoRow }] = await Promise.all([
            supabaseAdmin.from('roles_usuario').select('id').eq('nombre', 'lector').single(),
            supabaseAdmin.from('estados_usuario').select('id').eq('nombre', 'activa').single(),
          ]);

          // 3. Insertar perfil público (SIN credenciales)
          const { data: newUser, error: insertError } = await supabaseAdmin
            .from("cuenta_usuario")
            .insert([{
              username:   profile.displayName || email.split("@")[0],
              email,
              avatar_url: avatarUrl,
              rol_id:    rolRow?.id    ?? 1,
              estado_id: estadoRow?.id ?? 1,
            }])
            .select("id_cuenta_usuario, username, email, avatar_url")
            .single();

          if (insertError) {
            console.error("Error creating user from Google Auth:", insertError);
            return cb(insertError);
          }

          // 4. Insertar hash de contraseña aleatoria en cuenta_credenciales
          const randomPassword = Math.random().toString(36).slice(-10);
          const clave_hash = await bcrypt.hash(randomPassword, 10);
          await supabaseAdmin
            .from("cuenta_credenciales")
            .insert([{ cuenta_usuario_id: newUser.id_cuenta_usuario, clave_hash }]);

          return cb(null, {
            ...newUser,
            rol:    'lector',
            estado: 'activa',
          });
        } catch (err) {
          console.error("Unexpected error in Google Strategy:", err);
          return cb(err);
        }
      }
    )
  );
}

export default passport;
