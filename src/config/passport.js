import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { supabaseAdmin } from './db.js';
import crypto from 'crypto';

// Helper function to get Role ID
async function getRoleId(nombre) {
  const { data } = await supabaseAdmin.from('roles_usuario').select('id').eq('nombre', nombre).maybeSingle();
  return data?.id || 1;
}

// Helper function to get State ID
async function getStateId(nombre) {
  const { data } = await supabaseAdmin.from('estados_usuario').select('id').eq('nombre', nombre).maybeSingle();
  return data?.id || 1;
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'your_google_client_id',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (!email) {
        return done(new Error("No email found in Google profile"), false);
      }

      // Check if user already exists
      const { data: existingUser, error: findError } = await supabaseAdmin
        .from('cuenta_usuario')
        .select('id_cuenta_usuario, username, email, avatar_url, rol, estado, roles_usuario(nombre), estados_usuario(nombre)')
        .eq('email', email)
        .maybeSingle();

      if (findError) {
        console.error("Error finding user in Supabase:", findError);
        return done(findError, false);
      }

      if (existingUser) {
        // Return existing user, formatted for session
        const userForSession = {
          id: existingUser.id_cuenta_usuario,
          id_cuenta_usuario: existingUser.id_cuenta_usuario,
          username: existingUser.username,
          email: existingUser.email,
          avatar: existingUser.avatar_url,
          rol: (existingUser.roles_usuario?.nombre || existingUser.rol || 'lector').toLowerCase(),
          estado: existingUser.estados_usuario?.nombre || existingUser.estado || 'activa',
        };
        return done(null, userForSession);
      } else {
        // Create new user
        // Replace spaces to make a valid username, add some random chars to avoid duplicate username errors
        const baseUsername = (profile.displayName || email.split('@')[0]).replace(/\s+/g, '').toLowerCase();
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        // Truncate username to max 45 chars (if the DB schema has varchar(45))
        const username = `${baseUsername}${randomSuffix}`.substring(0, 45);

        let avatar_url = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
        // Truncate avatar_url just in case the DB has a varchar(255) limit instead of text
        if (avatar_url && avatar_url.length > 255) {
          avatar_url = avatar_url.substring(0, 255);
        }

        const rol_id = await getRoleId('lector');
        const estado_id = await getStateId('activa');

        const { data: newUser, error: insertError } = await supabaseAdmin
          .from('cuenta_usuario')
          .insert({
            username,
            email,
            clave: '', // Password va vacio porque se inicia sesion con google
            avatar_url,
            rol: 'lector',
            estado: 'activa',
            rol_id,
            estado_id
          })
          .select('id_cuenta_usuario, username, email, avatar_url, rol, estado')
          .single();

        if (insertError) {
          console.error("Error inserting new user to Supabase:", insertError);
          return done(insertError, false);
        }

        // Create dummy credentials
        // Use a random hash to prevent manual login attempts with empty password
        const randomHash = crypto.randomBytes(32).toString('hex');
        await supabaseAdmin.from('cuenta_credenciales').insert({
          cuenta_usuario_id: newUser.id_cuenta_usuario,
          clave_hash: randomHash
        });

        const userForSession = {
          id: newUser.id_cuenta_usuario,
          id_cuenta_usuario: newUser.id_cuenta_usuario,
          username: newUser.username,
          email: newUser.email,
          avatar: newUser.avatar_url,
          rol: 'lector',
          estado: 'activa',
        };

        return done(null, userForSession);
      }
    } catch (err) {
      console.error("Error in Google Strategy:", err);
      return done(err, false);
    }
  }
));

// We don't use passport serialize/deserialize because we manage session in express-session manually
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

export default passport;
