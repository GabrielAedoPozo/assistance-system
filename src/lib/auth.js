import { createHmac, timingSafeEqual } from 'node:crypto'
import { ADMIN_PASSWORD, SESSION_SECRET } from 'astro:env/server'

const COOKIE = 'adm'
const DURACION_MS = 12 * 60 * 60 * 1000

const firmar = (valor) => createHmac('sha256', SESSION_SECRET).update(valor).digest('base64url')

const iguales = (a, b) => {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

// Se comparan las firmas (mismo largo siempre) para no filtrar nada por tiempo de respuesta
export const claveCorrecta = (clave) =>
  typeof clave === 'string' && iguales(firmar(clave), firmar(ADMIN_PASSWORD))

// Cookie "vencimiento.firma": no hace falta guardar sesiones en la DB
export const iniciarSesion = (cookies) => {
  const exp = String(Date.now() + DURACION_MS)
  cookies.set(COOKIE, `${exp}.${firmar(exp)}`, {
    httpOnly: true, sameSite: 'strict', secure: import.meta.env.PROD, path: '/', maxAge: DURACION_MS / 1000,
  })
}

export const cerrarSesion = (cookies) => cookies.delete(COOKIE, { path: '/' })

export const esAdmin = (cookies) => {
  const [exp, firma] = (cookies.get(COOKIE)?.value || '').split('.')
  return !!exp && !!firma && iguales(firma, firmar(exp)) && Number(exp) > Date.now()
}

// Freno a fuerza bruta en el login: 10 intentos fallidos por IP cada 15 min (en memoria)
const VENTANA_MS = 15 * 60 * 1000
const fallos = new Map()

export const loginBloqueado = (ip) => {
  const f = fallos.get(ip)
  return !!f && f.n >= 10 && f.hasta > Date.now()
}

export const registrarFallo = (ip) => {
  const f = fallos.get(ip)
  if (!f || f.hasta < Date.now()) fallos.set(ip, { n: 1, hasta: Date.now() + VENTANA_MS })
  else f.n++
}
