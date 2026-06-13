import { Router } from 'express';
import { isAuth } from '../middlewares/isAuth.js';
import {
  seguirUsuario,
  dejarDeSeguir,
  estadoSeguimiento,
  darLike,
  quitarLike,
  agregarALista,
  quitarDeLista,
  getComentarios,
  postComentario,
  deleteComentario
} from '../controllers/social.controller.js';

const router = Router();

// Seguir usuarios (requieren auth)
router.post('/seguir/:id', isAuth, seguirUsuario);
router.post('/dejar/:id', isAuth, dejarDeSeguir);
router.get('/estado/:id', isAuth, estadoSeguimiento);

// Likes en historias (requieren auth)
router.post('/like/:id', isAuth, darLike);
router.post('/unlike/:id', isAuth, quitarLike);

// Lista de lectura (requieren auth)
router.post('/lista/agregar/:id', isAuth, agregarALista);
router.post('/lista/quitar/:id', isAuth, quitarDeLista);

// Comentarios
router.get('/comentarios/:cuentoId', getComentarios);               // público — leer
router.post('/comentarios/:cuentoId', isAuth, postComentario);      // auth    — escribir
router.delete('/comentarios/borrar/:comentarioId', isAuth, deleteComentario); // auth — borrar propio

export default router;

