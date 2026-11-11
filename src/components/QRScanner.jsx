import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

// Lee un QR con la cámara (trasera si existe) y llama a onScan(texto) una sola vez
export default function QRScanner({ onScan }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [camErr, setCamErr] = useState(null)
  const [active, setActive] = useState(false)

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const scan = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scan)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })
    if (code?.data) {
      stop()
      setActive(false)
      onScan(code.data)
      return
    }
    rafRef.current = requestAnimationFrame(scan)
  }, [onScan])

  useEffect(() => {
    let mounted = true
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamErr('Este navegador no permite usar la cámara. Abre la página con https://')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setActive(true)
        setCamErr(null)
        rafRef.current = requestAnimationFrame(scan)
      })
      .catch((e) => {
        if (mounted) setCamErr('No se pudo acceder a la cámara: ' + e.message)
      })
    return () => { mounted = false; stop() }
  }, [scan])

  if (camErr) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-sm max-w-xs text-center">
        {camErr}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-72 h-72 rounded-2xl overflow-hidden bg-black shadow-lg">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-44 h-44 border-4 border-blue-400 rounded-xl opacity-70 animate-pulse" />
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {active && <p className="text-sm text-slate-500 animate-pulse">Apunta la cámara al código QR</p>}
    </div>
  )
}
