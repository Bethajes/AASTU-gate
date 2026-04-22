/**
 * Seed script — creates default ADMIN and GUARD accounts.
 * Run once: node src/seed.js
 */

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import pool from './lib/db.js'

const accounts = [
  {
    name: 'System Admin',
    email: 'admin@aastu.edu',
    password: 'Admin@1234',
    role: 'ADMIN',
  },
  {
    name: 'Gate Guard',
    email: 'guard@aastu.edu',
    password: 'Guard@1234',
    role: 'GUARD',
  },
]

async function seed() {
  for (const account of accounts) {
    const existing = await pool.query(`SELECT id FROM "User" WHERE email = $1`, [account.email])
    if (existing.rows.length) {
      console.log(`⚠️  ${account.role} account already exists: ${account.email}`)
      continue
    }
    const hashed = await bcrypt.hash(account.password, 10)
    await pool.query(
      `INSERT INTO "User" (id, name, email, password, role, "isVerified", "studentId")
       VALUES ($1, $2, $3, $4, $5::"Role", true, NULL)`,
      [crypto.randomUUID(), account.name, account.email, hashed, account.role]
    )
    console.log(`✅  Created ${account.role}: ${account.email} / ${account.password}`)
  }
  await pool.end()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
