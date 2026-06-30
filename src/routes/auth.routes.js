import express from 'express';
import { register, login, forgotPassword, resetPassword, authCallback, logout } from '../controllers/auth.controller.js';
import { validateCsrfToken } from '../middlewares/csrf.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

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
