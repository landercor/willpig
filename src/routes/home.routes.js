import express from 'express';
import { verBiblioteca, verPrincipal, verBusqueda, verSugerencias, verCategoria } from '../controllers/home.controller.js';
const router = express.Router();
router.get('/', verPrincipal);
router.get('/buscar', verBusqueda);
router.get('/buscar/sugerencias', verSugerencias);
router.get('/biblioteca', verBiblioteca);
router.get('/categoria/:nombre', verCategoria);
export default router;
