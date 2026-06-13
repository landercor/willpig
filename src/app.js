import express from "express";
import path from "path";
import authRoutes from "./routes/auth.routes.js";
import homeRoutes from "./routes/home.routes.js"; // Importar rutas de home
import chapterRoutes from "./routes/chapter.routes.js"; // Importar rutas de capítulos
import sesion from "express-session"; // Importar express-session
import { supabaseAdmin } from "./config/db.js";
import { generateCsrfToken } from "./middlewares/csrf.js";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(process.cwd(), "public")));

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src/views"));

// Configuración de la sesión (MemoryStore por defecto)
app.use(
  sesion({
    secret: process.env.SESSION_SECRET || "willpig_studio_secret_key", // Usa env var si esta disponible.
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware CSRF — genera token de sesión y lo expone en res.locals.csrfToken
// Debe ir DESPUÉS de la sesión y ANTES de las rutas
app.use(generateCsrfToken);

import passport from "./config/passport.js";
app.use(passport.initialize());

import storyRoutes from "./routes/story.routes.js"; // Importar rutas de historias
import userRoutes from "./routes/user.routes.js"; // Importar rutas de usuario
import adminRoutes from "./routes/admin.routes.js"; // Importar rutas de administrador
import socialRoutes from "./routes/social.routes.js"; // Importar rutas sociales

app.get("/", (req, res) => {
  if (req.session && req.session.user) {
    res.render("landing", { loggerUser: req.session.user });
  } else {
    res.render("landing", { loggerUser: null });
  }
});

// Middleware global para cargar categorías en todas las vistas
app.use(async (req, res, next) => {
  try {
    const { data: categorias, error } = await supabaseAdmin
      .from('categorias')
      .select('id_categoria, nombre')
      .order('nombre', { ascending: true });

    if (error) throw error;

    // Solo permitir las 4 categorías solicitadas: ciencia ficcion, utopia, aventura, fantasia
    const targetNames = ['ciencia ficcion', 'utopia', 'aventura', 'fantasia'];
    const normalizeStr = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const filtered = (categorias || []).filter(cat => {
      const norm = normalizeStr(cat.nombre);
      return targetNames.includes(norm);
    });

    // Normalizar nombres para evitar duplicaciones en la lista del EJS
    const seen = new Set();
    const uniqueCategorias = [];
    for (const cat of filtered) {
      const norm = normalizeStr(cat.nombre);
      if (!seen.has(norm)) {
        seen.add(norm);
        uniqueCategorias.push(cat);
      }
    }

    res.locals.categorias = uniqueCategorias;
  } catch (err) {
    console.error('Error al cargar categorías en middleware:', err);
    res.locals.categorias = [];
  }
  next();
});

// Middleware global para notificaciones (Badge)
app.use(async (req, res, next) => {
  res.locals.notifCount = 0;
  if (req.session && req.session.user) {
    try {
      const userId = req.session.user.id_cuenta_usuario || req.session.user.id;
      const { count, error } = await supabaseAdmin
        .from('notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_destino_id', userId)
        .eq('leida', false);

      if (!error) {
        res.locals.notifCount = count || 0;
      }
    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
    }
  }
  next();
});

app.use("/auth", authRoutes);
app.use("/principal", homeRoutes);
app.use("/capitulos", chapterRoutes);
app.use("/historias", storyRoutes);
app.use("/usuario", userRoutes); // Montar rutas de usuario
app.use("/admin", adminRoutes); // Montar rutas de administrador
app.use("/social", socialRoutes); // Montar rutas sociales
app.use("/uploads", express.static("uploads"));
app.use("/", homeRoutes);


export default app;
