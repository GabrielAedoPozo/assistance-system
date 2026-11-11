import { query } from '../../../lib/db.js'
import { camposTrabajador } from '../../../lib/trabajadores.js'
import { json, leerJson } from '../../../lib/http.js'

const devolver = async (id) => {
  const [trabajador] = await query('SELECT * FROM trabajadores WHERE id = ?', [id])
  return trabajador ? json(trabajador) : json({ error: 'Trabajador no encontrado' }, 404)
}

// Editar datos y horarios
export const PUT = async ({ params, request }) => {
  const campos = camposTrabajador(await leerJson(request))
  if (!campos.nombre) return json({ error: 'Nombre requerido' }, 400)
  await query('UPDATE trabajadores SET ? WHERE id = ?', [campos, params.id])
  return devolver(params.id)
}

// Activar / desactivar
export const PATCH = async ({ params, request }) => {
  const { activo } = await leerJson(request)
  await query('UPDATE trabajadores SET activo = ? WHERE id = ?', [activo ? 1 : 0, params.id])
  return devolver(params.id)
}
