import { useState } from 'react'
import QRScanner from './QRScanner.jsx'
import { api, hhmm, fmtHoras } from './formato.js'

const ESTADO_BADGE = {
  sin_registro: { label: 'Sin registro hoy', cls: 'bg-slate-100 text-slate-600' },
  entrada: { label: 'Entrada registrada', cls: 'bg-emerald-100 text-emerald-700' },
  completo: { label: 'Jornada completa', cls: 'bg-blue-100 text-blue-700' },
}

// Pantalla del punto de marcación (tablet o celular en la entrada)
export default function Ingreso() {
  const [phase, setPhase] = useState('scan')
  const [scanKey, setScanKey] = useState(0)
  const [qrToken, setQrToken] = useState(null)
  const [trabajador, setTrabajador] = useState(null)
  const [asistencia, setAsistencia] = useState(null)
  const [estado, setEstado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const reset = () => {
    setPhase('scan'); setQrToken(null); setTrabajador(null); setAsistencia(null)
    setEstado(null); setMsg(null); setErr(null)
    setScanKey((k) => k + 1)
  }

  const handleScan = async (token) => {
    setLoading(true); setErr(null)
    try {
      const data = await api('/api/scan', { method: 'POST', body: JSON.stringify({ qrToken: token }) })
      setQrToken(token)
      setTrabajador(data.trabajador); setAsistencia(data.asistencia)
      setEstado(data.estado); setPhase('confirm')
    } catch (e) {
      setErr({ titulo: 'QR no válido', mensaje: e.message }); setPhase('error')
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrar = async () => {
    setLoading(true); setErr(null)
    const tipo = estado === 'sin_registro' ? 'entrada' : 'salida'
    try {
      const data = await api('/api/marcar', { method: 'POST', body: JSON.stringify({ qrToken, tipo }) })
      setMsg(tipo === 'entrada'
        ? `Entrada registrada: ${hhmm(data.asistencia.hora_entrada)}`
        : `Salida registrada: ${hhmm(data.asistencia.hora_salida)} — ${fmtHoras(data.asistencia.horas_trabajadas)}`)
      setAsistencia(data.asistencia); setPhase('done')
    } catch (e) {
      setErr({ titulo: 'No se pudo registrar', mensaje: e.message }); setPhase('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">Registro de Asistencia</h2>
        <p className="text-sm text-slate-500 mt-1">Escanea tu código QR</p>
      </div>

      {phase === 'scan' && <QRScanner key={scanKey} onScan={handleScan} />}
      {loading && phase === 'scan' && <p className="text-sm text-blue-600 animate-pulse">Verificando QR…</p>}

      {phase === 'confirm' && trabajador && (
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
          <div className="bg-blue-700 px-5 py-4 text-white">
            <p className="font-bold text-lg">{trabajador.nombre}</p>
            <p className="text-sm text-blue-200">{trabajador.cargo || 'Sin cargo'}</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ESTADO_BADGE[estado]?.cls}`}>
              {ESTADO_BADGE[estado]?.label}
            </span>
            {asistencia?.hora_entrada && (
              <p className="text-sm text-slate-600">
                Entrada: <span className="font-semibold">{hhmm(asistencia.hora_entrada)}</span>
                {asistencia.hora_salida && <> — Salida: <span className="font-semibold">{hhmm(asistencia.hora_salida)}</span></>}
              </p>
            )}
            {estado === 'completo' ? (
              <>
                <p className="text-sm text-slate-500 italic">Jornada ya completada hoy.</p>
                <button onClick={reset} className="w-full h-10 text-sm text-slate-500 hover:text-slate-700 underline">
                  Volver
                </button>
              </>
            ) : (
              // Confirmación antes de marcar: evita marcas dobles o por un escaneo accidental
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center space-y-3">
                <p className="text-base font-bold text-slate-800">
                  ¿Estás seguro de marcar tu {estado === 'sin_registro' ? 'ingreso' : 'salida'}?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={reset} disabled={loading}
                    className="h-11 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50">
                    No, cancelar
                  </button>
                  <button onClick={handleRegistrar} disabled={loading}
                    className="h-11 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold transition-colors disabled:opacity-50">
                    {loading ? 'Registrando…' : 'Sí, marcar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-emerald-200 overflow-hidden">
          <div className="bg-emerald-600 px-5 py-4 text-white text-center">
            <i className="fa-solid fa-circle-check text-3xl mb-1" />
            <p className="font-bold text-lg mt-1">{trabajador?.nombre}</p>
          </div>
          <div className="px-5 py-4 text-center space-y-3">
            <p className="text-emerald-700 font-semibold">{msg}</p>
            <button onClick={reset}
              className="w-full h-11 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl transition-colors">
              Escanear siguiente
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-red-200 overflow-hidden">
          <div className="bg-red-600 px-5 py-4 text-white text-center">
            <i className="fa-solid fa-circle-xmark text-3xl" />
            <p className="font-bold mt-1">{err?.titulo}</p>
          </div>
          <div className="px-5 py-4 text-center space-y-3">
            <p className="text-sm text-red-600">{err?.mensaje}</p>
            <button onClick={reset}
              className="w-full h-11 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl transition-colors">
              Volver a escanear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
