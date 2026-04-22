import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../lib/db.js'
import crypto from 'crypto'
import { isInstitutionalEmail } from '../lib/authUtils.js'

const JWT_SECRET = process.env.JWT_SECRET || 'aastusecretkey123'

const isUndefinedTable = (err) =>
  err && (err.code === '42P01' || /relation .* does not exist/i.test(err.message || ''))

async function findUserByEmail(email) {
  try {
    const r = await pool.query(`SELECT * FROM "User" WHERE "email" = $1`, [email])
    return r.rows[0] || null
  } catch (err) {
    if (!isUndefinedTable(err)) throw err
  }
  const r2 = await pool.query(`SELECT * FROM users WHERE email = $1`, [email])
  return r2.rows[0] || null
}

export const register = async (req, res) => {
  const { name, email, password, studentId, role } = req.body
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' })
    }

    const assignedRole = role || 'STUDENT'
    const isPrivilegedRole = assignedRole === 'ADMIN' || assignedRole === 'GUARD'

    if (!isPrivilegedRole && !isInstitutionalEmail(email)) {
      return res.status(400).json({ message: 'Only AASTU institutional emails are allowed (e.g. firstname.fathername@aastustudent.edu.et)' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const id = crypto.randomUUID()

    const result = await pool.query(
      `INSERT INTO "User" ("id", "name", "email", "password", "studentId", "role", "isVerified", "verificationCode", "verificationCodeExpiry")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING "id", "name", "email", "role"`,
      [id, name, email, hashed, studentId || null, assignedRole, true, null, null]
    )

    return res.status(201).json({
      message: 'Account created successfully. You can now log in.',
      user: result.rows[0]
    })
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'User_email_key') {
        return res.status(409).json({ message: 'An account with this email already exists.' })
      }
      if (err.constraint === 'User_studentId_key') {
        return res.status(409).json({ message: 'An account with this student ID already exists.' })
      }
    }
    console.error('REGISTER ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const login = async (req, res) => {
  const { email, password } = req.body
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await findUserByEmail(email)
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' })

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } })
  } catch (err) {
    console.error('LOGIN ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const forgotPassword = async (req, res) => {
  const { email, newPassword } = req.body
  try {
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }
    if (!isInstitutionalEmail(email)) {
      return res.status(400).json({ message: 'Only AASTU institutional emails are allowed' })
    }

    const user = await findUserByEmail(email)
    if (!user) return res.status(404).json({ message: 'No account found with that email' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await pool.query(
      `UPDATE "User" SET "password" = $1 WHERE "email" = $2`,
      [hashed, email]
    )

    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}
