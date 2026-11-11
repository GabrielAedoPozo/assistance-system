import { cerrarSesion } from '../../lib/auth.js'
import { json } from '../../lib/http.js'

export const POST = async ({ cookies }) => {
  cerrarSesion(cookies)
  return json({ ok: true })
}
