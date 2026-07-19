import { Router } from 'express';
import { isAdmin } from '../middlewares/isAdmin.js';
import { validateCsrfToken } from '../middlewares/csrf.js';
import * as admin from '../controllers/admin.controller.js';
const router = Router();
router.use(isAdmin);
router.get('/', admin.getDashboard);
router.get('/usuarios', admin.getUsuarios);
router.post('/usuarios/new', validateCsrfToken, admin.createUsuario);
router.post('/usuarios/:id/edit', validateCsrfToken, admin.editUsuario);
router.post('/usuarios/:id/delete', validateCsrfToken, admin.deleteUsuario);
router.get('/historias', admin.getHistorias);
router.post('/historias/new', validateCsrfToken, admin.createHistoria);
router.post('/historias/:id/edit', validateCsrfToken, admin.editHistoria);
router.post('/historias/:id/delete', validateCsrfToken, admin.deleteHistoria);
router.get('/capitulos', admin.getCapitulos);
router.post('/capitulos/new', validateCsrfToken, admin.createCapitulo);
router.post('/capitulos/:id/edit', validateCsrfToken, admin.editCapitulo);
router.post('/capitulos/:id/delete', validateCsrfToken, admin.deleteCapitulo);
router.get('/comentarios', admin.getComentarios);
router.post('/comentarios/:id/delete', validateCsrfToken, admin.deleteComentario);
for (const name of admin.catalogNames) {
  router.get('/' + name, admin.getCatalogo(name));
  router.post('/' + name + '/new', validateCsrfToken, admin.createCatalogo(name));
  router.post('/' + name + '/:id/edit', validateCsrfToken, admin.editCatalogo(name));
  router.post('/' + name + '/:id/delete', validateCsrfToken, admin.deleteCatalogo(name));
}
export default router;
