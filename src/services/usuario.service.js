import { supabaseAdmin as supabase } from '../config/db.js';
import bcrypt from 'bcrypt';

export const usuarioService = {

  async getUsuariosPaginated(page = 1, limit = 20, filters = {}) {
    const start = (page - 1) * limit;
    const end   = start + limit - 1;

    let query = supabase
      .from('cuenta_usuario')
      .select(`
        id_cuenta_usuario, username, email, fecha_registro,
        roles_usuario ( nombre ),
        estados_usuario ( nombre )
      `, { count: 'exact' });

    if (filters.rol) {
      const { data: rolRow } = await supabase.from('roles_usuario').select('id').eq('nombre', filters.rol).single();
      if (rolRow) query = query.eq('rol_id', rolRow.id);
    }
    if (filters.estado) {
      const { data: estadoRow } = await supabase.from('estados_usuario').select('id').eq('nombre', filters.estado).single();
      if (estadoRow) query = query.eq('estado_id', estadoRow.id);
    }
    if (filters.q && filters.q.trim()) {
      query = query.or(`username.ilike.%${filters.q.trim()}%,email.ilike.%${filters.q.trim()}%`);
    }

    const { data, count, error } = await query
      .order('fecha_registro', { ascending: false })
      .range(start, end);

    if (error) throw error;

    const usuarios = (data || []).map(u => ({
      ...u,
      rol:    u.roles_usuario?.nombre   ?? 'lector',
      estado: u.estados_usuario?.nombre ?? 'activa',
    }));

    return { usuarios, count, totalPages: Math.ceil((count || 0) / limit) };
  },

  async createUser(userData) {
    const { username, email, password, rol = 'lector' } = userData;

    // 1. Crear en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, rol }
    });
    if (authError) throw authError;

    // 2. Resolver IDs de catálogo
    const [{ data: rolRow }, { data: estadoRow }] = await Promise.all([
      supabase.from('roles_usuario').select('id').eq('nombre', rol).single(),
      supabase.from('estados_usuario').select('id').eq('nombre', 'activa').single(),
    ]);

    // 3. Insertar perfil público en cuenta_usuario
    const { data: newUser, error: insertError } = await supabase
      .from('cuenta_usuario')
      .insert([{
        username,
        email,
        rol_id:    rolRow?.id    ?? 1,
        estado_id: estadoRow?.id ?? 1,
      }])
      .select('id_cuenta_usuario')
      .single();
    if (insertError) throw insertError;

    // 4. Insertar hash en cuenta_credenciales
    const clave_hash = await bcrypt.hash(password, 10);
    const { error: credError } = await supabase
      .from('cuenta_credenciales')
      .insert([{ cuenta_usuario_id: newUser.id_cuenta_usuario, clave_hash }]);
    if (credError) throw credError;

    return authData;
  },

  async updateUser(id, updates) {
    // Separar actualizaciones de perfil vs. catálogo
    const profileUpdates = {};
    if (updates.username !== undefined) profileUpdates.username = updates.username;
    if (updates.email    !== undefined) profileUpdates.email    = updates.email;

    if (updates.rol !== undefined) {
      const { data: rolRow } = await supabase.from('roles_usuario').select('id').eq('nombre', updates.rol).single();
      if (rolRow) profileUpdates.rol_id = rolRow.id;
    }
    if (updates.estado !== undefined) {
      const { data: estadoRow } = await supabase.from('estados_usuario').select('id').eq('nombre', updates.estado).single();
      if (estadoRow) profileUpdates.estado_id = estadoRow.id;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await supabase
        .from('cuenta_usuario')
        .update(profileUpdates)
        .eq('id_cuenta_usuario', id);
      if (error) throw error;
    }

    return true;
  },

  async deleteUser(id) {
    // Las FK con ON DELETE CASCADE borran credenciales automáticamente
    const { error } = await supabase
      .from('cuenta_usuario')
      .delete()
      .eq('id_cuenta_usuario', id);
    if (error) throw error;
    return true;
  },

  async getDashboardTotal() {
    const { count, error } = await supabase
      .from('cuenta_usuario')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count;
  }
};
