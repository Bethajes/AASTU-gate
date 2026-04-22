import dotenv from 'dotenv'
import pkg from 'pg'
const { Pool } = pkg

// Ensure env vars are loaded before creating the Pool.
dotenv.config()

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'aastu_gate',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    })

export default pool