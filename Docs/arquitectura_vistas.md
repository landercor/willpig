# Arquitectura de Vistas (EJS Layouts)

Este documento explica cómo funciona la nueva estructura centralizada para las vistas del proyecto Willpig Studio.

> [!NOTE]
> **El problema original:** Anteriormente, más de 19 archivos (`.ejs`) tenían repetido el mismo bloque de código HTML (`<!DOCTYPE html>`, `<head>`, `<meta>`, y `<link>` para estilos globales y favicon). Esto hacía que cualquier cambio global (como actualizar un favicon o agregar un nuevo CSS para todo el sitio) fuera tedioso de realizar en cada archivo.

---

## 1. La Solución: Archivos Base (Layouts)

Creamos dos archivos principales que actúan como "sándwich" para todo el contenido de las páginas:

- `src/views/layouts/header.ejs`
- `src/views/layouts/footer.ejs`

Estos archivos contienen todo el código repetitivo de la aplicación.

### El Archivo Header (`layouts/header.ejs`)
Este archivo se encarga de:
1. **Abrir las etiquetas HTML:** `<html lang="es">` y `<head>`.
2. **Cargar contenido global:** Inyecta automáticamente los estilos principales (`style1.2.css`) y el icono (`logo.ico`) para que no tengas que definirlos nunca más.
3. **Manejar datos dinámicos:** Recibe parámetros (como el `<title>` específico de la página o `extraStyles` exclusivos de esa sección).
4. **Cargar la barra de navegación (Navbar):** Contiene la lógica `<%- include('../partials/navbar') %>` para que la barra aparezca automáticamente en las páginas que la necesitan, sin necesidad de llamarla manualmente.

### El Archivo Footer (`layouts/footer.ejs`)
Este archivo se encarga de:
1. **Cerrar las etiquetas:** Cierra el `<main>`, el `<body>` y el `<html>`.
2. **Cargar el Footer:** Incluye visualmente el componente `partials/footer.ejs`.
3. **Inyectar Scripts:** Permite recibir `extraScripts` para inyectar JavaScript en la parte inferior del documento de manera segura.

---

## 2. ¿Cómo se usan en las vistas?

Ahora, cualquier archivo del proyecto (ej: `busqueda.ejs` o `manage_story.ejs`) se ve súper limpio. Solo tienes que hacer esto:

```ejs
<!-- 1. Llamas al Header pasándole la información de esta página -->
<%- include('layouts/header', { 
  title: 'Título de esta página | Willpig Studio',
  extraStyles: '<link rel="stylesheet" href="/css/mi-estilo-unico.css">',
  pageId: 'opcional_para_navbar'
}) %>

<!-- 2. Tu contenido de la página -->
<section>
    <h1>Mi Contenido Único</h1>
</section>

<!-- 3. Cierras con el Footer -->
<%- include('layouts/footer') %>
```

---

## 3. Beneficios Principales

> [!TIP]
> **Mantenimiento centralizado:** Si mañana decides que todas las páginas deben cargar una librería como *Bootstrap* o *Google Analytics*, solo debes agregar una línea de código en `layouts/header.ejs` y automáticamente se reflejará en todo el proyecto.

* **DRY (Don't Repeat Yourself):** Eliminas cientos de líneas de código redundante.
* **Consistencia:** Todas las páginas garantizan tener las mismas versiones de CSS globales y el mismo Favicon.
* **Navegación inteligente:** El header decide por ti cuándo mostrar la barra de navegación basado en la configuración interna de `layouts/utils.ejs`.
