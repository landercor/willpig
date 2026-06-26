import { supabaseAdmin as supabase } from '../config/db.js';

export const historiaService = {

  // ── Admin dashboard ─────────────────────────────────────────
  async getHistoriasPaginated(page = 1, limit = 20, filters = {}) {
    const start = (page - 1) * limit;
    const end   = start + limit - 1;

    let query = supabase
      .from('cuentos')
      .select(`
        id_cuento, titulo, descripcion, portada_url, created_at, categoria_id,
        cuenta_usuario ( username ),
        capitulos ( count ),
        cuentos_config ( estado_id, es_publico, estados_cuento ( nombre ) ),
        cuentos_metricas ( vistas )
      `, { count: 'exact' });

    if (filters.estado) {
      // Filtrar por nombre de estado (join con estados_cuento)
      const { data: estadoRows } = await supabase
        .from('estados_cuento')
        .select('id')
        .eq('nombre', filters.estado)
        .single();
      if (estadoRows) query = query.eq('cuentos_config.estado_id', estadoRows.id);
    }
    if (filters.categoria_id) query = query.eq('categoria_id', filters.categoria_id);
    if (filters.q && filters.q.trim()) {
      query = query.ilike('titulo', `%${filters.q.trim()}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) throw error;

    // Normalizar para compatibilidad con la vista admin (aplanar objetos anidados)
    const historias = (data || []).map(h => ({
      ...h,
      estado:     h.cuentos_config?.estados_cuento?.nombre ?? 'borrador',
      es_publico: h.cuentos_config?.es_publico ?? false,
      vistas:     h.cuentos_metricas?.vistas ?? 0,
    }));

    return { historias, count, totalPages: Math.ceil((count || 0) / limit) };
  },

  // ── Obtener historia por ID para edición (autor) ─────────────
  async getStoryByIdForEdit(id) {
    const { data, error } = await supabase
      .from('cuentos')
      .select(`
        id_cuento, titulo, descripcion, portada_url, cuenta_usuario_id, categoria_id,
        capitulos ( id_capitulo, titulo, created_at, orden ),
        cuentos_config (
          estado_id, es_publico, audiencia_id, idioma_id, derechos_id, clasificacion_id,
          estados_cuento ( nombre ),
          audiencias ( nombre ),
          idiomas ( codigo, nombre ),
          tipos_derechos ( nombre ),
          clasificaciones ( nombre )
        )
      `)
      .eq('id_cuento', id)
      .single();
    if (error) throw error;
    if (data && data.capitulos) {
      data.capitulos.sort((a, b) => a.orden - b.orden || new Date(a.created_at) - new Date(b.created_at));
    }
    return data;
  },

  // ── Obtener historia por ID para lectura pública ─────────────
  async getStoryByIdForRead(id) {
    const { data, error } = await supabase
      .from('cuentos')
      .select(`
        id_cuento, cuenta_usuario_id, titulo, descripcion, portada_url, created_at,
        cuenta_usuario ( username, avatar_url ),
        categorias ( nombre ),
        capitulos ( id_capitulo, titulo, created_at, orden, contenido ),
        cuentos_config ( estado_id, es_publico, estados_cuento ( nombre ) ),
        cuentos_metricas ( vistas )
      `)
      .eq('id_cuento', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (data && data.capitulos) {
      data.capitulos.sort((a, b) => a.orden - b.orden || new Date(a.created_at) - new Date(b.created_at));
    }

    // Normalizar campos para compatibilidad con las vistas EJS existentes
    if (data) {
      data.estado     = data.cuentos_config?.estados_cuento?.nombre ?? 'borrador';
      data.visibilidad = data.cuentos_config?.es_publico ? 'publica' : 'privada';
      data.es_publico = data.cuentos_config?.es_publico ?? false;
      data.vistas     = data.cuentos_metricas?.vistas ?? 0;
    }

    return data;
  },

  // ── Búsqueda avanzada ────────────────────────────────────────
  async searchHistorias(q, page = 1, limit = 20, filters = {}) {
    const start = (page - 1) * limit;
    const end   = start + limit - 1;

    let userIds = [];
    if (q) {
      const { data: users } = await supabase
        .from('cuenta_usuario')
        .select('id_cuenta_usuario')
        .ilike('username', `%${q}%`);
      if (users && users.length > 0) userIds = users.map(u => u.id_cuenta_usuario);
    } else if (filters.autor) {
      const { data: user } = await supabase
        .from('cuenta_usuario')
        .select('id_cuenta_usuario')
        .eq('username', filters.autor)
        .single();
      if (user) userIds = [user.id_cuenta_usuario];
      else return { resultados: [], count: 0, totalPages: 0 };
    }

    // Obtener ID de estado "publicado"
    const { data: estadoPublicado } = await supabase
      .from('estados_cuento')
      .select('id')
      .eq('nombre', 'publicado')
      .single();

    let query = supabase
      .from('cuentos')
      .select(`
        id_cuento, titulo, descripcion, portada_url, created_at, cuenta_usuario_id,
        cuenta_usuario ( id_cuenta_usuario, username, avatar_url ),
        categorias ( nombre ),
        cuentos_config ( estado_id, es_publico ),
        cuentos_metricas ( vistas )
      `, { count: 'exact' })
      .is('deleted_at', null);

    // Filtrar por estado publicado y visibilidad pública
    if (estadoPublicado) {
      query = query.eq('cuentos_config.estado_id', estadoPublicado.id);
    }
    query = query.eq('cuentos_config.es_publico', true);

    if (q) {
      if (userIds.length > 0) {
        query = query.or(`titulo.ilike.%${q}%,descripcion.ilike.%${q}%,cuenta_usuario_id.in.(${userIds.join(',')})`);
      } else {
        query = query.or(`titulo.ilike.%${q}%,descripcion.ilike.%${q}%`);
      }
    } else if (filters.autor && userIds.length > 0) {
      query = query.eq('cuenta_usuario_id', userIds[0]);
    }

    if (filters.categoria_id) query = query.eq('categoria_id', filters.categoria_id);

    const sortColumn = filters.sort === 'vistas' ? 'cuentos_metricas.vistas' : 'created_at';
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) throw error;

    const resultados = (data || []).map(h => ({
      ...h,
      vistas: h.cuentos_metricas?.vistas ?? 0,
    }));

    return { resultados, count, totalPages: Math.ceil((count || 0) / limit) };
  },

  // ── Incrementar vistas (función SQL atómica) ─────────────────
  async incrementViews(id) {
    const { error } = await supabase.rpc('incrementar_vistas', { p_cuento_id: id });
    if (error) console.error('Error al incrementar vistas:', error.message);
  },

  // ── Mis historias ────────────────────────────────────────────
  async getMyStories(userId) {
    const { data, error } = await supabase
      .from('cuentos')
      .select(`
        id_cuento, titulo, descripcion, portada_url, created_at,
        cuentos_config ( estado_id, estados_cuento ( nombre ) ),
        cuentos_metricas ( vistas )
      `)
      .eq('cuenta_usuario_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(h => ({
      ...h,
      estado: h.cuentos_config?.estados_cuento?.nombre ?? 'borrador',
      vistas: h.cuentos_metricas?.vistas ?? 0,
    }));
  },

  // ── Crear historia (+ config inicial) ───────────────────────
  async createStory(storyData) {
    const {
      titulo, descripcion, portada_url, cuenta_usuario_id, categoria_id,
      estado = 'borrador', visibilidad, es_publico = false,
      audiencia_id, idioma_id, derechos_id, clasificacion_id
    } = storyData;

    // 1. Insertar identidad central
    const { error: insertError, data: inserted } = await supabase
      .from('cuentos')
      .insert([{ titulo, descripcion, portada_url, cuenta_usuario_id, categoria_id }])
      .select('id_cuento')
      .single();
    if (insertError) throw insertError;

    const cuento_id = inserted.id_cuento;

    // 2. Resolver estado_id
    const { data: estadoRow } = await supabase
      .from('estados_cuento')
      .select('id')
      .eq('nombre', estado)
      .single();
    const estado_id = estadoRow?.id ?? 1;

    // 3. Insertar config
    const { error: configError } = await supabase
      .from('cuentos_config')
      .insert([{
        cuento_id,
        estado_id,
        es_publico: es_publico || (estado === 'publicado' && visibilidad === 'publica'),
        audiencia_id:     audiencia_id     ?? null,
        idioma_id:        idioma_id        ?? null,
        derechos_id:      derechos_id      ?? null,
        clasificacion_id: clasificacion_id ?? null,
      }]);
    if (configError) throw configError;

    // 4. Crear fila de métricas vacía
    await supabase.from('cuentos_metricas').insert([{ cuento_id, vistas: 0 }]);

    return { id_cuento: cuento_id, titulo, cuenta_usuario_id, estado };
  },

  // ── Actualizar historia ──────────────────────────────────────
  async updateStory(id, updates) {
    const {
      titulo, descripcion, portada_url, categoria_id,
      estado, visibilidad, es_publico,
      audiencia_id, idioma_id, derechos_id, clasificacion_id,
      ...rest
    } = updates;

    // Actualizar tabla principal si hay campos de identidad
    const mainUpdates = {};
    if (titulo      !== undefined) mainUpdates.titulo      = titulo;
    if (descripcion !== undefined) mainUpdates.descripcion = descripcion;
    if (portada_url !== undefined) mainUpdates.portada_url = portada_url;
    if (categoria_id!== undefined) mainUpdates.categoria_id= categoria_id;

    if (Object.keys(mainUpdates).length > 0) {
      const { error } = await supabase.from('cuentos').update(mainUpdates).eq('id_cuento', id);
      if (error) throw error;
    }

    // Actualizar config si hay campos de configuración
    const configUpdates = {};
    if (audiencia_id     !== undefined) configUpdates.audiencia_id     = audiencia_id;
    if (idioma_id        !== undefined) configUpdates.idioma_id        = idioma_id;
    if (derechos_id      !== undefined) configUpdates.derechos_id      = derechos_id;
    if (clasificacion_id !== undefined) configUpdates.clasificacion_id = clasificacion_id;
    if (es_publico       !== undefined) configUpdates.es_publico       = es_publico;

    if (estado !== undefined) {
      const { data: estadoRow } = await supabase
        .from('estados_cuento').select('id').eq('nombre', estado).single();
      if (estadoRow) configUpdates.estado_id = estadoRow.id;
    }
    if (visibilidad !== undefined) {
      configUpdates.es_publico = visibilidad === 'publica';
    }

    if (Object.keys(configUpdates).length > 0) {
      const { error } = await supabase
        .from('cuentos_config')
        .update(configUpdates)
        .eq('cuento_id', id);
      if (error) throw error;
    }

    return true;
  },

  // ── Eliminar historia (soft delete) ─────────────────────────
  async deleteStory(id) {
    // Soft delete: marcar deleted_at en lugar de borrar físicamente
    const { error } = await supabase
      .from('cuentos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id_cuento', id);
    if (error) throw error;
    return true;
  },

  async getDashboardTotal() {
    const { count, error } = await supabase
      .from('cuentos')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);
    if (error) throw error;
    return count;
  }
};
