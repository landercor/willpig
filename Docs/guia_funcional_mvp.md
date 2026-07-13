# Guía funcional de Willpig Studio

## Propósito

Willpig Studio es una plataforma de lectura y publicación de historias. Permite descubrir libros públicos, leerlos por capítulos, crear historias propias y relacionarse con otros autores mediante seguidores, favoritos, listas de lectura, comentarios y notificaciones.

## Recorrido de una persona visitante

1. La raíz (`/`) muestra la página de bienvenida. Desde allí se puede entrar al catálogo o a la autenticación.
2. La página principal (`/principal`) reúne historias publicadas, tendencias, un carrusel y grupos por categoría.
3. La barra superior busca títulos y autores. Al escribir dos o más caracteres muestra sugerencias; al enviar el formulario lleva a `/buscar?q=...` con el resultado completo.
4. Biblioteca (`/biblioteca`, también disponible como `/principal/biblioteca`) lista todo el contenido público. Las categorías llevan a `/categoria/:nombre`.
5. La ficha de una historia (`/historias/:id`) muestra sus capítulos. Un capítulo se lee en `/capitulos/read/:id`.

Solamente se muestran a visitantes las historias con `estado = publicado`, `visibilidad = publica` y sin `deleted_at`. El propietario sí puede consultar sus borradores y elementos privados desde sus áreas de gestión.

## Cuentas, sesiones y seguridad

- Registro y acceso: las pantallas `/auth/register` y `/auth/login` crean/verifican una cuenta local (`cuenta_usuario`) y su hash bcrypt (`cuenta_credenciales`). La sesión HTTP guarda un resumen mínimo del usuario.
- Google: `/auth/google` usa Passport y crea o reutiliza la misma cuenta local.
- Recuperación de contraseña: Supabase envía el enlace. La pantalla de nueva clave toma los tokens temporales del enlace, el servidor los verifica contra Supabase y solo entonces actualiza la contraseña de Supabase y el hash bcrypt local. No se permite restablecer una clave indicando únicamente un correo.
- Las contraseñas son sensibles a mayúsculas y minúsculas: bcrypt compara cada carácter exactamente. La nueva contraseña exige al menos 8 caracteres, una mayúscula, una minúscula y un número.
- Los correos se recortan y convierten a minúsculas en registro, acceso y recuperación, para evitar cuentas o fallos por diferencias de capitalización.
- Búsqueda: se usa `ilike` de PostgreSQL/Supabase, por lo cual títulos y usuarios se buscan sin distinguir mayúsculas/minúsculas. La navegación por categoría además ignora tildes (`Fantasía` y `fantasia` equivalen).
- Las peticiones que modifican datos incluyen token CSRF: autenticación, administración, historias, capítulos, perfil, notificaciones y acciones sociales. Las rutas privadas también exigen sesión; el panel requiere rol `admin`.
- Las imágenes se validan por tipo MIME, se limitan a 5 MB y se almacenan en los buckets de Supabase.

## Crear y publicar

Una persona autenticada entra a **Escribir** → **Crea tu historia** (`/historias/crear`). El sistema registra metadatos, portada y estado. Desde `/historias/editar-meta/:id` modifica esos datos, y desde `/historias/editar/:id` administra capítulos. Cada operación confirma que la historia o capítulo pertenece al usuario de sesión.

Un capítulo se crea o actualiza en el editor Quill. El contenido se guarda como HTML; al leerlo se representa como contenido enriquecido. Solo el dueño puede editar o borrar capítulos. Las visualizaciones aumentan cuando otra persona abre un capítulo público.

Para que una historia llegue al catálogo debe quedar con estado **publicado** y visibilidad **pública**. Borradores o historias privadas no se exponen en búsquedas, biblioteca ni fichas a otros usuarios.

## Interacción social y perfiles

- El perfil público (`/usuario/profile/:id`) expone obras públicas, lista de lectura y contadores. El dueño ve además sus obras no publicadas.
- Seguir/dejar de seguir, dar/quitar favorito, añadir/quitar de lista y comentar usan `/social/*`. Las acciones requieren inicio de sesión y CSRF.
- Al seguir a alguien se crea una notificación. La barra superior consulta `/usuario/notificaciones` y puede marcar todas como leídas.

## Administración

`/admin` concentra indicadores y catálogos. Solo el rol administrador puede administrar usuarios, historias, capítulos, categorías, etiquetas, idiomas, audiencias, derechos, clasificaciones, estados, roles y notificaciones. Las eliminaciones de historias son lógicas (`deleted_at`) para que dejen de aparecer sin perder el registro.

## Estructura técnica

- `src/app.js`: inicializa Express, sesión, variables globales de vistas, CSRF y el montaje de rutas.
- `src/routes`: define URL, protección y controlador por módulo.
- `src/controllers`: reglas de negocio y consultas Supabase.
- `src/config`: clientes Supabase y estrategia Google OAuth.
- `src/views`: plantillas EJS. `layouts/header.ejs`, `layouts/footer.ejs` y `partials/navbar.ejs` centralizan el marco visual.
- `public`: CSS, JavaScript e imágenes estáticas.

## Limpieza realizada

Se eliminó el paquete `supabase` porque el proyecto utiliza `@supabase/supabase-js`; ambos ofrecían el mismo cliente, pero solo el segundo está importado por la aplicación. También se retiraron `connect-pg-simple` y `@testsprite/testsprite-mcp`, que no tenían importaciones ni configuración activa.

Se retiraron scripts redundantes o inválidos: `migrate_data.js` duplicaba exactamente `scripts/migrate_data.js`; `src/scripts/createBucket.js` duplicaba `scripts/create-bucket.js`; y `src/scripts/check_data.js` contenía una ruta absoluta de otro equipo. Se conserva el conjunto `scripts/` como ubicación única para tareas manuales de base de datos y almacenamiento.
