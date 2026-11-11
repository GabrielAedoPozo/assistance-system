import { defineConfig, envField } from 'astro/config'
import node from '@astrojs/node'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Escucha en 0.0.0.0 (necesario en Railway; la variable HOST lo puede sobrescribir)
  server: { host: true },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      ADMIN_PASSWORD: envField.string({ context: 'server', access: 'secret', min: 8 }),
      SESSION_SECRET: envField.string({ context: 'server', access: 'secret', min: 32 }),
      // 'secret' = se lee al arrancar el servidor, no se incrusta en el build (no es un dato sensible)
      EMPRESA_NOMBRE: envField.string({ context: 'server', access: 'secret', default: 'Mi Empresa' }),
    },
  },
})
