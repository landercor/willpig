import { isAuth } from './isAuth.js';

export function isAdmin(req, res, next) {
  return isAuth(req, res, () => {
    if (req.session.user.rol === 'admin') return next();
    return res.status(403).render('404', {
      message: 'No tienes permisos para entrar al panel de administracion.',
      loggerUser: req.session.user,
    });
  });
}
