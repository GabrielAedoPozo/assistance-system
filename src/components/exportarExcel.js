import {
  hhmm, toDateStr, mondayOf, diaSemana, calcTardanzaMin, calcHrsEfectivas, esTarde, horasProgSemana, TOLERANCIA_MIN,
} from './formato.js'

const cargarXLSX = async () => {
  const mod = await import('xlsx-js-style')
  return mod.default?.utils ? mod.default : mod
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const C = {
  BLUE: '2E75B6', NAVY: '1F3864', ALT: 'EEF3FB', TOTBG: 'D6E4F0', LBLBG: 'DCE6F1', SUBBG: 'E8F4FD',
  WHITE: 'FFFFFF', DARK: '1A1A1A', THIN: 'B8C9E0', AMBER: 'D35400', GREEN: '1E6B3C',
}
const borde = { style: 'thin', color: { rgb: C.THIN } }
const allB = { top: borde, bottom: borde, left: borde, right: borde }
const font = (bold, color, sz = 10) => ({ bold, color: { rgb: color }, sz, name: 'Calibri' })
const fill = (rgb) => ({ fgColor: { rgb }, patternType: 'solid' })
const align = (h, v = 'center', wrap = false) => ({ horizontal: h, vertical: v, ...(wrap ? { wrapText: true } : {}) })

const st = {
  title:  { font: font(true, C.WHITE, 14), fill: fill(C.BLUE),  alignment: align('center') },
  secHdr: { font: font(true, C.WHITE, 11), fill: fill(C.NAVY),  alignment: align('left') },
  tbHdr:  { font: font(true, C.WHITE),     fill: fill(C.BLUE),  alignment: align('center', 'center', true), border: allB },
  kpiLbl: { font: font(true, C.NAVY),      fill: fill(C.LBLBG), alignment: align('left'), border: allB },
  kpiVal: { font: font(false, C.DARK, 11), fill: fill(C.WHITE), alignment: align('left'), border: allB },
  tot:    { font: font(true, C.NAVY),      fill: fill(C.TOTBG), alignment: align('center'), border: allB },
  sub:    { font: font(true, C.NAVY),      fill: fill(C.SUBBG), alignment: align('center'), border: allB },
  amber:  { font: font(true, C.WHITE),     fill: fill(C.AMBER), alignment: align('center'), border: allB },
  green:  { font: font(true, C.WHITE),     fill: fill(C.GREEN), alignment: align('center'), border: allB },
}
st.totL = { ...st.tot, alignment: align('left') }
st.totN = { ...st.tot, numFmt: '#,##0.0' }
st.subL = { ...st.sub, alignment: align('left') }
st.subN = { ...st.sub, numFmt: '#,##0.0' }

const celda = (rgb, h) => ({ font: font(false, C.DARK), fill: fill(rgb), alignment: align(h), border: allB })
const stC = (f) => celda(f, 'center')
const stL = (f) => celda(f, 'left')
const stR = (f) => ({ ...celda(f, 'right'), numFmt: '#,##0.0' })

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const r1 = (n) => Math.round(n * 10) / 10
const r2 = (n) => Math.round(n * 100) / 100
const plural = (n, s) => `${n} ${s}${n !== 1 ? 's' : ''}`
const fmtDiaMes = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
const rangoSemana = (lunes) => {
  const ini = new Date(lunes + 'T00:00:00')
  const fin = new Date(ini); fin.setDate(ini.getDate() + 6)
  return [fmtDiaMes(ini), fmtDiaMes(fin)]
}
const ahora = () => new Date().toLocaleString('es-PE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})
const enRango = (a, desde, hasta) => { const f = toDateStr(a.fecha); return f >= desde && f <= hasta }
const porFecha = (a, b) => toDateStr(a.fecha).localeCompare(toDateStr(b.fecha))

// Hoja con cursor de fila y helpers para títulos, separadores y celdas combinadas
const crearHoja = (XLSX, NC) => {
  const ws = {}, mg = [], rh = []
  let r = 0
  const sc = (row, col, v, s, t) => {
    ws[XLSX.utils.encode_cell({ r: row, c: col })] = { v, t: t || (typeof v === 'number' ? 'n' : 's'), s }
  }
  const merge = (r1, c1, r2, c2) => mg.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })
  const filaLlena = (txt, estilo, hpt) => {
    for (let c = 0; c < NC; c++) sc(r, c, c === 0 ? txt : '', estilo)
    merge(r, 0, r, NC - 1); rh.push({ hpt }); r++
  }
  return {
    sc, merge, rh,
    get r() { return r },
    nextRow(hpt) { rh.push({ hpt }); r++ },
    sep() { for (let c = 0; c < NC; c++) sc(r, c, '', { fill: { patternType: 'none' } }); rh.push({ hpt: 8 }); r++ },
    title: (txt) => filaLlena(txt, st.title, 36),
    secHdr: (txt) => filaLlena(txt, st.secHdr, 22),
    // Fila de total/subtotal: etiqueta en col 1 combinada hasta la penúltima, número en la última
    filaTotal(etiqueta, valor, estilos) {
      for (let c = 0; c < NC; c++) {
        if (c === 1) sc(r, c, etiqueta, estilos.L)
        else if (c === NC - 1) sc(r, c, valor, estilos.N)
        else sc(r, c, '', estilos.base)
      }
      merge(r, 1, r, NC - 2)
    },
    fin(anchos) {
      ws['!cols'] = anchos.map((w) => ({ wch: w })); ws['!rows'] = rh; ws['!merges'] = mg
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: NC - 1 } })
      return ws
    },
  }
}

// ── Ficha individual de un trabajador ─────────────────────────────────────────
export const exportarTrabajador = async ({ trabajador: w, asistencia, desde, hasta }) => {
  const XLSX = await cargarXLSX()
  const registros = asistencia.filter((a) => a.trabajador_id === w.id && enRango(a, desde, hasta)).sort(porFecha)
  const periodo = `${desde} al ${hasta}`

  let horasTot = 0, diasPuntual = 0, diasTarde = 0, diasSinSalida = 0
  const porSemana = {}
  registros.forEach((a) => {
    const hrs = calcHrsEfectivas(a)
    horasTot += hrs
    const sem = (porSemana[mondayOf(toDateStr(a.fecha))] ??= { recs: [], horas: 0 })
    sem.recs.push(a); sem.horas += hrs
    if (!a.hora_salida) diasSinSalida++
    if (calcTardanzaMin(a) !== null) esTarde(a) ? diasTarde++ : diasPuntual++
  })
  const semanas = Object.keys(porSemana).sort()
  const numSemanas = semanas.length || 1
  const horasProg = horasProgSemana(w)

  // ── Hoja 1: ficha + detalle por semana ──
  const NC1 = 6
  const s1 = crearHoja(XLSX, NC1)
  const par = (l0, v0, l1, v1, { s0 = st.kpiVal, s1: sv1 = st.kpiVal, hpt = 21 } = {}) => {
    s1.sc(s1.r, 0, l0, st.kpiLbl); s1.sc(s1.r, 1, '', st.kpiLbl); s1.merge(s1.r, 0, s1.r, 1)
    s1.sc(s1.r, 2, v0, s0)
    s1.sc(s1.r, 3, l1, st.kpiLbl); s1.sc(s1.r, 4, '', st.kpiLbl); s1.merge(s1.r, 3, s1.r, 4)
    s1.sc(s1.r, 5, v1, sv1)
    s1.nextRow(hpt)
  }
  const resaltar = (n, estilo) => (n > 0 ? { ...estilo, alignment: align('left') } : st.kpiVal)
  const kpiN = { ...st.kpiVal, numFmt: '#,##0.0' }

  s1.title(`FICHA DE ASISTENCIA — ${w.nombre.toUpperCase()}`)
  s1.sep()
  s1.secHdr('  INFORMACIÓN DEL TRABAJADOR')
  par('Nombre completo:', w.nombre, 'Cargo:', w.cargo || '—')
  par('Estado:', w.activo ? 'Activo' : 'Inactivo', 'Período analizado:', periodo)
  par('Horario Lun–Vie:', w.hora_ingreso ? `${hhmm(w.hora_ingreso)} – ${hhmm(w.hora_salida)}` : '—',
      'H. prog./semana:', horasProg !== null ? `${horasProg} h` : '—')
  par('Horario Sábado:', w.trabaja_sabado && w.hora_ingreso_sabado ? `${hhmm(w.hora_ingreso_sabado)} – ${hhmm(w.hora_salida_sabado)}` : 'No trabaja',
      'Horario Domingo:', w.trabaja_domingo && w.hora_ingreso_domingo ? `${hhmm(w.hora_ingreso_domingo)} – ${hhmm(w.hora_salida_domingo)}` : 'No trabaja')
  par('Fecha de generación:', ahora(), 'Sistema:', 'GAP SYSTEM')
  s1.sep()

  s1.secHdr('  RESUMEN DEL PERÍODO')
  par('Días con asistencia:', registros.length, 'Semanas en el período:', numSemanas, { hpt: 22 })
  par('Horas totales trab.:', r1(horasTot), 'Prom. horas / semana:', r1(horasTot / numSemanas), { s0: kpiN, s1: kpiN, hpt: 22 })
  par(`Días puntual (≤${TOLERANCIA_MIN} min):`, diasPuntual, `Días con tardanza (>${TOLERANCIA_MIN} min):`, diasTarde,
      { s0: resaltar(diasPuntual, st.green), s1: resaltar(diasTarde, st.amber), hpt: 22 })
  par('Días sin salida reg.:', diasSinSalida, '', '', { s0: resaltar(diasSinSalida, st.amber), hpt: 22 })
  s1.sep()

  s1.secHdr('  DETALLE DE ASISTENCIA POR SEMANA')
  let n = 1
  semanas.forEach((wk, si) => {
    const { recs, horas } = porSemana[wk]
    const [ini, fin] = rangoSemana(wk)
    s1.secHdr(`  SEMANA ${si + 1}  —  ${ini} al ${fin}  ·  ${plural(recs.length, 'día')}  ·  ${r1(horas)} h trabajadas`)
    ;['N°', 'Fecha', 'Día', 'H. Entrada', 'H. Salida', 'Horas\ntrabajadas'].forEach((h, c) => s1.sc(s1.r, c, h, st.tbHdr))
    s1.nextRow(36)
    recs.forEach((a, i) => {
      const f = i % 2 === 0 ? C.WHITE : C.ALT
      const fecha = toDateStr(a.fecha)
      s1.sc(s1.r, 0, n++, stC(f))
      s1.sc(s1.r, 1, fecha, stC(f))
      s1.sc(s1.r, 2, DIAS_ES[diaSemana(fecha)], stC(f))
      s1.sc(s1.r, 3, hhmm(a.hora_entrada), stC(f))
      s1.sc(s1.r, 4, a.hora_salida ? hhmm(a.hora_salida) : 'Sin reg.', a.hora_salida ? stC(f) : st.amber)
      s1.sc(s1.r, 5, r2(calcHrsEfectivas(a)), stR(f))
      s1.nextRow(18)
    })
    s1.filaTotal(`Total semana ${si + 1}  (${plural(recs.length, 'día')})`, r1(horas), { base: st.sub, L: st.subL, N: st.subN })
    s1.nextRow(20)
    if (si < semanas.length - 1) s1.sep()
  })
  s1.sep()
  s1.filaTotal(`TOTAL PERÍODO  (${registros.length} días · ${plural(numSemanas, 'semana')})`, r1(horasTot), { base: st.tot, L: st.totL, N: st.totN })
  s1.nextRow(22)
  const ws1 = s1.fin([5, 14, 13, 11, 11, 14])

  // ── Hoja 2: resumen semanal ──
  const s2 = crearHoja(XLSX, 4)
  s2.title(`HORAS POR SEMANA — ${w.nombre.toUpperCase()}`)
  s2.sep()
  s2.secHdr('  DESGLOSE SEMANAL')
  ;['Sem.', 'Período\n(lunes a domingo)', 'Días\ntrabajados', 'Horas\ntrabajadas'].forEach((h, c) => s2.sc(s2.r, c, h, st.tbHdr))
  s2.nextRow(40)
  semanas.forEach((wk, i) => {
    const f = i % 2 === 0 ? C.WHITE : C.ALT
    const [ini, fin] = rangoSemana(wk)
    s2.sc(s2.r, 0, i + 1, stC(f))
    s2.sc(s2.r, 1, `${ini} – ${fin}`, stL(f))
    s2.sc(s2.r, 2, porSemana[wk].recs.length, stC(f))
    s2.sc(s2.r, 3, r1(porSemana[wk].horas), stR(f))
    s2.nextRow(18)
  })
  s2.sc(s2.r, 0, '', st.tot); s2.sc(s2.r, 1, 'TOTAL', st.totL)
  s2.sc(s2.r, 2, registros.length, st.tot)
  s2.sc(s2.r, 3, r1(horasTot), st.totN)
  s2.nextRow(20)
  const ws2 = s2.fin([6, 22, 13, 14])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Asistencia por Semana')
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen Semanal')
  const archivo = w.nombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
  XLSX.writeFile(wb, `ficha_${archivo}_${desde}_${hasta}.xlsx`)
}

// ── Reporte general de todo el personal ───────────────────────────────────────
export const exportarPersonal = async ({ trabajadores, asistencia, desde, hasta, empresa }) => {
  const XLSX = await cargarXLSX()
  const filtradas = asistencia.filter((a) => enRango(a, desde, hasta))
  const periodo = `${desde} al ${hasta}`

  const stats = new Map(trabajadores.map((w) => [w.id, {
    w, dias: 0, horas: 0, sinSalida: 0, porSemana: {},
  }]))
  filtradas.forEach((a) => {
    const s = stats.get(a.trabajador_id)
    if (!s) return
    const hrs = calcHrsEfectivas(a)
    const wk = mondayOf(toDateStr(a.fecha))
    s.dias++; s.horas += hrs
    s.porSemana[wk] = (s.porSemana[wk] || 0) + hrs
    if (!a.hora_salida) s.sinSalida++
  })

  const semanas = [...new Set(filtradas.map((a) => mondayOf(toDateStr(a.fecha))))].sort()
  const numSemanas = semanas.length || 1
  const todos = [...stats.values()].sort((a, b) => a.w.nombre.localeCompare(b.w.nombre))
  const totDias = todos.reduce((t, s) => t + s.dias, 0)
  const totHoras = todos.reduce((t, s) => t + s.horas, 0)
  const totSinSalida = todos.reduce((t, s) => t + s.sinSalida, 0)

  // ── Hoja 1: resumen por trabajador ──
  const NC1 = 10, MID = 5
  const s1 = crearHoja(XLSX, NC1)
  const kpiValB = { ...st.kpiVal, font: font(true, C.DARK, 11) }
  s1.title(`REPORTE DE ASISTENCIA DEL PERSONAL — ${periodo}`)
  s1.sep()
  ;[
    ['Empresa:', empresa, 'Período:', periodo],
    ['Total trabajadores:', String(trabajadores.length), 'Fecha de generación:', ahora()],
    ['Días con registro:', String(totDias), 'Total horas trabajadas:', `${totHoras.toFixed(1)} h`],
    ['Días sin salida reg.:', String(totSinSalida), '', ''],
  ].forEach(([ll, lv, rl, rv]) => {
    s1.sc(s1.r, 0, ll, st.kpiLbl); s1.sc(s1.r, 1, '', st.kpiLbl); s1.merge(s1.r, 0, s1.r, 1)
    s1.sc(s1.r, 2, lv, kpiValB); for (let c = 3; c < MID; c++) s1.sc(s1.r, c, '', kpiValB); s1.merge(s1.r, 2, s1.r, MID - 1)
    s1.sc(s1.r, MID, rl, st.kpiLbl); s1.sc(s1.r, MID + 1, '', st.kpiLbl); s1.merge(s1.r, MID, s1.r, MID + 1)
    s1.sc(s1.r, MID + 2, rv, kpiValB); for (let c = MID + 3; c < NC1; c++) s1.sc(s1.r, c, '', kpiValB); s1.merge(s1.r, MID + 2, s1.r, NC1 - 1)
    s1.nextRow(21)
  })
  s1.sep()

  s1.secHdr('  RESUMEN POR TRABAJADOR')
  ;['N°', 'Nombre', 'Cargo', 'Estado', 'Horario\nLun–Vie', 'H. prog.\n(semanal)', 'Días\nreg.', 'Horas\ntotales', 'Prom. h.\n/semana', 'Días sin\nsalida']
    .forEach((h, c) => s1.sc(s1.r, c, h, st.tbHdr))
  s1.nextRow(40)
  todos.forEach(({ w, dias, horas, sinSalida }, i) => {
    const f = i % 2 === 0 ? C.WHITE : C.ALT
    const prog = horasProgSemana(w)
    s1.sc(s1.r, 0, i + 1, stC(f))
    s1.sc(s1.r, 1, w.nombre, stL(f))
    s1.sc(s1.r, 2, w.cargo || '—', stC(f))
    s1.sc(s1.r, 3, w.activo ? 'Activo' : 'Inactivo', w.activo ? st.green : stC(f))
    s1.sc(s1.r, 4, w.hora_ingreso ? `${hhmm(w.hora_ingreso)}–${hhmm(w.hora_salida)}` : '—', stC(f))
    s1.sc(s1.r, 5, prog ?? '—', stC(f))
    s1.sc(s1.r, 6, dias, stC(f))
    s1.sc(s1.r, 7, r1(horas), stR(f))
    s1.sc(s1.r, 8, r1(horas / numSemanas), stR(f))
    s1.sc(s1.r, 9, sinSalida, sinSalida > 0 ? st.amber : stC(f))
    s1.nextRow(18)
  })
  s1.sc(s1.r, 0, '', st.tot); s1.sc(s1.r, 1, 'TOTAL', st.totL)
  for (let c = 2; c <= 5; c++) s1.sc(s1.r, c, '', st.tot)
  s1.sc(s1.r, 6, totDias, st.tot)
  s1.sc(s1.r, 7, r1(totHoras), st.totN)
  s1.sc(s1.r, 8, r1(totHoras / numSemanas), st.totN)
  s1.sc(s1.r, 9, totSinSalida, st.tot)
  s1.nextRow(20)
  const ws1 = s1.fin([5, 26, 18, 10, 16, 11, 8, 12, 12, 11])

  // ── Hoja 2: detalle diario ──
  const NC2 = 8
  const s2 = crearHoja(XLSX, NC2)
  s2.title(`DETALLE DE ASISTENCIA — ${periodo}`)
  s2.sep()
  s2.secHdr('  REGISTRO DIARIO')
  ;['N°', 'Fecha', 'Día', 'Trabajador', 'Cargo', 'H. Entrada', 'H. Salida', 'Horas\ntrabajadas'].forEach((h, c) => s2.sc(s2.r, c, h, st.tbHdr))
  s2.nextRow(36)
  const detalle = [...filtradas].sort((a, b) => porFecha(a, b) || a.trabajador_nombre.localeCompare(b.trabajador_nombre))
  let totDet = 0
  detalle.forEach((a, i) => {
    const f = i % 2 === 0 ? C.WHITE : C.ALT
    const fecha = toDateStr(a.fecha)
    const hrs = calcHrsEfectivas(a)
    totDet += hrs
    s2.sc(s2.r, 0, i + 1, stC(f))
    s2.sc(s2.r, 1, fecha, stC(f))
    s2.sc(s2.r, 2, DIAS_ES[diaSemana(fecha)], stC(f))
    s2.sc(s2.r, 3, a.trabajador_nombre, stL(f))
    s2.sc(s2.r, 4, a.trabajador_cargo || '—', stC(f))
    s2.sc(s2.r, 5, hhmm(a.hora_entrada), stC(f))
    s2.sc(s2.r, 6, hhmm(a.hora_salida), stC(f))
    s2.sc(s2.r, 7, r2(hrs), stR(f))
    s2.nextRow(18)
  })
  for (let c = 0; c < NC2; c++) {
    if (c === 3) s2.sc(s2.r, c, `TOTAL  (${detalle.length} registros)`, st.totL)
    else if (c === 7) s2.sc(s2.r, c, r1(totDet), st.totN)
    else s2.sc(s2.r, c, '', st.tot)
  }
  s2.nextRow(20)
  const ws2 = s2.fin([5, 13, 12, 26, 16, 11, 11, 14])

  // ── Hoja 3: matriz trabajador × semana ──
  const NC3 = semanas.length + 3
  const s3 = crearHoja(XLSX, NC3)
  s3.title(`HORAS TRABAJADAS POR SEMANA — ${periodo}`)
  s3.sep()
  s3.secHdr('  HORAS POR TRABAJADOR Y SEMANA')
  s3.sc(s3.r, 0, 'Nombre', st.tbHdr)
  s3.sc(s3.r, 1, 'Cargo', st.tbHdr)
  semanas.forEach((wk, i) => { const [ini, fin] = rangoSemana(wk); s3.sc(s3.r, 2 + i, `Sem ${i + 1}\n(${ini}–${fin})`, st.tbHdr) })
  s3.sc(s3.r, NC3 - 1, 'Total\nhoras', st.tbHdr)
  s3.nextRow(40)
  const totSemana = Object.fromEntries(semanas.map((wk) => [wk, 0]))
  todos.filter((s) => s.dias > 0).forEach(({ w, horas, porSemana }, i) => {
    const f = i % 2 === 0 ? C.WHITE : C.ALT
    s3.sc(s3.r, 0, w.nombre, stL(f))
    s3.sc(s3.r, 1, w.cargo || '—', stC(f))
    semanas.forEach((wk, wi) => {
      const hrs = r1(porSemana[wk] || 0)
      totSemana[wk] += hrs
      s3.sc(s3.r, 2 + wi, hrs || '', hrs > 0 ? stR(f) : stC(f))
    })
    s3.sc(s3.r, NC3 - 1, r1(horas), stR(f))
    s3.nextRow(18)
  })
  s3.sc(s3.r, 0, 'TOTAL', st.totL)
  s3.sc(s3.r, 1, '', st.tot)
  semanas.forEach((wk, wi) => s3.sc(s3.r, 2 + wi, r1(totSemana[wk]), st.totN))
  s3.sc(s3.r, NC3 - 1, r1(totHoras), st.totN)
  s3.nextRow(20)
  const ws3 = s3.fin([28, 16, ...semanas.map(() => 14), 12])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Personal')
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle Asistencia')
  XLSX.utils.book_append_sheet(wb, ws3, 'Horas por Semana')
  XLSX.writeFile(wb, `personal_asistencia_${desde}_${hasta}.xlsx`)
}
