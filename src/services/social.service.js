import { supabaseAdmin as supabase } from '../config/db.js';
import { crearNotificacion } from './notificacion.service.js';

export const socialService = {
  async seguirUsuario(seguidorId, seguidoId) {
    if (String(seguidorId) === String(seguidoId)) throw new Error("No puedes seguirte a ti mismo");

    const { error } = await supabase
      .from('seguidores')
      .insert([{ seguidor_id: seguidorId, seguido_id: seguidoId }]);

    if (error && error.code !== '23505') throw error; // Ignorar duplicate key

    // Contar total de seguidores del seguido
    const { count } = await supabase
      .from('seguidores')
      .select('*', { count: 'exact', head: true })
      .eq('seguido_id', seguidoId);

    // Enviar notificación al usuario seguido
    if (!error) {
      await crearNotificacion('nuevo_seguidor', seguidorId, seguidoId, null, 'usuario');
    }

    return count;
  },

  async dejarDeSeguir(seguidorId, seguidoId) {
    const { error } = await supabase
      .from('seguidores')
      .delete()
      .match({ seguidor_id: seguidorId, seguido_id: seguidoId });

    if (error) throw error;

    const { count } = await supabase
      .from('seguidores')
      .select('*', { count: 'exact', head: true })
      .eq('seguido_id', seguidoId);

    return count;
  },

  async estadoSeguimiento(seguidorId, seguidoId) {
    const { data, error } = await supabase
      .from('seguidores')
      .select('id')
      .match({ seguidor_id: seguidorId, seguido_id: seguidoId })
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  async darLike(usuarioId, cuentoId) {
    const { error } = await supabase
      .from('likes_historias')
      .insert([{ usuario_id: usuarioId, cuento_id: cuentoId }]);

    if (error && error.code !== '23505') throw error; // Ignorar si ya le dio like

    // Obtener el dueño de la historia para notificarle
    const { data: cuento } = await supabase
      .from('cuentos')
      .select('cuenta_usuario_id')
      .eq('id_cuento', cuentoId)
      .single();

    if (cuento && !error) {
      await crearNotificacion('nuevo_like', usuarioId, cuento.cuenta_usuario_id, cuentoId, 'cuento');
    }

    // Contar total de likes de la historia
    const { count } = await supabase
      .from('likes_historias')
      .select('*', { count: 'exact', head: true })
      .eq('cuento_id', cuentoId);

    return count;
  },

  async quitarLike(usuarioId, cuentoId) {
    const { error } = await supabase
      .from('likes_historias')
      .delete()
      .match({ usuario_id: usuarioId, cuento_id: cuentoId });

    if (error) throw error;

    const { count } = await supabase
      .from('likes_historias')
      .select('*', { count: 'exact', head: true })
      .eq('cuento_id', cuentoId);

    return count;
  },

  async estadoLike(usuarioId, cuentoId) {
    const { data, error } = await supabase
      .from('likes_historias')
      .select('id')
      .match({ usuario_id: usuarioId, cuento_id: cuentoId })
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  async agregarALista(usuarioId, cuentoId) {
    const { error } = await supabase
      .from('lista_lectura')
      .insert([{ usuario_id: usuarioId, cuento_id: cuentoId }]);

    if (error && error.code !== '23505') throw error; // ignorar duplicado

    const { count } = await supabase
      .from('lista_lectura')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId);

    return count;
  },

  async quitarDeLista(usuarioId, cuentoId) {
    const { error } = await supabase
      .from('lista_lectura')
      .delete()
      .match({ usuario_id: usuarioId, cuento_id: cuentoId });

    if (error) throw error;

    const { count } = await supabase
      .from('lista_lectura')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId);

    return count;
  },

  async estadoLista(usuarioId, cuentoId) {
    const { data, error } = await supabase
      .from('lista_lectura')
      .select('id')
      .match({ usuario_id: usuarioId, cuento_id: cuentoId })
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }
};
