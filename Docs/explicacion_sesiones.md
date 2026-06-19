# Autenticación con Sesiones Tradicionales vs JWT

En el desarrollo web, hay dos formas principales de mantener a un usuario "conectado" después de que ingresa su usuario y contraseña: **Sesiones Tradicionales (Cookies)** y **Tokens (JWT)**. 

Para aplicaciones donde el servidor renderiza el HTML y las vistas (como en tu caso con plantillas `.ejs`), las sesiones tradicionales son el estándar de la industria y la opción más recomendada.

---

## ¿Qué es una Sesión Tradicional?

Imagina que entras a un club exclusivo. 
1. **Login:** Te identificas en la puerta con tu DNI (usuario y contraseña).
2. **La Sesión (Servidor):** El guardia anota tu nombre en su cuaderno (memoria del servidor o base de datos) y te asigna un número de casillero, por ejemplo: `Casillero #42`.
3. **La Cookie (Cliente):** El guardia te da una llave física con el número `42` estampado (esta es la **Cookie**).
4. **Navegación:** Cada vez que quieres pedir una bebida, le muestras la llave `42` al barman. El barman mira el cuaderno, ve que el `42` te pertenece y te sirve.

### ¿Cómo funciona técnicamente en la web?

1. El usuario envía sus credenciales (email y contraseña) al servidor a través del formulario de login.
2. El servidor (Node.js/Express) verifica en la base de datos si son correctos.
3. Si son correctos, el servidor crea un **ID de sesión único** (un texto largo, aleatorio e indescifrable) y guarda los datos del usuario vinculados a ese ID en la memoria del servidor (o en Redis/MongoDB).
4. El servidor le responde al navegador enviándole ese **ID de sesión** dentro de una **Cookie**.
5. En cada petición posterior (como ir a `/mystories` o `/profile`), el navegador envía esa Cookie automáticamente de forma invisible.
6. El servidor lee la Cookie, busca el ID en su "cuaderno", y sabe quién está navegando para mostrarle sus historias.

> [!TIP]
> **Seguridad:** Las cookies de sesión se configuran con un atributo llamado `httpOnly`. Esto significa que ningún código JavaScript malicioso en el navegador puede leerlas o robarlas. Es una de sus mayores ventajas en seguridad frente a guardar un JWT de forma manual.

---

## Diferencia con JWT (JSON Web Token)

Siguiendo el ejemplo del club:
En vez de anotarte en un cuaderno, el guardia te da un **Carnet plastificado y firmado con un sello irrompible** (El JWT). 
Ese carnet dice: *"Este es Juan, y tiene permiso para estar aquí"*. 

1. El servidor **no guarda nada** en su memoria (es *stateless* o sin estado). No hay cuaderno.
2. El usuario envía este carnet (token) en cada petición.
3. El servidor solo mira el sello para verificar que no sea falso.

> [!WARNING]
> **El problema del JWT para webs tradicionales:** Como el servidor no guarda una lista de quién está conectado, **es muy difícil invalidar un JWT antes de que expire su tiempo de vida**. Si alguien roba tu token, o si cambias tu contraseña y quieres "Cerrar sesión en todos los dispositivos", con JWT puro es complejo. Con Sesiones, el servidor simplemente borra tu ID de su cuaderno y tu sesión expira al instante en cualquier dispositivo.

---

## ¿Cómo se implementaría en tu proyecto de Node.js (Express)?

Si decidimos implementar esto en tu código, los pasos generales que modificaríamos en tu archivo principal de servidor (usualmente `app.js` o `index.js`) serían los siguientes:

### 1. Instalar dependencias
Necesitaríamos el paquete oficial de Express para manejar sesiones.
```bash
npm install express-session
```

### 2. Configurar el Middleware de Sesión
Añadimos este código en tu servidor para que empiece a crear el "cuaderno" de sesiones y a enviar las cookies:

```javascript
const session = require('express-session');

app.use(session({
    secret: 'mi_secreto_super_seguro_de_willpig', // Contraseña para proteger la cookie
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // En producción (cuando tengas HTTPS) esto se cambia a 'true'
        httpOnly: true, // Protege contra robos (XSS)
        maxAge: 1000 * 60 * 60 * 24 // La sesión dura 24 horas
    }
}));
```

### 3. Crear el Login
Cuando el usuario pone su contraseña correctamente, guardamos su información en la sesión:

```javascript
app.post('/auth/login', async (req, res) => {
    const { correo, contrasena } = req.body;
    const usuario = await Usuario.findOne({ correo });

    // Si existe el usuario y la contraseña coincide
    if (usuario && bcrypt.compareSync(contrasena, usuario.contrasena)) {
        
        // ¡Login exitoso! Guardamos los datos en la sesión actual
        req.session.userId = usuario._id;
        req.session.username = usuario.username;
        
        // Redirigimos a su panel
        res.redirect('/mystories');
    } else {
        res.render('login', { error: 'Correo o contraseña incorrectos' });
    }
});
```

### 4. Proteger Rutas Privadas
Para evitar que alguien entre a `/mystories` sin iniciar sesión, crearíamos una función que verifique si la sesión existe:

```javascript
function verificarSesion(req, res, next) {
    if (req.session && req.session.userId) {
        return next(); // Tiene sesión, lo dejamos pasar
    } else {
        res.redirect('/auth/login'); // No tiene sesión, lo mandamos a loguearse
    }
}

// Aplicamos la protección a la ruta
app.get('/mystories', verificarSesion, (req, res) => {
    // Le pasamos el nombre guardado en sesión a la plantilla EJS
    res.render('mystories', { username: req.session.username });
});
```

### 5. Cerrar Sesión
Para el botón de "Cerrar sesión" o salir, simplemente destruimos la sesión en el servidor:

```javascript
app.get('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        res.clearCookie('connect.sid'); // Limpiamos la cookie
        res.redirect('/'); // Volvemos al inicio
    });
});
```

---

> [!NOTE]
> En tu archivo `register.ejs` noté que tienes un botón de **"Continuar con Google"**. Por lo general, cuando se implementa inicio de sesión con Google en Node.js, se usa una librería llamada **Passport.js**. Curiosamente, Passport.js **utiliza sesiones tradicionales por debajo** para funcionar. 
> 
> Es muy probable que si ya tienes configurado Google Login en tu backend, ya tengas instalada y configurada la librería de sesiones. ¡Podemos revisar el archivo principal de tu servidor para comprobarlo!
