async function getCatalogId(db, table, nombre) {
  const { data } = await db.from(table).select('id').ilike('nombre', nombre).maybeSingle();
  return data?.id || null;
}

export async function resolveUserCatalogPayload({ db, rol, estado }) {
  const normalizedRol = String(rol || 'lector').trim().toLowerCase();
  const normalizedEstado = String(estado || 'activa').trim().toLowerCase();

  const [rol_id, estado_id] = await Promise.all([
    getCatalogId(db, 'roles_usuario', normalizedRol),
    getCatalogId(db, 'estados_usuario', normalizedEstado),
  ]);

  return {
    rol: normalizedRol,
    estado: normalizedEstado,
    rol_id,
    estado_id,
  };
}
