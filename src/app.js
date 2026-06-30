import express from 'express';
import path from 'path';
import session from 'express-session';
import authRoutes from './routes/auth.routes.js';
import homeRoutes from './routes/home.routes.js';
import chapterRoutes from './routes/chapter.routes.js';
import storyRoutes from './routes/story.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import socialRoutes from './routes/social.routes.js';
import { supabaseAdmin } from './config/db.js';
import { generateCsrfToken } from './middlewares/csrf.js';

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src/views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

app.use(session({
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
      rol: (data.roles_usuario?.nombre || data.rol || 'lector').toLowerCase(),
      estado: data.estados_usuario?.nombre || data.estado || 'activa',
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

export default app;
