import { query } from '../../../lib/db.js'
import { esFecha } from '../../../lib/tiempo.js'
import { json } from '../../../lib/http.js'

// Registros de un rango de fechas, con el horario del trabajador para calcular tardanzas y recesos
export const GET = async ({ url }) => {
  const desde = url.searchParams.get('desde')
  const hasta = url.searchParams.get('hasta')
  if (!esFecha(desde) || !esFecha(hasta)) return json({ error: 'Rango de fechas inválido' }, 400)
  const rows = await query(`
    SELECT a.*, t.nombre AS trabajador_nombre, t.cargo AS trabajador_cargo,
           t.hora_ingreso AS horario_ingreso, t.hora_salida AS horario_salida,
           t.trabaja_sabado,
           t.hora_ingreso_sabado AS horario_ingreso_sabado,
           t.hora_salida_sabado  AS horario_salida_sabado,
           t.trabaja_domingo,
           t.hora_ingreso_domingo AS horario_ingreso_domingo,
           t.hora_salida_domingo  AS horario_salida_domingo,
           t.excepciones_horario,
           t.receso_hora_inicio, t.receso_hora_fin,
           t.receso_hora_inicio_sabado, t.receso_hora_fin_sabado,
           t.receso_hora_inicio_domingo, t.receso_hora_fin_domingo
    FROM asistencia a
    JOIN trabajadores t ON t.id = a.trabajador_id
    WHERE a.fecha BETWEEN ? AND ?
    ORDER BY a.fecha DESC, a.hora_entrada DESC
  `, [desde, hasta])
  return json(rows)
}
