import { supabaseAdmin as supabase } from '../config/db.js';

/**
 * Crea una notificación en la base de datos
 * @param {string} tipo - 'nuevo_seguidor', 'nuevo_like', 'nuevo_capitulo', etc.
 * @param {number} origen_id - ID del usuario que genera la acción
 * @param {number} destino_id - ID del usuario que recibe la notificación
 * @param {number|null} entidad_id - ID de la entidad relacionada (cuento_id, etc.)
 * @param {string|null} entidad_tipo - 'cuento', 'usuario', etc.
 */
export const crearNotificacion = async (tipo, origen_id, destino_id, entidad_id = null, entidad_tipo = null) => {
  // No enviarse notificaciones a uno mismo
  if (String(origen_id) === String(destino_id)) return;

  try {
    const { error } = await supabase
      .from('notificaciones')
      .insert([{
        tipo,
        usuario_origen_id: origen_id,
        usuario_destino_id: destino_id,
        entidad_id,
        entidad_tipo,
        mensaje: generarMensaje(tipo),
        leida: false
      }]);

    if (error) throw error;
  } catch (error) {
    console.error('Error al crear notificación:', error);
  }
};

const generarMensaje = (tipo) => {
  switch (tipo) {
    case 'nuevo_seguidor':
      return 'Un usuario ha comenzado a seguirte.';
    case 'nuevo_like':
      return 'A alguien le ha gustado tu historia.';
    default:
      return 'Tienes una nueva notificación.';
  }
};
