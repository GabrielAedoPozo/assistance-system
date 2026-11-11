import { randomUUID } from 'node:crypto'
import { query } from '../../../lib/db.js'
import { camposTrabajador } from '../../../lib/trabajadores.js'
import { json, leerJson } from '../../../lib/http.js'

export const GET = async () => json(await query('SELECT * FROM trabajadores ORDER BY nombre ASC'))

export const POST = async ({ request }) => {
  const campos = camposTrabajador(await leerJson(request))
  if (!campos.nombre) return json({ error: 'Nombre requerido' }, 400)
  const r = await query('INSERT INTO trabajadores SET ?', [{ ...campos, qr_token: randomUUID() }])
  const [trabajador] = await query('SELECT * FROM trabajadores WHERE id = ?', [r.insertId])
  return json(trabajador)
}
