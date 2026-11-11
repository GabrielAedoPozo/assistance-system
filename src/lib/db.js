import mysql from 'mysql2/promise'
import { DATABASE_URL } from 'astro:env/server'

const pool = mysql.createPool({
  uri: DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 5,
  // Cierra las conexiones ociosas tras 1 min (deja como máximo 1 abierta)
  maxIdle: 1,
  idleTimeout: 60000,
  // DATE y TIME llegan como texto ('2026-11-11', '08:05:00'): sin conversiones de zona horaria
  dateStrings: true,
})

const crearTablas = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trabajadores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      cargo VARCHAR(100) NOT NULL DEFAULT '',
      qr_token VARCHAR(64) NOT NULL UNIQUE,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      hora_ingreso TIME NULL,
      hora_salida TIME NULL,
      trabaja_sabado TINYINT(1) NOT NULL DEFAULT 0,
      hora_ingreso_sabado TIME NULL,
      hora_salida_sabado TIME NULL,
      trabaja_domingo TINYINT(1) NOT NULL DEFAULT 0,
      hora_ingreso_domingo TIME NULL,
      hora_salida_domingo TIME NULL,
      excepciones_horario JSON NULL,
      receso_hora_inicio TIME NULL,
      receso_hora_fin TIME NULL,
      receso_hora_inicio_sabado TIME NULL,
      receso_hora_fin_sabado TIME NULL,
      receso_hora_inicio_domingo TIME NULL,
      receso_hora_fin_domingo TIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  // Un solo registro por trabajador y día: evita entradas dobles aunque escaneen dos veces a la vez
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asistencia (
      id INT AUTO_INCREMENT PRIMARY KEY,
      trabajador_id INT NOT NULL,
      fecha DATE NOT NULL,
      hora_entrada TIME NULL,
      hora_salida TIME NULL,
      horas_trabajadas DECIMAL(5,2) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_asistencia_dia (trabajador_id, fecha),
      KEY idx_asistencia_fecha (fecha),
      FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE
    )
  `)
}

// Las tablas se crean solas en la primera consulta; si falla (DB caída) se reintenta en la siguiente
let listo
const asegurarTablas = () => (listo ??= crearTablas().catch((e) => { listo = undefined; throw e }))

export const query = async (sql, params) => {
  await asegurarTablas()
  const [rows] = await pool.query(sql, params)
  return rows
}
