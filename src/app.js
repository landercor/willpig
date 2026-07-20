import express from 'express';
import path from 'path';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import authRoutes from './routes/auth.routes.js';
import homeRoutes from './routes/home.routes.js';
import chapterRoutes from './routes/chapter.routes.js';
import storyRoutes from './routes/story.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import socialRoutes from './routes/social.routes.js';
import { supabaseAdmin } from './config/db.js';
import { generateCsrfToken } from './middlewares/csrf.js';
import passport from './config/passport.js';

const PgStore = connectPg(session);

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src/views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

app.use(session({
  store: new PgStore({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'willpig_studio_secret_key',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

app.use(passport.initialize());

app.use(async (req, _res, next) => {
  const userId = req.session?.user?.id;
  if (!userId) return next();
  const { data } = await supabaseAdmin
    .from('cuenta_usuario')
    .select('id_cuenta_usuario, username, email, avatar_url, rol, estado, roles_usuario(nombre), estados_usuario(nombre)')
    .eq('id_cuenta_usuario', userId)
    .maybeSingle();
  if (data) {
    req.session.user = {
      id: data.id_cuenta_usuario,
      id_cuenta_usuario: data.id_cuenta_usuario,
      username: data.username,
      email: data.email,
      avatar: data.avatar_url,
      rol: (data.rol || data.roles_usuario?.nombre || 'lector').toLowerCase(),
      estado: data.estado || data.estados_usuario?.nombre || 'activa',
    };
  }
  next();
});

app.use(generateCsrfToken);

app.use(async (req, res, next) => {
  res.locals.loggerUser = req.session?.user || null;
  res.locals.categorias = [];
  res.locals.notifCount = 0;
  const [{ data: categorias }, notifResult] = await Promise.all([
    supabaseAdmin.from('categorias').select('id_categoria, nombre').order('nombre'),
    req.session?.user?.id
      ? supabaseAdmin.from('notificaciones').select('*', { count: 'exact', head: true }).eq('cuenta_usuario_id', req.session.user.id).eq('vista', false)
      : Promise.resolve({ count: 0 }),
  ]);
  res.locals.categorias = categorias || [];
  res.locals.notifCount = notifResult?.count || 0;
  next();
});

app.get('/', (req, res) => res.render('landing', { loggerUser: req.session?.user || null }));
app.use('/auth', authRoutes);
app.use('/principal', homeRoutes);
app.use('/capitulos', chapterRoutes);
app.use('/historias', storyRoutes);
app.use('/usuario', userRoutes);
app.use('/admin', adminRoutes);
app.use('/social', socialRoutes);
app.use('/', homeRoutes);

app.use((req, res) => {
  res.status(404).render('404', { message: 'Pagina no encontrada.', loggerUser: req.session?.user || null });
});

// ── Global Error Handler ──
app.use((err, req, res, _next) => {
  const statusCode = err.status || err.statusCode || 500;

  // Build a human-readable hint about where the error originated
  const stack = err.stack || '';
  let errorHint = '';

  // Try to extract the source file and line from the stack
  const ejsMatch = stack.match(/\("?([^"()\n]+\.ejs)"?:(\d+):\d+\)/);
  const jsMatch  = stack.match(/at\s+\S+\s+\(([^)]+\.js):(\d+):\d+\)/);

  if (ejsMatch) {
    const fileName = ejsMatch[1].split(/[/\\]/).pop();
    errorHint = `Error en la vista "${fileName}", línea ${ejsMatch[2]}. Tipo: ${err.name || 'Error'}.`;
  } else if (jsMatch) {
    const fileName = jsMatch[1].split(/[/\\]/).pop();
    errorHint = `Error en "${fileName}", línea ${jsMatch[2]}. Tipo: ${err.name || 'Error'}.`;
  } else {
    errorHint = `${err.name || 'Error'}: ${err.message || 'Error desconocido'}`;
  }

  // In development, append the full error message
  if (process.env.NODE_ENV !== 'production') {
    errorHint += `\n\nMensaje completo: ${err.message}`;
  }

  // Map status codes to user-friendly titles
  const titles = {
    400: 'Solicitud incorrecta',
    401: 'No autorizado',
    403: 'Acceso denegado',
    404: 'Página no encontrada',
    500: 'Error interno del servidor',
    502: 'Bad Gateway',
    503: 'Servicio no disponible',
  };

  console.error(`[ERROR ${statusCode}] ${req.method} ${req.originalUrl}`);
  console.error(err.stack || err.message);

  try {
    res.status(statusCode).render('error', {
      statusCode,
      errorTitle: titles[statusCode] || 'Error del servidor',
      message: statusCode === 500
        ? 'Ocurrió un error inesperado. Nuestro equipo ha sido notificado.'
        : err.message || 'Algo salió mal.',
      errorHint,
      loggerUser: req.session?.user || null,
    });
  } catch (renderErr) {
    // Fallback if the error view itself fails to render
    console.error('[CRITICAL] Error view failed to render:', renderErr.message);
    res.status(500).send(`
      <div style="font-family:sans-serif;max-width:600px;margin:4rem auto;padding:2rem;text-align:center;">
        <h1 style="font-size:3rem;color:#ee5a24;">500</h1>
        <h2>Error crítico</h2>
        <p>No se pudo renderizar la página de error.</p>
        <p style="background:#f5f5f5;padding:1rem;border-radius:8px;text-align:left;font-size:0.85rem;border-left:4px solid #ee5a24;">
          <strong>Error original:</strong> ${err.message}<br>
          <strong>Error de renderizado:</strong> ${renderErr.message}
        </p>
        <a href="/" style="display:inline-block;margin-top:1rem;padding:10px 24px;background:#ee5a24;color:#fff;border-radius:8px;text-decoration:none;">Volver al Inicio</a>
      </div>
    `);
  }
});

export default app;
