import { claveCorrecta, iniciarSesion, loginBloqueado, registrarFallo } from '../../lib/auth.js'
import { json, leerJson } from '../../lib/http.js'

export const POST = async ({ request, cookies, clientAddress }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress
  if (loginBloqueado(ip)) return json({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429)
  const { clave } = await leerJson(request)
  if (!claveCorrecta(clave)) {
    registrarFallo(ip)
    return json({ error: 'Contraseña incorrecta' }, 401)
  }
  iniciarSesion(cookies)
  return json({ ok: true })
}
