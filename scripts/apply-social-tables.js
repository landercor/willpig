import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL no está configurado en .env');
  process.exit(1);
}

const sql = await readFile(new URL('../Docs/social_tables.sql', import.meta.url), 'utf8');
const getClientConfig = () => {
  try {
    new URL(connectionString);
    return { connectionString, ssl: { rejectUnauthorized: false } };
  } catch {
    const match = connectionString.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:/]+):(\d+)\/([^?]+)(?:\?.*)?$/);
    if (!match) {
      throw new Error('DATABASE_URL no tiene un formato PostgreSQL reconocible.');
    }

    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: Number(match[4]),
      database: match[5],
      ssl: { rejectUnauthorized: false }
    };
  }
};

const client = new Client(getClientConfig());

try {
  await client.connect();
  await client.query(sql);
  console.log('Tablas sociales aplicadas correctamente.');
} catch (error) {
  console.error('Error aplicando tablas sociales:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
