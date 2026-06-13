import { Router } from "express";
import { apiRegister, apiLogin, getProfile, getEditProfile, postEditProfile, uploadProfileImages } from "../controllers/user.controller.js";
import { isAuth } from "../middlewares/isAuth.js";

const router = Router();

// Ruta para "Mi Perfil" desde el navbar
router.get("/perfil", (req, res) => {
  if (req.session && req.session.user) {
    const userId = req.session.user.id || req.session.user.id_cuenta_usuario;
    res.redirect(`/usuario/profile/${userId}`);
  } else {
    res.redirect('/auth/login');
  }
});

// Editar perfil (requiere auth)
router.get("/perfil/editar", isAuth, getEditProfile);
router.post("/perfil/editar", isAuth, uploadProfileImages, postEditProfile);

router.post("/register", apiRegister);
router.post("/login", apiLogin);
router.get("/profile/:id", getProfile);

export default router;