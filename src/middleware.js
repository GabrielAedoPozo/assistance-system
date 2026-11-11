import { defineMiddleware } from 'astro:middleware'
import { esAdmin } from './lib/auth.js'

// Únicas rutas /api accesibles sin sesión de admin (la tablet/celular que escanea los QR)
const PUBLICAS = ['/api/scan', '/api/marcar', '/api/login', '/api/logout']

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url
  if (!pathname.startsWith('/api/')) return next()
  if (!PUBLICAS.includes(pathname) && !esAdmin(ctx.cookies))
    return Response.json({ error: 'Sesión expirada, vuelve a ingresar' }, { status: 401 })
  try {
    return await next()
  } catch (e) {
    console.error(`Error en ${ctx.request.method} ${pathname}:`, e)
    return Response.json({ error: 'Error del servidor' }, { status: 500 })
  }
})
