import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);
