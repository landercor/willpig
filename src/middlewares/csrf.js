// src/middlewares/csrf.js
// Protección CSRF mediante tokens de sesión.
// Cada sesión tiene un token único; los formularios POST deben incluirlo
// en el campo oculto `_csrf` para que la petición sea aceptada.

import crypto from 'crypto';

/**
 * Genera (si no existe) un token CSRF para la sesión y lo expone
 * en res.locals.csrfToken para que las vistas EJS puedan incluirlo.
 * Debe montarse DESPUÉS del middleware de sesión.
 */
export const generateCsrfToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

/**
 * Valida que el token CSRF enviado en el body (`_csrf`) coincide con
 * el almacenado en la sesión. Rechaza con 403 si no coincide o falta.
 */
export const validateCsrfToken = (req, res, next) => {
  const tokenFromBody = req.body?._csrf || req.get('csrf-token') || req.get('x-csrf-token');
  const tokenFromSession = req.session?.csrfToken;

  if (!tokenFromBody || !tokenFromSession) {
    return res.status(403).render('404', {
      message: 'Token de seguridad inválido. Por favor, recarga la página e inténtalo de nuevo.',
      loggerUser: req.session?.user || null
    });
  }

  // Comparación en tiempo constante para evitar ataques de timing
  const tokenBodyBuf = Buffer.from(tokenFromBody);
  const tokenSessionBuf = Buffer.from(tokenFromSession);

  if (
    tokenBodyBuf.length !== tokenSessionBuf.length ||
    !crypto.timingSafeEqual(tokenBodyBuf, tokenSessionBuf)
  ) {
    return res.status(403).render('404', {
      message: 'Token de seguridad inválido. Por favor, recarga la página e inténtalo de nuevo.',
      loggerUser: req.session?.user || null
    });
  }

  next();
};
