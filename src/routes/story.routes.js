// routes/cuentos.js
import { Router } from 'express'
import {
  createStory,
  editStory,
  getStories,
  getStoriesByCategory,
  getStoryById,
  getMyStories,
  getEditStory,
  getEditMetadata
} from '../controllers/story.controller.js'

import upload from '../middlewares/upload.js'
import { validateCsrfToken } from '../middlewares/csrf.js'
import { isAuth } from '../middlewares/isAuth.js'

const router = Router()

router.get('/crear', isAuth, (req, res) => {
  res.render('newstorys', { loggerUser: req.session.user });
});

router.get('/mis', isAuth, getMyStories);
router.get('/editar/:id', isAuth, getEditStory);
router.get('/editar-meta/:id', isAuth, getEditMetadata);

router.post('/new', isAuth, validateCsrfToken, upload.single('portada'), createStory)
router.post('/editar/:id', isAuth, validateCsrfToken, upload.single('portada'), editStory)
router.get('/', getStories)
router.get('/category/:id', getStoriesByCategory)
router.get('/:id', getStoryById)

export default router