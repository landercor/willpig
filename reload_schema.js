import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: 'db.ezwwrupfgvbogejnrvlc.supabase.co',
  port: 5432,
  user: 'postgres',
  password: ' ,._ALFA_/*36 ',
  database: 'postgres'
});

async function reload() {
  try {
    await client.connect();
    console.log("Connected to DB...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("Schema reloaded successfully via NOTIFY pgrst.");
    
    // Also, verify if the column exists just to be 100% sure the migration ran
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='cuenta_usuario' AND column_name='estado_id';
    `);
    
    if (res.rows.length > 0) {
      console.log("SUCCESS: La columna 'estado_id' sí existe en la base de datos.");
    } else {
      console.log("ERROR: La columna 'estado_id' NO existe. ¡No has ejecutado el script SQL migration_v2_schema.sql completo en Supabase!");
    }
  } catch (e) {
    console.error("Error connecting to DB:", e);
  } finally {
    await client.end();
  }
}

reload();
