import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUserCatalogPayload } from '../src/utils/userCatalog.js';

test('resolveUserCatalogPayload returns normalized role/state and related ids', async () => {
  const db = {
    from(table) {
      return {
        select() {
          return this;
        },
        ilike() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle() {
          if (table === 'roles_usuario') {
            return Promise.resolve({ data: { id: 'role-123' } });
          }
          return Promise.resolve({ data: { id: 'state-456' } });
        }
      };
    }
  };

  const payload = await resolveUserCatalogPayload({
    db,
    rol: 'Admin',
    estado: 'Suspendida'
  });

  assert.equal(payload.rol, 'admin');
  assert.equal(payload.estado, 'suspendida');
  assert.equal(payload.rol_id, 'role-123');
  assert.equal(payload.estado_id, 'state-456');
});
