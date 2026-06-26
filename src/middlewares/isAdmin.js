// src/middlewares/isAdmin.js
// Protege las rutas del panel de administrador.
// Solo usuarios con rol 'admin' pueden acceder.

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return '';
  return role.trim().toLowerCase();
};

export const isAdmin = (req, res, next) => {
  if (req.session && req.session.user && normalizeRole(req.session.user.rol) === 'admin') {
    return next();
  }
  // Sin sesión → login; con sesión pero sin rol admin → página principal
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login');
  }
  return res.redirect('/');
};
