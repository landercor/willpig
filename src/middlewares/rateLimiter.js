// src/middlewares/rateLimiter.js
// Rate limiting para endpoints de autenticación.
// Limita los intentos de login/registro a 10 por IP cada 15 minutos
// para mitigar ataques de fuerza bruta y credential stuffing.

import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // máximo 10 intentos por IP en la ventana
  standardHeaders: true,     // incluye headers RateLimit-* estándar
  legacyHeaders: false,      // deshabilita los X-RateLimit-* antiguos
  validate: false, // bypass validation error //
  message: {

    error: 'Demasiados intentos de acceso. Por favor, espera 15 minutos antes de intentarlo de nuevo.'
  },
  handler: (req, res) => {
    // Renderizar la vista de error en lugar de responder JSON
    res.status(429).render('login', {
      error: 'Demasiados intentos fallidos. Por favor, espera 15 minutos antes de intentarlo de nuevo.',
    });
  }
});
