import { query } from '../../lib/db.js'
import { peruNow, aMin } from '../../lib/tiempo.js'
import { json, leerJson } from '../../lib/http.js'

// Registrar entrada o salida. Pide el QR y no el id, para que nadie marque por otro sin su código.
export const POST = async ({ request }) => {
  const { qrToken, tipo } = await leerJson(request)
  if (!qrToken || !['entrada', 'salida'].includes(tipo)) return json({ error: 'Datos inválidos' }, 400)
  const [trabajador] = await query('SELECT id FROM trabajadores WHERE qr_token = ? AND activo = 1', [qrToken])
  if (!trabajador) return json({ error: 'Trabajador no encontrado o inactivo' }, 404)
  const { fecha, hora } = peruNow()

  if (tipo === 'entrada') {
    try {
      await query(
        'INSERT INTO asistencia (trabajador_id, fecha, hora_entrada) VALUES (?, ?, ?)', [trabajador.id, fecha, hora]
      )
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return json({ error: 'La entrada de hoy ya estaba registrada' }, 409)
      throw e
    }
  } else {
    const [abierta] = await query(
      'SELECT id, hora_entrada FROM asistencia WHERE trabajador_id = ? AND fecha = ? AND hora_salida IS NULL',
      [trabajador.id, fecha]
    )
    if (!abierta) return json({ error: 'No hay una entrada pendiente de salida hoy' }, 409)
    const horas = Math.max(0, (aMin(hora) - aMin(abierta.hora_entrada)) / 60)
    await query(
      'UPDATE asistencia SET hora_salida = ?, horas_trabajadas = ? WHERE id = ? AND hora_salida IS NULL',
      [hora, horas.toFixed(2), abierta.id]
    )
  }

  const [asistencia] = await query(
    'SELECT * FROM asistencia WHERE trabajador_id = ? AND fecha = ?', [trabajador.id, fecha]
  )
  return json({ asistencia })
}
