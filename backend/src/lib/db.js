import dotenv from 'dotenv'
import pkg from 'pg'
const { Pool } = pkg

// Ensure env vars are loaded before creating the Pool.
dotenv.config()

function isLocalDatabase(url) {
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

const connectionString = process.env.DATABASE_URL
const needsSsl = connectionString && !isLocalDatabase(connectionString)

const pool = connectionString
  ? new Pool({
      connectionString,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'aastu_gate',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    })

export default pool