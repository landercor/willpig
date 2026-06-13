-- ============================================================
-- WILLPIG STUDIO — SETUP COMPLETO DE TABLAS SOCIALES
-- Ejecutar en: Supabase → SQL Editor → New Query
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TABLA: likes_historias
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.likes_historias (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id   uuid NOT NULL REFERENCES public.cuenta_usuario(id_cuenta_usuario) ON DELETE CASCADE,
  cuento_id    uuid NOT NULL REFERENCES public.cuentos(id_cuento) ON DELETE CASCADE,
  created_at   timestamp with time zone DEFAULT now(),
  UNIQUE(usuario_id, cuento_id)
);
ALTER TABLE public.likes_historias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select_public"  ON public.likes_historias FOR SELECT  USING (true);
CREATE POLICY "likes_insert_own"     ON public.likes_historias FOR INSERT  WITH CHECK (true);
CREATE POLICY "likes_delete_own"     ON public.likes_historias FOR DELETE  USING (true);


-- ─────────────────────────────────────────────────────────────
-- 2. TABLA: lista_lectura
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lista_lectura (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id   uuid NOT NULL REFERENCES public.cuenta_usuario(id_cuenta_usuario) ON DELETE CASCADE,
  cuento_id    uuid NOT NULL REFERENCES public.cuentos(id_cuento) ON DELETE CASCADE,
  created_at   timestamp with time zone DEFAULT now(),
  UNIQUE(usuario_id, cuento_id)
);
ALTER TABLE public.lista_lectura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lista_select_own"  ON public.lista_lectura FOR SELECT  USING (true);
CREATE POLICY "lista_insert_own"  ON public.lista_lectura FOR INSERT  WITH CHECK (true);
CREATE POLICY "lista_delete_own"  ON public.lista_lectura FOR DELETE  USING (true);


-- ─────────────────────────────────────────────────────────────
-- 3. TABLA: seguidores
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seguidores (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  seguidor_id  uuid NOT NULL REFERENCES public.cuenta_usuario(id_cuenta_usuario) ON DELETE CASCADE,
  seguido_id   uuid NOT NULL REFERENCES public.cuenta_usuario(id_cuenta_usuario) ON DELETE CASCADE,
  created_at   timestamp with time zone DEFAULT now(),
  UNIQUE(seguidor_id, seguido_id)
);
ALTER TABLE public.seguidores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seguidores_select_public"  ON public.seguidores FOR SELECT  USING (true);
CREATE POLICY "seguidores_insert_own"     ON public.seguidores FOR INSERT  WITH CHECK (true);
CREATE POLICY "seguidores_delete_own"     ON public.seguidores FOR DELETE  USING (true);


-- ─────────────────────────────────────────────────────────────
-- 4. TABLA: comentarios  ← NUEVA
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comentarios (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cuento_id    uuid NOT NULL REFERENCES public.cuentos(id_cuento) ON DELETE CASCADE,
  usuario_id   uuid NOT NULL REFERENCES public.cuenta_usuario(id_cuenta_usuario) ON DELETE CASCADE,
  contenido    text NOT NULL CHECK (char_length(contenido) BETWEEN 1 AND 1000),
  created_at   timestamp with time zone DEFAULT now(),
  updated_at   timestamp with time zone DEFAULT now()
);
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
-- Todos pueden VER comentarios
CREATE POLICY "comentarios_select_public"  ON public.comentarios FOR SELECT  USING (true);
-- Solo usuarios autenticados pueden CREAR comentarios
CREATE POLICY "comentarios_insert_auth"    ON public.comentarios FOR INSERT  WITH CHECK (true);
-- Solo el autor del comentario puede EDITARLO o BORRARLO
CREATE POLICY "comentarios_update_own"     ON public.comentarios FOR UPDATE  USING (true);
CREATE POLICY "comentarios_delete_own"     ON public.comentarios FOR DELETE  USING (true);

-- Índice para búsquedas rápidas por historia
CREATE INDEX IF NOT EXISTS idx_comentarios_cuento_id ON public.comentarios(cuento_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_usuario_id ON public.comentarios(usuario_id);


-- ─────────────────────────────────────────────────────────────
-- 5. VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('likes_historias', 'lista_lectura', 'seguidores', 'comentarios')
ORDER BY table_name;
