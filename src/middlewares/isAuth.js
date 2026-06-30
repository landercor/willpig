export function isAuth(req, res, next) {
  if (req.session?.user?.id) return next();
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(401).json({ error: 'Debes iniciar sesion.' });
  }
  return res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));
}
