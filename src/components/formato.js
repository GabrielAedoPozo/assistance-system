// ── Reglas de asistencia (son las del POS original; ajustarlas a la política de la empresa) ──
export const TOLERANCIA_MIN = 10        // minutos de gracia antes de contar tardanza
export const DESCUENTO_TARDANZA_H = 1   // horas que se descuentan del día si llega tarde

export const hhmm = (t) => (t ? String(t).slice(0, 5) : '—')

// La DB devuelve DATE como 'YYYY-MM-DD' (dateStrings), aquí solo se recorta por si acaso
export const toDateStr = (v) => (v ? String(v).slice(0, 10) : '')

const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const hoyLocal = () => isoLocal(new Date())
export const inicioMes = () => hoyLocal().slice(0, 8) + '01'
export const diaSemana = (iso) => new Date(iso + 'T00:00:00').getDay()

export const mondayOf = (iso) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() || 7) - 1))
  return isoLocal(d)
}

export const fmtFecha = (v) => {
  if (!v) return '—'
  return new Date(toDateStr(v) + 'T00:00:00').toLocaleDateString('es-PE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export const fmtHoras = (h) => {
  if (h == null || h === '') return '—'
  const total = Math.round(Number(h) * 60)
  const hrs = Math.floor(total / 60)
  const mins = total % 60
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}min`
}

const aMin = (t) => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + m }

export const getExcepciones = (a) =>
  a.excepciones_horario
    ? (typeof a.excepciones_horario === 'string' ? JSON.parse(a.excepciones_horario) : a.excepciones_horario)
    : {}

// Minutos de tardanza (positivo = tarde, negativo = temprano); null si no tiene horario ese día
export const calcTardanzaMin = (a) => {
  if (!a.hora_entrada) return null
  const dia = diaSemana(toDateStr(a.fecha))
  let prog
  if (dia === 6) prog = a.horario_ingreso_sabado
  else if (dia === 0) prog = a.horario_ingreso_domingo
  else prog = getExcepciones(a)[String(dia)]?.hora_ingreso || a.horario_ingreso
  return prog ? aMin(a.hora_entrada) - aMin(prog) : null
}

export const esTarde = (a) => (calcTardanzaMin(a) ?? 0) > TOLERANCIA_MIN

// Receso efectivo del día: sábado/domingo si tienen uno propio, si no el general
export const getRecesoEfectivo = (a) => {
  if (!a?.fecha) return null
  const dia = diaSemana(toDateStr(a.fecha))
  const par = (ini, fin) => (ini && fin ? { hora_inicio: ini.slice(0, 5), hora_fin: fin.slice(0, 5) } : null)
  if (dia === 6 && a.receso_hora_inicio_sabado && a.receso_hora_fin_sabado)
    return par(a.receso_hora_inicio_sabado, a.receso_hora_fin_sabado)
  if (dia === 0 && a.receso_hora_inicio_domingo && a.receso_hora_fin_domingo)
    return par(a.receso_hora_inicio_domingo, a.receso_hora_fin_domingo)
  return par(a.receso_hora_inicio, a.receso_hora_fin)
}

// Horas efectivas: descuento por tardanza + la parte de la jornada que cae dentro del receso
export const calcHrsEfectivas = (a) => {
  let hrs = Number(a.horas_trabajadas || 0)
  if (esTarde(a)) hrs = Math.max(0, hrs - DESCUENTO_TARDANZA_H)
  const receso = a.hora_entrada && a.hora_salida ? getRecesoEfectivo(a) : null
  if (receso) {
    const cruce = Math.max(0,
      Math.min(aMin(a.hora_salida), aMin(receso.hora_fin)) -
      Math.max(aMin(a.hora_entrada), aMin(receso.hora_inicio))
    )
    hrs = Math.max(0, hrs - cruce / 60)
  }
  return hrs
}

// Horas programadas por semana según el horario Lun–Vie (aplicado también a sáb/dom si trabaja)
export const horasProgSemana = (w) => {
  if (!w.hora_ingreso || !w.hora_salida) return null
  const dias = 5 + (w.trabaja_sabado ? 1 : 0) + (w.trabaja_domingo ? 1 : 0)
  return Math.round(((aMin(w.hora_salida) - aMin(w.hora_ingreso)) * dias) / 6) / 10
}

// fetch a la API del mismo sitio; lanza Error con el mensaje del servidor (y su status)
export const api = async (path, opts = {}) => {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(body.error || r.statusText)
    e.status = r.status
    throw e
  }
  return body
}
