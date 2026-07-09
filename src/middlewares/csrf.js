import crypto from 'crypto';

export function generateCsrfToken(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session?.csrfToken || '';
  next();
}

export function validateCsrfToken(req, res, next) {
  const expected = req.session?.csrfToken;
  const received = req.body?._csrf || req.get('CSRF-Token') || req.get('x-csrf-token');
  if (!expected || expected !== received) {
    if (req.accepts(['html', 'json']) === 'json') {
      return res.status(403).json({ error: 'Token CSRF invalido.' });
    }
    return res.status(403).render('404', {
      message: 'La sesion expiro. Vuelve a intentarlo.',
      loggerUser: req.session?.user || null,
    });
  }
  next();
}
