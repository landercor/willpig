import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,// Define un intervalo de tiempo (15 minutos).
  limit: 30,// Define el número máximo de solicitudes permitidas en ese intervalo.
  standardHeaders: true,// Incluye los headers estándar de Rate Limit.
  legacyHeaders: false,// Deshabilita los headers antiguos de Rate Limit.
});
