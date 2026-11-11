import { query } from '../../lib/db.js'
import { peruNow } from '../../lib/tiempo.js'
import { json, leerJson } from '../../lib/http.js'

// Escanear QR — devuelve el trabajador y su estado de asistencia de hoy
export const POST = async ({ request }) => {
  const { qrToken } = await leerJson(request)
  if (!qrToken) return json({ error: 'QR token requerido' }, 400)
  const [trabajador] = await query(
    'SELECT id, nombre, cargo FROM trabajadores WHERE qr_token = ? AND activo = 1', [qrToken]
  )
  if (!trabajador) return json({ error: 'Trabajador no encontrado o inactivo' }, 404)
  const [asistencia] = await query(
    'SELECT * FROM asistencia WHERE trabajador_id = ? AND fecha = ?', [trabajador.id, peruNow().fecha]
  )
  const estado = !asistencia ? 'sin_registro' : asistencia.hora_salida ? 'completo' : 'entrada'
  return json({ trabajador, asistencia: asistencia || null, estado })
}
