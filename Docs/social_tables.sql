CREATE TABLE IF NOT EXISTS seguidores (
  id BIGSERIAL PRIMARY KEY,
  seguidor_id BIGINT NOT NULL REFERENCES cuenta_usuario(id_cuenta_usuario) ON DELETE CASCADE,
  seguido_id BIGINT NOT NULL REFERENCES cuenta_usuario(id_cuenta_usuario) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seguidor_id, seguido_id),
  CHECK (seguidor_id <> seguido_id)
);

CREATE INDEX IF NOT EXISTS idx_seguidores_seguidor_id
  ON seguidores(seguidor_id);

CREATE INDEX IF NOT EXISTS idx_seguidores_seguido_id
  ON seguidores(seguido_id);

CREATE TABLE IF NOT EXISTS likes_historias (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES cuenta_usuario(id_cuenta_usuario) ON DELETE CASCADE,
  cuento_id BIGINT NOT NULL REFERENCES cuentos(id_cuento) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, cuento_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_historias_usuario_id
  ON likes_historias(usuario_id);

CREATE INDEX IF NOT EXISTS idx_likes_historias_cuento_id
  ON likes_historias(cuento_id);

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS usuario_destino_id BIGINT REFERENCES cuenta_usuario(id_cuenta_usuario) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS usuario_origen_id BIGINT REFERENCES cuenta_usuario(id_cuenta_usuario) ON DELETE SET NULL;
