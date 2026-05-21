import express from "express";
import path from "path";
import authRoutes from "./routes/auth.routes.js";
import homeRoutes from "./routes/home.routes.js"; // Importar rutas de home
import chapterRoutes from "./routes/chapter.routes.js"; // Importar rutas de capítulos
import sesion from "express-session"; // Importar express-session
import { supabaseAdmin } from "./config/db.js";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(process.cwd(), "public")));

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src/views"));

// Configuración de la sesión
app.use(
  sesion({
    secret: process.env.SESSION_SECRET || "willpig_studio_secret_key", // Usa env var si esta disponible.
    resave: false,
    saveUninitialized: true,
  })
);

import passport from "./config/passport.js";
app.use(passport.initialize());

import storyRoutes from "./routes/story.routes.js"; // Importar rutas de historias
import userRoutes from "./routes/user.routes.js"; // Importar rutas de usuario

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
    res.locals.categorias = [
      { id_categoria: 8, nombre: 'Ciencia Ficción' },
      { id_categoria: 9, nombre: 'Utopía' },
      { id_categoria: 3, nombre: 'Aventura' },
      { id_categoria: 1, nombre: 'Fantasía' }
    ];
  }
  next();
});

app.use("/auth", authRoutes);
app.use("/principal", homeRoutes);
app.use("/capitulos", chapterRoutes);
app.use("/historias", storyRoutes);
app.use("/usuario", userRoutes); // Montar rutas de usuario
app.use("/uploads", express.static("uploads"));
app.use("/", homeRoutes);


export default app;
