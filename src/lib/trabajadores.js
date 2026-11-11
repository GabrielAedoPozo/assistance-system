import { esHora } from './tiempo.js'

const CAMPOS_HORA = [
  'hora_ingreso', 'hora_salida',
  'hora_ingreso_sabado', 'hora_salida_sabado',
  'hora_ingreso_domingo', 'hora_salida_domingo',
  'receso_hora_inicio', 'receso_hora_fin',
  'receso_hora_inicio_sabado', 'receso_hora_fin_sabado',
  'receso_hora_inicio_domingo', 'receso_hora_fin_domingo',
]

// Normaliza el body del formulario a columnas de la tabla trabajadores
export const camposTrabajador = (b) => ({
  nombre: String(b.nombre || '').trim(),
  cargo: String(b.cargo || '').trim(),
  trabaja_sabado: b.trabaja_sabado ? 1 : 0,
  trabaja_domingo: b.trabaja_domingo ? 1 : 0,
  excepciones_horario: b.excepciones_horario && Object.keys(b.excepciones_horario).length
    ? JSON.stringify(b.excepciones_horario)
    : null,
  ...Object.fromEntries(CAMPOS_HORA.map((c) => [c, esHora(b[c]) ? b[c] : null])),
})
