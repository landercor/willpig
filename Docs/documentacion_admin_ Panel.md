# Documentación del Módulo de Administrador

Este documento explica paso a paso la arquitectura y cómo se implementó todo el panel de administración (CRUD, middleware, rutas y vistas) en la aplicación WillPig Studio.

---

## 1. Middleware de Seguridad (`src/middlewares/isAdmin.js`)
Para evitar que cualquier persona sin autorización entre al panel de control, creamos un **Middleware**. Un middleware es una función que se ejecuta *antes* de llegar al controlador principal de la ruta.

```javascript
export const isAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.rol === 'admin') {
    return next(); // Si es admin, permite el paso
  }
  // Si no está logueado o no es admin, lo redirige fuera
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login');
  }
  return res.redirect('/');
};
```
**Cómo funciona:** 
Verifica si existe una sesión activa (`req.session.user`) y si la propiedad `rol` tiene el valor exacto de `"admin"`. Si es correcto, llama a `next()` permitiendo que la solicitud continúe. Si no, fuerza una redirección.

---

## 2. Definición de Rutas (`src/routes/admin.routes.js`)
El enrutador (`Router` de Express) agrupa todas las URLs que empiezan por `/admin`.

```javascript
import { Router } from 'express';
import { isAdmin } from '../middlewares/isAdmin.js';
import * as adminCtrl from '../controllers/admin.controller.js';

const router = Router();

// Aplicar el middleware a TODAS las rutas que estén debajo
router.use(isAdmin);

router.get('/', adminCtrl.getDashboard);
router.get('/usuarios', adminCtrl.getUsuarios);
router.post('/usuarios/:id/edit', adminCtrl.editUsuario);
// ... más rutas
```
**Punto clave:** Al usar `router.use(isAdmin);` al principio del archivo, garantizamos automáticamente que todas las rutas CRUD definidas abajo estén blindadas sin necesidad de escribir la validación una por una.

---

## 3. El Controlador (`src/controllers/admin.controller.js`)
Aquí reside la **lógica de negocio**. Este archivo se comunica con la base de datos (Supabase) y le pasa la información a las vistas EJS. 

Se utilizó `supabaseAdmin` para saltarse las restricciones estándar y poder ver todos los usuarios e historias (incluso borradores o privadas, ya que el admin tiene permiso absoluto).

Ejemplo de cómo listar historias:
```javascript
export const getHistorias = async (req, res) => {
  // Consulta a Supabase
  const { data: historias, error } = await supabase
    .from('cuentos')
    .select('id_cuento, titulo, estado, visibilidad, vistas, created_at, cuenta_usuario(username)')
    .order('created_at', { ascending: false });

  // Renderizar la vista EJS pasando la variable 'seccion' y el array de historias
  res.render('admin', {
    loggerUser: req.session.user,
    seccion: 'historias',
    historias: historias || [],
    /* ... */
  });
};
```
Cada operación de creación, edición o eliminación es una función `POST` que ejecuta un comando en Supabase (`.update()`, `.delete()`, `.insert()`) y luego hace una **redirección** (`res.redirect`) de vuelta a la lista con un mensaje de éxito o error.

---

## 4. La Vista Dinámica (`src/views/admin.ejs`)
En lugar de crear 4 archivos HTML diferentes, opté por una arquitectura de **Single-Template (Plantilla Única)**. 

Usamos la variable `seccion` (que mandamos desde el controlador) para pintar diferentes bloques de código HTML usando los condicionales de EJS (`<% if (...) %>`):

```ejs
<% if (seccion === 'dashboard') { %>
  <!-- Mostrar tarjetas de estadísticas -->
<% } else if (seccion === 'usuarios') { %>
  <!-- Mostrar tabla de usuarios -->
<% } else if (seccion === 'historias') { %>
  <!-- Mostrar tabla de historias -->
<% } %>
```
Dentro de las tablas, para que el administrador pueda cambiar el estado de un usuario (ej. de 'lector' a 'admin'), usamos pequeños **formularios inline**. Cada vez que cambias un `select`, el atributo `onchange="this.form.submit()"` detecta el cambio de inmediato y envía el método POST al controlador.

---

## 5. Integración Global (`src/app.js`)
Para que la aplicación entienda que la ruta `/admin` existe, tuvimos que registrarla en el punto de entrada principal del servidor.

```javascript
import adminRoutes from "./routes/admin.routes.js";

// Montaje de las rutas en Express
app.use("/admin", adminRoutes); 
```

**Flujo completo al solicitar `http://tu-web.com/admin/usuarios`:**
1. **`app.js`** intercepta la petición `/admin...` y la manda a `adminRoutes`.
2. **`adminRoutes`** pasa por el filtro del middleware `isAdmin`.
3. El middleware aprueba el pase.
4. **`adminRoutes`** manda la petición a la función `getUsuarios` del controlador.
5. El **Controlador** hace un `select` a Supabase para buscar los usuarios.
6. El Controlador pasa los usuarios a **`admin.ejs`**.
7. **`admin.ejs`** arma el HTML (dibujando la tabla con el bucle `.forEach`).
8. El usuario (administrador) recibe la página en su navegador web.
