import { query } from '../../../lib/db.js'
import { aMin, esHora } from '../../../lib/tiempo.js'
import { json, leerJson } from '../../../lib/http.js'

// Corregir entrada/salida a mano
export const PUT = async ({ params, request }) => {
  const body = await leerJson(request)
  const entrada = esHora(body.hora_entrada) ? body.hora_entrada : null
  const salida = esHora(body.hora_salida) ? body.hora_salida : null
  const horas = entrada && salida ? Math.max(0, (aMin(salida) - aMin(entrada)) / 60).toFixed(2) : null
  await query(
    'UPDATE asistencia SET hora_entrada = ?, hora_salida = ?, horas_trabajadas = ? WHERE id = ?',
    [entrada, salida, horas, params.id]
  )
  return json({ ok: true })
}

export const DELETE = async ({ params }) => {
  await query('DELETE FROM asistencia WHERE id = ?', [params.id])
  return json({ ok: true })
}
