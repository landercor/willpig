// server.js
import app from "./src/app.js";
import { supabase } from "./src/config/db.js";

async function start() {
  try {
    // Optional: Check Supabase connection or specific table existence here if needed
    // For now, we assume Supabase is ready.
    console.log("Conectado a Supabase (cliente inicializado)");

    const PORT = process.env.PORT || 2000;
    app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
  } catch (err) {
    console.error("Error arrancando la app:", err);
    process.exit(1);
  }
}

start();
