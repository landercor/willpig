// src/routes/admin.routes.js
import { Router } from 'express';
import { isAdmin } from '../middlewares/isAdmin.js';
import { validateCsrfToken } from '../middlewares/csrf.js';
import * as adminCtrl from '../controllers/admin.controller.js';

const router = Router();

// Aplicar middleware isAdmin a todas las rutas de este router
router.use(isAdmin);

// Dashboard
router.get('/', adminCtrl.getDashboard);

// Usuarios
router.get('/usuarios', adminCtrl.getUsuarios);
router.post('/usuarios/new', validateCsrfToken, adminCtrl.createUsuario);
router.post('/usuarios/:id/edit', validateCsrfToken, adminCtrl.editUsuario);
router.post('/usuarios/:id/delete', validateCsrfToken, adminCtrl.deleteUsuario);

// Historias
router.get('/historias', adminCtrl.getHistorias);
router.post('/historias/new', validateCsrfToken, adminCtrl.createHistoria);
router.post('/historias/:id/edit', validateCsrfToken, adminCtrl.editHistoria);
router.post('/historias/:id/delete', validateCsrfToken, adminCtrl.deleteHistoria);

// Capítulos
router.get('/capitulos', adminCtrl.getCapitulos);
router.post('/capitulos/new', validateCsrfToken, adminCtrl.createCapitulo);
router.post('/capitulos/:id/edit', validateCsrfToken, adminCtrl.editCapitulo);
router.post('/capitulos/:id/delete', validateCsrfToken, adminCtrl.deleteCapitulo);

// ==========================================
// CATÁLOGOS DINÁMICOS
// ==========================================
const registrarCatalogo = (ruta, controllerInstance) => {
  router.get(`/${ruta}`, controllerInstance.get);
  router.post(`/${ruta}/new`, validateCsrfToken, controllerInstance.create);
  router.post(`/${ruta}/:id/edit`, validateCsrfToken, controllerInstance.edit);
  router.post(`/${ruta}/:id/delete`, validateCsrfToken, controllerInstance.delete);
};

// Catálogos Originales
registrarCatalogo('categorias', adminCtrl.catCategorias);
registrarCatalogo('etiquetas', adminCtrl.catEtiquetas);
registrarCatalogo('miniaturas', adminCtrl.catMiniaturas);
registrarCatalogo('notificaciones', adminCtrl.catNotificaciones);

// Nuevos Catálogos (Full 3NF)
registrarCatalogo('idiomas', adminCtrl.catIdiomas);
registrarCatalogo('audiencias', adminCtrl.catAudiencias);
registrarCatalogo('tipos_derechos', adminCtrl.catTiposDerechos);
registrarCatalogo('clasificaciones', adminCtrl.catClasificaciones);
registrarCatalogo('estados_cuento', adminCtrl.catEstadosCuento);
registrarCatalogo('estados_usuario', adminCtrl.catEstadosUsuario);
registrarCatalogo('roles_usuario', adminCtrl.catRolesUsuario);

export default router;
