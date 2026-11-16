/**
 * Seed / reset the default ADMIN and GUARD login accounts.
 *
 * Unlike the original seed script (which skips existing users), this script
 * always updates the password hash and role for the default accounts, so the
 * documented credentials are guaranteed to work.
 *
 * Run: npm run seed
 */

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import pool from './lib/db.js'

const accounts = [
  {
    name: 'System Admin',
    username: 'admin',
    email: 'admin@aastu.edu',
    password: 'Admin@1234',
    role: 'ADMIN',
  },
  {
    name: 'Gate Guard',
    username: 'guard',
    email: 'guard@aastu.edu',
    password: 'Guard@1234',
    role: 'GUARD',
  },
]

async function findExistingAccount(account) {
  const byEmail = await pool.query(
    `SELECT "id" FROM "User" WHERE LOWER("email") = LOWER($1) LIMIT 1`,
    [account.email]
  )
  if (byEmail.rows[0]) return byEmail.rows[0]

  const byUsername = await pool.query(
    `SELECT "id" FROM "User" WHERE LOWER("username") = LOWER($1) LIMIT 1`,
    [account.username]
  )
  return byUsername.rows[0] || null
}

async function seedAccount(account) {
  const hashed = await bcrypt.hash(account.password, 10)
  const existing = await findExistingAccount(account)

  if (existing) {
    await pool.query(
      `UPDATE "User"
       SET "name" = $1,
           "username" = $2,
           "email" = $3,
           "password" = $4,
           "role" = $5::"Role",
           "isVerified" = true
       WHERE "id" = $6`,
      [account.name, account.username, account.email, hashed, account.role, existing.id]
    )
    console.log(`♻️  Reset ${account.role}: ${account.username} / ${account.password}`)
  } else {
    await pool.query(
      `INSERT INTO "User" ("id", "name", "username", "email", "password", "role", "isVerified", "studentId")
       VALUES ($1, $2, $3, $4, $5, $6::"Role", true, NULL)`,
      [crypto.randomUUID(), account.name, account.username, account.email, hashed, account.role]
    )
    console.log(`✅ Created ${account.role}: ${account.username} / ${account.password}`)
  }

  // Confirm the stored hash really matches the documented password.
  const check = await pool.query(
    `SELECT "password" FROM "User" WHERE LOWER("username") = LOWER($1) LIMIT 1`,
    [account.username]
  )
  const passwordWorks =
    check.rows[0] && (await bcrypt.compare(account.password, check.rows[0].password))

  if (!passwordWorks) {
    throw new Error(`Password verification failed for ${account.username}`)
  }
}

async function seed() {
  try {
    for (const account of accounts) {
      await seedAccount(account)
    }

    console.log('\nDefault login credentials:')
    for (const account of accounts) {
      console.log(`  ${account.role.padEnd(5)}  ${account.username} / ${account.password}  (${account.email})`)
    }
  } finally {
    await pool.end()
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
