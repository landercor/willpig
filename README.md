<p align="center">
 <img width="581" height="680" alt="GABALI baloo 2 (1)" src="https://github.com/user-attachments/assets/ea87092c-cf3e-4738-a484-0191e77038ab" />

</p>

# Willpig
Es un sitio web bajo el nombre de "WillPig". Su propósito principal es que los usuarios con dificultades para mantener un nivel de atención adecuado, puedan mejorar en este ámbito a través de libros ilustrados digitales, cuales se encuentran en el aplicativo, libros de múltiples categorías, infantiles, adolescentes, y adultos.

Node.js: El entorno de ejecución principal.

Express: El framework web utilizado para gestionar rutas, servidores y middleware.

ES Modules (ESM): El proyecto utiliza la sintaxis moderna de JavaScript (import/export) configurada en el package.json

---
### Base de Datos & Almacenamiento
---
Supabase: Utilizado como "Backend as a Service". Proporciona:
PostgreSQL: Base de datos relacional.
Supabase Storage: Para almacenar las portadas de las historias.
Autenticación y Seguridad
bcrypt: Para el cifrado (hashing) seguro de contraseñas.
express-session: Gestión de sesiones de usuario en el servidor.
Passport.js (Google OAuth2.0): Configurado para permitir el inicio de sesión con cuentas de Google.
Frontend & UI
EJS (Embedded JavaScript): El motor de plantillas para generar el HTML dinámicamente en el servidor.
Vanilla CSS: Estilos personalizados ubicados en public/css/.
Quill JS: La biblioteca utilizada para el editor de texto enriquecido en el editor de capítulos.

---
### Herramientas de Desarrollo y Utilidades
---
Multer: Para la subida de archivos (como las portadas de los libros).
dotenv: Para gestionar variables de entorno (como las claves de Supabase y secretos de sesión).
Nodemon: Herramienta que reinicia el servidor automáticamente cada vez que haces un cambio en el código.

---
### Arquitectura
---

El proyecto sigue un patrón MVC (Modelo-Vista-Controlador):
Controladores: Lógica de negocio en src/controllers/.
Vistas: Plantillas en src/views/.
Rutas: Definición de endpoints en src/routes/.

## Tecnologías
<p align="center">
  <img src="https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/css-%23663399.svg?style=for-the-badge&logo=css&logoColor=white" alt="CSS">
  <img src="https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E" alt="JavaScript">
  <br>
  <img src="https://img.shields.io/badge/node.js-6DA55F.svg?style=for-the-badge&logo=node.js&logoColor=white">
  <img src="https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB">
  <img src="https://img.shields.io/badge/bootstrap-%238511FA.svg?style=for-the-badge&logo=bootstrap&logoColor=white">
  <br>
  <img src="https://img.shields.io/badge/ejs-%23B4CA65.svg?style=for-the-badge&logo=ejs&logoColor=black">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white">
  <img src="https://img.shields.io/badge/Flutter-%2302569B.svg?style=for-the-badge&logo=Flutter&logoColor=white">
</p>

### Falta temas
---
### Variables entorno
---

### Casos de prueba
Pruebas funcionales
Pruebas de integración
Pruebas de seguridad
Resultados documentados

---
### El plan de gestion es un documento que esta en proceso a ejecutar.
---
