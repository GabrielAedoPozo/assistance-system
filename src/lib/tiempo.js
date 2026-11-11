// Fecha y hora actuales en Perú (UTC-5, sin horario de verano)
export const peruNow = () => {
  const peru = new Date(Date.now() - 5 * 60 * 60 * 1000)
  return { fecha: peru.toISOString().slice(0, 10), hora: peru.toISOString().slice(11, 19) }
}

// 'HH:MM[:SS]' → minutos
export const aMin = (t) => {
  const [h, m, s] = String(t).split(':').map(Number)
  return h * 60 + m + (s || 0) / 60
}

export const esHora = (v) => typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v)
export const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
