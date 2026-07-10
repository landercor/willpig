import express from 'express';
import passport from 'passport';
import { register, login, forgotPassword, resetPassword, authCallback, logout } from '../controllers/auth.controller.js';
import { validateCsrfToken } from '../middlewares/csrf.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Rutas de Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/auth/login', session: false }),
  (req, res) => {
    // Establecer la sesión manualmente con nuestro formato
    if (req.user) {
      req.session.userId = req.user.id_cuenta_usuario;
      req.session.user = req.user;
    }
    res.redirect('/principal');
  }
);

router.get('/register', (req, res) => res.render('register', { error: undefined, next: req.query.next || '' }));
router.post('/register', authLimiter, validateCsrfToken, register);
router.get('/login', (req, res) => res.render('login', { error: undefined, next: req.query.next || '' }));
router.post('/login', authLimiter, validateCsrfToken, login);
router.get('/logout', logout);
router.get('/olvido', (req, res) => res.render('olvido', { error: undefined }));
router.post('/olvido', validateCsrfToken, forgotPassword);
router.get('/callback', authCallback);
router.get('/nuevaclave', (req, res) => res.render('nuevaclave', { error: undefined }));
router.post('/nuevaclave', validateCsrfToken, resetPassword);

export default router;
