# 📚 Backlog: Creación y Publicación de Historias

Este backlog detalla las funcionalidades necesarias para que los autores puedan crear, gestionar y publicar sus historias en Willpig Studio.

## 🏁 Fase 1: Cimiento de la Historia (MVP)
Tareas base para tener una historia en el sistema.

- [x] **Creación de Perfil de Historia**: Formulario básico (Título, Descripción, Categoría, Portada).
- [x] **Subida de Portada**: Integración con Supabase Storage para almacenar imágenes de portada.
- [x] **Lista de "Mis Historias"**: Vista donde el autor ve sus borradores y obras publicadas.
- [x] **Visualización de Historia**: Página de detalles pública para ver la sinopsis y lista de capítulos.

## ✍️ Fase 2: Gestión de Capítulos
Funcionalidades para añadir contenido real a los libros.

- [/] **Creación de Capítulos**: 
    - [x] Endpoint en el servidor para guardar capítulos.
    - [ ] Interfaz de usuario (Editor) para escribir el contenido del capítulo.
- [ ] **Edición de Capítulos**: Capacidad de corregir capítulos existentes.
- [ ] **Ordenamiento**: Poder cambiar el orden de los capítulos (Arrastrar y soltar o flechas).
- [x] **Lectura Continua**: Navegación entre "Capítulo Anterior" y "Capítulo Siguiente".

## 🚀 Fase 3: Publicación y Visibilidad
El flujo para pasar de borrador a obra compartida.

- [ ] **Flujo de Publicación**:
    - [ ] Botón de "Publicar" en la gestión de la historia.
    - [ ] Validación: Impedir publicar historias sin capítulos.
    - [ ] Cambio de estado de `borrador` a `publicado`.
- [ ] **Privacidad y Visibilidad**: Configuración para que la historia sea `pública` o `privada` (solo autor).
- [ ] **Edición de Metadatos**: Poder cambiar el título, descripción o categoría después de creada.

## 📊 Fase 4: Pulido y Analytics
Mejoras de experiencia de usuario y datos.

- [ ] **Contador de Vistas**: Incrementar el contador cada vez que alguien lee un capítulo o ve la historia.
- [ ] **Previsualización para el Autor**: Ver cómo queda la historia antes de publicarla.
- [ ] **Eliminación de Historias**: Opción para borrar una obra (con confirmación de seguridad).
- [ ] **Sistema de Clasificación**: Etiquetas de contenido (Adultos, Todo Público, etc.).

---
> [!NOTE]
> Las tareas marcadas con `[x]` ya están implementadas en el código actual de `story.controller.js` y `chapter.controller.js`. Las marcadas con `[ ]` son las siguientes prioridades.
