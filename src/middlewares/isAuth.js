export const isAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }

  const acceptsJson = req.xhr || req.headers.accept?.includes('application/json');
  if (acceptsJson) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }

  const nextUrl = encodeURIComponent(req.originalUrl || req.url || '/');
  return res.redirect(`/auth/login?next=${nextUrl}`);
};
