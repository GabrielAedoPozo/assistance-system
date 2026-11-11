import { useEffect, useState } from 'react'
import {
  api, hhmm, toDateStr, fmtFecha, fmtHoras, hoyLocal, inicioMes, mondayOf,
  calcTardanzaMin, esTarde, getRecesoEfectivo, calcHrsEfectivas, getExcepciones, DESCUENTO_TARDANZA_H,
} from './formato.js'
import { exportarTrabajador, exportarPersonal } from './exportarExcel.js'

const EMPTY_FORM = {
  nombre: '', cargo: '',
  hora_ingreso: '', hora_salida: '',
  excepciones_horario: {},
  trabaja_sabado: false, hora_ingreso_sabado: '', hora_salida_sabado: '',
  trabaja_domingo: false, hora_ingreso_domingo: '', hora_salida_domingo: '',
  receso_hora_inicio: '', receso_hora_fin: '',
  receso_excepcion_sabado: false, receso_hora_inicio_sabado: '', receso_hora_fin_sabado: '',
  receso_excepcion_domingo: false, receso_hora_inicio_domingo: '', receso_hora_fin_domingo: '',
}

const DIAS_LV = { '1': 'Lunes', '2': 'Martes', '3': 'Miércoles', '4': 'Jueves', '5': 'Viernes' }

const inputCls = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function CampoHora({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type="time" value={value} onChange={onChange} className={inputCls} />
    </div>
  )
}

export default function Administrador({ autenticado, empresa }) {
  const [authed, setAuthed] = useState(autenticado)
  const [pwd, setPwd] = useState('')
  const [pwdErr, setPwdErr] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const [trabajadores, setTrabajadores] = useState([])
  const [asistencia, setAsistencia] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const [workerModal, setWorkerModal] = useState(null)
  const [workerForm, setWorkerForm] = useState(EMPTY_FORM)
  const [workerSaving, setWorkerSaving] = useState(false)
  const [workerErr, setWorkerErr] = useState(null)

  const [asistModal, setAsistModal] = useState(null)
  const [asistForm, setAsistForm] = useState({ hora_entrada: '', hora_salida: '' })
  const [asistSaving, setAsistSaving] = useState(false)
  const [asistErr, setAsistErr] = useState(null)

  const [qrWorker, setQrWorker] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [asistFilter, setAsistFilter] = useState('')
  const [selectedDays, setSelectedDays] = useState({})

  const [exportDesde, setExportDesde] = useState(inicioMes)
  const [exportHasta, setExportHasta] = useState(hoyLocal)
  const [exportando, setExportando] = useState(false)
  const [exportandoId, setExportandoId] = useState(null)

  // Se carga desde el inicio del mes (para el historial) o desde la fecha de exportación si es anterior
  const desdeCarga = exportDesde && exportDesde < inicioMes() ? exportDesde : inicioMes()

  // Llamada protegida: si la sesión venció, vuelve a pedir la contraseña
  const llamar = async (path, opts) => {
    try {
      return await api(path, opts)
    } catch (e) {
      if (e.status === 401) setAuthed(false)
      throw e
    }
  }

  const load = async () => {
    setLoading(true); setErr(null)
    try {
      const [tw, as] = await Promise.all([
        llamar('/api/trabajadores'),
        llamar(`/api/asistencia?desde=${desdeCarga}&hasta=${hoyLocal()}`),
      ])
      setTrabajadores(tw); setAsistencia(as)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (authed) load() }, [authed, desdeCarga])

  const handleLogin = async () => {
    setVerifying(true); setPwdErr(null)
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ clave: pwd }) })
      setPwd(''); setAuthed(true)
    } catch (e) { setPwdErr(e.message) }
    finally { setVerifying(false) }
  }

  const handleLogout = async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => {})
    setAuthed(false)
  }

  const setCampo = (k) => (e) => setWorkerForm((f) => ({ ...f, [k]: e.target.value }))
  const setCheck = (k) => (e) => setWorkerForm((f) => ({ ...f, [k]: e.target.checked }))

  const openCreate = () => {
    setWorkerForm(EMPTY_FORM)
    setWorkerErr(null); setWorkerModal({ mode: 'create' })
  }

  const openEdit = (w) => {
    const h = (t) => t?.slice(0, 5) || ''
    setWorkerForm({
      nombre: w.nombre, cargo: w.cargo || '',
      hora_ingreso: h(w.hora_ingreso), hora_salida: h(w.hora_salida),
      excepciones_horario: getExcepciones(w),
      trabaja_sabado: !!w.trabaja_sabado,
      hora_ingreso_sabado: h(w.hora_ingreso_sabado), hora_salida_sabado: h(w.hora_salida_sabado),
      trabaja_domingo: !!w.trabaja_domingo,
      hora_ingreso_domingo: h(w.hora_ingreso_domingo), hora_salida_domingo: h(w.hora_salida_domingo),
      receso_hora_inicio: h(w.receso_hora_inicio), receso_hora_fin: h(w.receso_hora_fin),
      receso_excepcion_sabado: !!w.receso_hora_inicio_sabado,
      receso_hora_inicio_sabado: h(w.receso_hora_inicio_sabado), receso_hora_fin_sabado: h(w.receso_hora_fin_sabado),
      receso_excepcion_domingo: !!w.receso_hora_inicio_domingo,
      receso_hora_inicio_domingo: h(w.receso_hora_inicio_domingo), receso_hora_fin_domingo: h(w.receso_hora_fin_domingo),
    })
    setWorkerErr(null); setWorkerModal({ mode: 'edit', worker: w })
  }

  const saveWorker = async () => {
    const f = workerForm
    if (!f.nombre.trim()) { setWorkerErr('El nombre es requerido'); return }
    setWorkerSaving(true); setWorkerErr(null)
    const recesoSab = f.trabaja_sabado && f.receso_excepcion_sabado
    const recesoDom = f.trabaja_domingo && f.receso_excepcion_domingo
    const payload = {
      nombre: f.nombre.trim(),
      cargo: f.cargo.trim(),
      hora_ingreso: f.hora_ingreso || null,
      hora_salida: f.hora_salida || null,
      excepciones_horario: Object.keys(f.excepciones_horario).length ? f.excepciones_horario : null,
      trabaja_sabado: f.trabaja_sabado,
      hora_ingreso_sabado: f.trabaja_sabado ? (f.hora_ingreso_sabado || null) : null,
      hora_salida_sabado: f.trabaja_sabado ? (f.hora_salida_sabado || null) : null,
      trabaja_domingo: f.trabaja_domingo,
      hora_ingreso_domingo: f.trabaja_domingo ? (f.hora_ingreso_domingo || null) : null,
      hora_salida_domingo: f.trabaja_domingo ? (f.hora_salida_domingo || null) : null,
      receso_hora_inicio: f.receso_hora_inicio || null,
      receso_hora_fin: f.receso_hora_fin || null,
      receso_hora_inicio_sabado: recesoSab ? (f.receso_hora_inicio_sabado || null) : null,
      receso_hora_fin_sabado: recesoSab ? (f.receso_hora_fin_sabado || null) : null,
      receso_hora_inicio_domingo: recesoDom ? (f.receso_hora_inicio_domingo || null) : null,
      receso_hora_fin_domingo: recesoDom ? (f.receso_hora_fin_domingo || null) : null,
    }
    try {
      if (workerModal.mode === 'create') {
        await llamar('/api/trabajadores', { method: 'POST', body: JSON.stringify(payload) })
      } else {
        await llamar(`/api/trabajadores/${workerModal.worker.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      }
      setWorkerModal(null); load()
    } catch (e) { setWorkerErr(e.message) }
    finally { setWorkerSaving(false) }
  }

  const toggleActivo = async (w) => {
    try {
      await llamar(`/api/trabajadores/${w.id}`, { method: 'PATCH', body: JSON.stringify({ activo: !w.activo }) })
      load()
    } catch (e) { setErr(e.message) }
  }

  const openAsistEdit = (rec) => {
    setAsistForm({ hora_entrada: rec.hora_entrada?.slice(0, 5) || '', hora_salida: rec.hora_salida?.slice(0, 5) || '' })
    setAsistErr(null); setAsistModal({ record: rec })
  }

  const saveAsist = async () => {
    setAsistSaving(true); setAsistErr(null)
    try {
      await llamar(`/api/asistencia/${asistModal.record.id}`, { method: 'PUT', body: JSON.stringify(asistForm) })
      setAsistModal(null); load()
    } catch (e) { setAsistErr(e.message) }
    finally { setAsistSaving(false) }
  }

  const deleteAsist = async (id) => {
    if (!confirm('¿Eliminar este registro de asistencia?')) return
    try { await llamar(`/api/asistencia/${id}`, { method: 'DELETE' }); load() }
    catch (e) { setErr(e.message) }
  }

  const showQr = async (w) => {
    setQrWorker(w); setQrDataUrl(null)
    try {
      const { default: QRCode } = await import('qrcode')
      setQrDataUrl(await QRCode.toDataURL(w.qr_token, { width: 300, margin: 2 }))
    } catch { setQrDataUrl('error') }
  }

  const printQr = () => {
    if (!qrDataUrl || qrDataUrl === 'error') return
    const win = window.open('', '_blank', 'width=400,height=500')
    win.document.write(`<!DOCTYPE html><html><head><title>QR - ${escHtml(qrWorker.nombre)}</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;}
      h2{font-size:1.2rem;margin-bottom:.5rem;} p{margin:0;color:#666;font-size:.9rem;}</style></head>
      <body><h2>${escHtml(qrWorker.nombre)}</h2><p>${escHtml(qrWorker.cargo)}</p>
      <img src="${qrDataUrl}" style="width:260px;margin-top:12px;" /><script>window.onload=()=>window.print();</script></body></html>`)
    win.document.close()
  }

  const handleExportarTrabajador = async (w) => {
    if (exportandoId !== null) return
    setExportandoId(w.id)
    try { await exportarTrabajador({ trabajador: w, asistencia, desde: exportDesde, hasta: exportHasta }) }
    catch (e) { setErr('No se pudo generar el Excel: ' + e.message) }
    finally { setExportandoId(null) }
  }

  const handleExportarPersonal = async () => {
    if (exportando) return
    setExportando(true)
    try { await exportarPersonal({ trabajadores, asistencia, desde: exportDesde, hasta: exportHasta, empresa }) }
    catch (e) { setErr('No se pudo generar el Excel: ' + e.message) }
    finally { setExportando(false) }
  }

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <div className="w-full max-w-xs bg-white rounded-2xl shadow border border-slate-200 p-6 space-y-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-lock text-blue-700 text-xl" />
            </div>
            <h3 className="font-bold text-slate-800">Acceso Administrador</h3>
            <p className="text-xs text-slate-500 mt-1">Ingresa la contraseña para continuar</p>
          </div>
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Contraseña" autoFocus
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {pwdErr && <p className="text-xs text-red-500 text-center">{pwdErr}</p>}
          <button onClick={handleLogin} disabled={verifying}
            className="w-full h-11 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl transition-colors">
            {verifying ? 'Verificando…' : 'Ingresar'}
          </button>
        </div>
      </div>
    )
  }

  const enPeriodo = asistencia.filter((a) => { const f = toDateStr(a.fecha); return f >= exportDesde && f <= exportHasta }).length

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-red-600 transition-colors">
          <i className="fa-solid fa-right-from-bracket mr-1.5" />Cerrar sesión
        </button>
      </div>

      {err && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{err}</div>}

      {/* ── Exportar reportes ─── */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-file-excel text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Exportar Reportes</h3>
            <p className="text-xs text-slate-500">Selecciona el período y descarga el reporte</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Desde</label>
            <input type="date" value={exportDesde} max={exportHasta} onChange={(e) => setExportDesde(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Hasta</label>
            <input type="date" value={exportHasta} min={exportDesde} max={hoyLocal()}
              onChange={(e) => setExportHasta(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Todo el personal</label>
            <button onClick={handleExportarPersonal} disabled={exportando || loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <i className="fa-solid fa-download" />
              {exportando ? 'Generando…' : 'Descargar Excel'}
            </button>
          </div>
          <p className="text-xs text-slate-400 self-end pb-2">{enPeriodo} registros en el período</p>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          <i className="fa-solid fa-circle-info mr-1.5 text-emerald-500" />
          Para exportar un solo trabajador, usa el ícono <i className="fa-solid fa-file-excel mx-0.5 text-emerald-600" /> en su tarjeta abajo
        </p>
      </div>

      {/* ── Trabajadores ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Trabajadores</h3>
            <p className="text-xs text-slate-500">{trabajadores.length} registrado{trabajadores.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
            <i className="fa-solid fa-plus" /> Nuevo trabajador
          </button>
        </div>
        {loading && !trabajadores.length ? <p className="text-sm text-slate-400">Cargando…</p> : (
          <div className="space-y-2">
            {trabajadores.length === 0 && (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-200">
                <i className="fa-solid fa-users text-2xl mb-2 block" />
                Sin trabajadores registrados
              </div>
            )}
            {trabajadores.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3.5 flex items-center gap-3 hover:border-slate-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                  {w.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{w.nombre}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {w.cargo || 'Sin cargo'}
                    {w.hora_ingreso ? ` · ${hhmm(w.hora_ingreso)}–${hhmm(w.hora_salida)}` : ''}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${w.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {w.activo ? 'Activo' : 'Inactivo'}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => handleExportarTrabajador(w)} title="Exportar Excel individual"
                    disabled={exportandoId === w.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition-colors">
                    {exportandoId === w.id
                      ? <i className="fa-solid fa-spinner fa-spin text-xs" />
                      : <i className="fa-solid fa-file-excel text-xs" />}
                  </button>
                  <button onClick={() => showQr(w)} title="Ver QR"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <i className="fa-solid fa-qrcode text-xs" />
                  </button>
                  <button onClick={() => openEdit(w)} title="Editar"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                    <i className="fa-solid fa-pen text-xs" />
                  </button>
                  <button onClick={() => toggleActivo(w)} title={w.activo ? 'Desactivar' : 'Activar'}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
                    <i className={`fa-solid text-xl ${w.activo ? 'fa-toggle-on text-emerald-500 hover:text-red-400' : 'fa-toggle-off text-slate-300 hover:text-emerald-500'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Historial de asistencia ─── */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Historial de Asistencia</h3>
            <p className="text-xs text-slate-500">Mes actual · registro por trabajador y día</p>
          </div>
          <input type="text" value={asistFilter} onChange={(e) => setAsistFilter(e.target.value)}
            placeholder="Buscar trabajador…"
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
        </div>
        {loading && !asistencia.length ? <p className="text-sm text-slate-400">Cargando…</p> : (() => {
          const mesActual = inicioMes().slice(0, 7)
          const grupos = new Map()
          asistencia.forEach((a) => {
            if (!toDateStr(a.fecha).startsWith(mesActual)) return
            if (!grupos.has(a.trabajador_id)) grupos.set(a.trabajador_id, { nombre: a.trabajador_nombre, recs: [] })
            grupos.get(a.trabajador_id).recs.push(a)
          })
          const lista = [...grupos.entries()]
            .filter(([, g]) => !asistFilter || g.nombre.toLowerCase().includes(asistFilter.toLowerCase()))
            .sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre))
          if (lista.length === 0)
            return <p className="text-sm text-slate-400 py-6 text-center">Sin registros</p>

          return (
            <div className="space-y-3">
              {lista.map(([id, { nombre, recs }]) => {
                recs.sort((a, b) => toDateStr(b.fecha).localeCompare(toDateStr(a.fecha)))
                const selFecha = selectedDays[id] ?? toDateStr(recs[0]?.fecha)
                const sel = recs.find((r) => toDateStr(r.fecha) === selFecha)

                const semanas = {}
                recs.forEach((r) => { (semanas[mondayOf(toDateStr(r.fecha))] ??= []).push(r) })
                const semanaKeys = Object.keys(semanas).sort().reverse()
                const totalHrs = recs.reduce((sum, r) => sum + calcHrsEfectivas(r), 0)

                return (
                  <div key={id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Cabecera del trabajador */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                        {nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-800 text-sm flex-1">{nombre}</span>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-700">{fmtHoras(Math.round(totalHrs * 10) / 10)}</p>
                        <p className="text-xs text-slate-400">{recs.length} día{recs.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {/* Chips agrupados por semana */}
                    <div className="px-4 pt-3 pb-2 space-y-2.5">
                      {semanaKeys.map((wk, wi) => (
                        <div key={wk}>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                            Semana {semanaKeys.length - wi}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {semanas[wk].map((r) => {
                              const iso = toDateStr(r.fecha)
                              const chip = new Date(iso + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' })
                              const active = selFecha === iso
                              return (
                                <button key={iso}
                                  onClick={() => setSelectedDays((prev) => ({ ...prev, [id]: iso }))}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                    active
                                      ? 'bg-blue-700 text-white shadow-sm'
                                      : !r.hora_salida
                                        ? 'bg-slate-100 text-slate-500 border border-amber-300 hover:bg-amber-50'
                                        : esTarde(r)
                                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >{chip}</button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Detalle del día seleccionado */}
                    {sel && (
                      <div className="px-4 pb-4">
                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{fmtFecha(sel.fecha)}</p>
                            <div className="flex gap-1">
                              <button onClick={() => openAsistEdit(sel)} title="Editar"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                                <i className="fa-solid fa-pen text-xs" />
                              </button>
                              <button onClick={() => deleteAsist(sel.id)} title="Eliminar"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <i className="fa-solid fa-trash text-xs" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white rounded-xl p-2.5 border border-slate-100">
                              <p className="text-xs text-slate-400 mb-1">Entrada</p>
                              <p className="font-mono font-bold text-emerald-700 text-base leading-tight">{hhmm(sel.hora_entrada)}</p>
                              {sel.hora_entrada && (esTarde(sel)
                                ? <span className="text-xs text-amber-600 font-medium">Tarde ({calcTardanzaMin(sel)} min)</span>
                                : <span className="text-xs text-emerald-600 font-medium">Puntual</span>)}
                            </div>
                            <div className="bg-white rounded-xl p-2.5 border border-slate-100">
                              <p className="text-xs text-slate-400 mb-1">Salida</p>
                              <p className="font-mono font-bold text-red-600 text-base leading-tight">{hhmm(sel.hora_salida)}</p>
                              {!sel.hora_salida && <span className="text-xs text-amber-600 font-medium">Sin registro</span>}
                            </div>
                            <div className="bg-white rounded-xl p-2.5 border border-slate-100">
                              <p className="text-xs text-slate-400 mb-1">Horas</p>
                              <p className="font-bold text-slate-800 text-base leading-tight">
                                {fmtHoras(Math.round(calcHrsEfectivas(sel) * 10) / 10)}
                              </p>
                              {(() => {
                                const tarde = esTarde(sel)
                                const receso = sel.hora_entrada && sel.hora_salida && getRecesoEfectivo(sel)
                                if (tarde && receso) return <span className="text-xs text-amber-600">−{DESCUENTO_TARDANZA_H}h tard. + receso</span>
                                if (tarde) return <span className="text-xs text-amber-600">−{DESCUENTO_TARDANZA_H}h descuento</span>
                                if (receso) return <span className="text-xs text-slate-400">Receso desc.</span>
                                return null
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Modal: crear/editar trabajador */}
      {workerModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setWorkerModal(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 text-lg">
              {workerModal.mode === 'create' ? 'Nuevo Trabajador' : 'Editar Trabajador'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre *</label>
                <input value={workerForm.nombre} onChange={setCampo('nombre')} placeholder="Nombre completo" autoFocus className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo</label>
                <input value={workerForm.cargo} onChange={setCampo('cargo')} placeholder="Ej: Operario, Vigilante…" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Horario Lun–Vie</label>
                <div className="grid grid-cols-2 gap-3">
                  <CampoHora label="Hora ingreso" value={workerForm.hora_ingreso} onChange={setCampo('hora_ingreso')} />
                  <CampoHora label="Hora salida" value={workerForm.hora_salida} onChange={setCampo('hora_salida')} />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Excepciones por día</label>
                <div className="flex gap-1.5">
                  {[['1', 'L'], ['2', 'M'], ['3', 'X'], ['4', 'J'], ['5', 'V']].map(([d, lbl]) => {
                    const active = !!workerForm.excepciones_horario[d]
                    return (
                      <button type="button" key={d}
                        onClick={() => setWorkerForm((f) => {
                          const ex = { ...f.excepciones_horario }
                          if (active) delete ex[d]
                          else ex[d] = { hora_ingreso: f.hora_ingreso, hora_salida: f.hora_salida }
                          return { ...f, excepciones_horario: ex }
                        })}
                        className={`w-9 h-9 rounded-lg text-xs font-bold transition-colors ${active ? 'bg-blue-700 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >{lbl}</button>
                    )
                  })}
                </div>
                {Object.entries(workerForm.excepciones_horario).sort().map(([d, val]) => {
                  const setEx = (k) => (e) => setWorkerForm((f) => ({
                    ...f, excepciones_horario: { ...f.excepciones_horario, [d]: { ...f.excepciones_horario[d], [k]: e.target.value } },
                  }))
                  return (
                    <div key={d} className="grid grid-cols-2 gap-3 pt-1">
                      <CampoHora label={`${DIAS_LV[d]} — Ingreso`} value={val.hora_ingreso || ''} onChange={setEx('hora_ingreso')} />
                      <CampoHora label={`${DIAS_LV[d]} — Salida`} value={val.hora_salida || ''} onChange={setEx('hora_salida')} />
                    </div>
                  )
                })}
              </div>

              {[['sabado', 'sábado'], ['domingo', 'domingo']].map(([k, nombreDia]) => (
                <div key={k} className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={workerForm[`trabaja_${k}`]} onChange={setCheck(`trabaja_${k}`)}
                      className="w-4 h-4 accent-blue-600" />
                    <span className="text-xs font-semibold text-slate-600">¿Trabaja el {nombreDia}?</span>
                  </label>
                  {workerForm[`trabaja_${k}`] && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <CampoHora label="Hora ingreso" value={workerForm[`hora_ingreso_${k}`]} onChange={setCampo(`hora_ingreso_${k}`)} />
                      <CampoHora label="Hora salida" value={workerForm[`hora_salida_${k}`]} onChange={setCampo(`hora_salida_${k}`)} />
                    </div>
                  )}
                </div>
              ))}

              <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">
                  <i className="fa-solid fa-mug-hot mr-1.5" />
                  Receso / Almuerzo
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <CampoHora label="Inicio" value={workerForm.receso_hora_inicio} onChange={setCampo('receso_hora_inicio')} />
                  <CampoHora label="Fin" value={workerForm.receso_hora_fin} onChange={setCampo('receso_hora_fin')} />
                </div>
                {[['sabado', 'sábado', 'Sáb.'], ['domingo', 'domingo', 'Dom.']].map(([k, nombreDia, corto]) => workerForm[`trabaja_${k}`] && (
                  <div key={k} className="space-y-1.5 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={workerForm[`receso_excepcion_${k}`]} onChange={setCheck(`receso_excepcion_${k}`)}
                        className="w-3.5 h-3.5 accent-amber-500" />
                      <span className="text-xs text-amber-700">Receso diferente el {nombreDia}</span>
                    </label>
                    {workerForm[`receso_excepcion_${k}`] && (
                      <div className="grid grid-cols-2 gap-3 pt-0.5">
                        <CampoHora label={`${corto} Inicio`} value={workerForm[`receso_hora_inicio_${k}`]} onChange={setCampo(`receso_hora_inicio_${k}`)} />
                        <CampoHora label={`${corto} Fin`} value={workerForm[`receso_hora_fin_${k}`]} onChange={setCampo(`receso_hora_fin_${k}`)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {workerErr && <p className="text-xs text-red-500">{workerErr}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setWorkerModal(null)} className="flex-1 h-10 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={saveWorker} disabled={workerSaving}
                className="flex-1 h-10 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl text-sm transition-colors">
                {workerSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: editar asistencia */}
      {asistModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setAsistModal(null)}>
          <div className="w-full max-w-xs bg-white rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800">Editar Asistencia</h3>
            <p className="text-sm text-slate-500">{asistModal.record.trabajador_nombre} — {fmtFecha(asistModal.record.fecha)}</p>
            <div className="space-y-3">
              <CampoHora label="Hora entrada" value={asistForm.hora_entrada}
                onChange={(e) => setAsistForm((f) => ({ ...f, hora_entrada: e.target.value }))} />
              <CampoHora label="Hora salida" value={asistForm.hora_salida}
                onChange={(e) => setAsistForm((f) => ({ ...f, hora_salida: e.target.value }))} />
            </div>
            {asistErr && <p className="text-xs text-red-500">{asistErr}</p>}
            <div className="flex gap-3">
              <button onClick={() => setAsistModal(null)} className="flex-1 h-10 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={saveAsist} disabled={asistSaving}
                className="flex-1 h-10 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl text-sm transition-colors">
                {asistSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: QR */}
      {qrWorker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setQrWorker(null)}>
          <div className="w-full max-w-xs bg-white rounded-2xl shadow-2xl p-6 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 text-lg">{qrWorker.nombre}</h3>
            {qrWorker.cargo && <p className="text-sm text-slate-500 -mt-2">{qrWorker.cargo}</p>}
            {!qrDataUrl ? (
              <p className="text-sm text-slate-400 animate-pulse">Generando QR…</p>
            ) : qrDataUrl === 'error' ? (
              <p className="text-sm text-red-500">Error al generar QR</p>
            ) : (
              <img src={qrDataUrl} alt="QR" className="mx-auto w-56 h-56 rounded-xl" />
            )}
            <div className="flex gap-3">
              <button onClick={() => setQrWorker(null)} className="flex-1 h-10 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cerrar</button>
              <button onClick={printQr} disabled={!qrDataUrl || qrDataUrl === 'error'}
                className="flex-1 h-10 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl text-sm transition-colors">
                <i className="fa-solid fa-print mr-2" />Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
