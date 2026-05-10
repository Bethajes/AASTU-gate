import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../lib/db.js'
import crypto from 'crypto'
import { isInstitutionalEmail, generateOTP, generateOTPExpiry, generateOtpToken, verifyOtpToken } from '../lib/authUtils.js'
import { sendVerificationEmail, sendOtpEmail } from '../lib/email.service.js'

const JWT_SECRET = process.env.JWT_SECRET || 'aastusecretkey123'

const isUndefinedTable = (err) =>
  err && (err.code === '42P01' || /relation .* does not exist/i.test(err.message || ''))

async function findUserByEmail(email) {
  const r = await pool.query(`SELECT * FROM "User" WHERE "email" = $1`, [email])
  return r.rows[0] || null
}

export const register = async (req, res) => {
  return res.status(410).json({ message: 'Manual student registration is no longer available. Please use the activation flow.' })
}

export const login = async (req, res) => {
  console.log('LOGIN body:', JSON.stringify(req.body), '| content-type:', req.headers?.['content-type'])
  const { email, password, username } = req.body
  try {
    // --- Username login path ---
    if (username !== undefined) {
      if (!username || String(username).trim() === '' || !password) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      const userResult = await pool.query(
        `SELECT u.*, s."isActivated" AS "isActivated"
         FROM "User" u
         LEFT JOIN "Student" s ON u."studentId" = s."id"
         WHERE u.username = $1 OR s.username = $1`,
        [username]
      )
      const user = userResult.rows[0]

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }
      if (user.role === 'STUDENT' && !user.isActivated) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) return res.status(401).json({ message: 'Invalid credentials' })

      const token = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      )
      return res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } })
    }

    // --- Email login path (GUARD / ADMIN, unchanged) ---
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

export const activateStudent = async (req, res) => {
  const { student_id } = req.body
  try {
    if (!student_id || String(student_id).trim() === '') {
      return res.status(400).json({ message: 'student_id is required' })
    }

    const result = await pool.query(
      `SELECT "id", "name", "photo", "department", "username", "isActivated" FROM "Student" WHERE "id" = $1`,
      [student_id]
    )
    const student = result.rows[0]

    if (!student) {
      return res.status(404).json({ message: 'Student not found' })
    }
    if (student.isActivated) {
      return res.status(409).json({ message: 'Account already activated' })
    }

    return res.json({
      name: student.name,
      photo: student.photo,
      department: student.department,
      username: student.username,
    })
  } catch (err) {
    console.error('ACTIVATE STUDENT ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const setPassword = async (req, res) => {
  const { student_id, otpToken, password } = req.body
  try {
    if (!student_id || String(student_id).trim() === '') {
      return res.status(400).json({ message: 'student_id, otpToken, and password are required' })
    }
    if (!otpToken || String(otpToken).trim() === '') {
      return res.status(400).json({ message: 'student_id, otpToken, and password are required' })
    }
    if (!password || String(password).trim() === '') {
      return res.status(400).json({ message: 'student_id, otpToken, and password are required' })
    }

    // Verify the OTP token and ensure it belongs to this student
    const tokenPayload = verifyOtpToken(otpToken)
    if (!tokenPayload || tokenPayload.studentId !== student_id) {
      return res.status(401).json({ message: 'Session expired, please verify your email again' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const result = await pool.query(
      `SELECT "id", "name", "isActivated" FROM "Student" WHERE "id" = $1`,
      [student_id]
    )
    const student = result.rows[0]

    if (!student) {
      return res.status(404).json({ message: 'Student not found' })
    }
    if (student.isActivated) {
      return res.status(409).json({ message: 'Account already activated' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const userId = crypto.randomUUID()

    const userResult = await pool.query(
      `INSERT INTO "User" ("id", "name", "email", "password", "studentId", "role", "isVerified", "verificationCode", "verificationCodeExpiry")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING "id", "name", "role"`,
      [userId, student.name, tokenPayload.email, hashed, student_id, 'STUDENT', true, null, null]
    )

    await pool.query(
      `UPDATE "Student" SET "isActivated" = true, "email" = $1, "pendingEmail" = NULL, "password_hash" = $2 WHERE "id" = $3`,
      [tokenPayload.email, hashed, student_id]
    )

    return res.status(201).json({
      message: 'Account created successfully. You can now log in.',
      user: userResult.rows[0],
    })
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('email')) {
        return res.status(409).json({ message: 'Email already in use' })
      }
      return res.status(409).json({ message: 'Account already exists' })
    }
    console.error('SET PASSWORD ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const sendOtp = async (req, res) => {
  const { student_id, email } = req.body
  try {
    if (!student_id || String(student_id).trim() === '') {
      return res.status(400).json({ message: 'student_id and email are required' })
    }
    if (!email || String(email).trim() === '') {
      return res.status(400).json({ message: 'student_id and email are required' })
    }

    const studentResult = await pool.query(
      `SELECT "id", "isActivated" FROM "Student" WHERE "id" = $1`,
      [student_id]
    )
    const student = studentResult.rows[0]
    if (!student) {
      return res.status(404).json({ message: 'Student not found' })
    }
    if (student.isActivated) {
      return res.status(409).json({ message: 'Account already activated' })
    }

    if (!isInstitutionalEmail(email)) {
      return res.status(400).json({ message: 'Only AASTU institutional emails are allowed' })
    }

    // Check User table for existing account with that email
    const userCheck = await pool.query(
      `SELECT "id" FROM "User" WHERE "email" = $1`,
      [email]
    )
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Email already in use' })
    }

    // Check Student table for existing activated record with that email
    const studentEmailCheck = await pool.query(
      `SELECT "id" FROM "Student" WHERE "email" = $1 AND "isActivated" = true`,
      [email]
    )
    if (studentEmailCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Email already in use' })
    }

    const code = generateOTP()
    const expiry = generateOTPExpiry(5)

    await pool.query(
      `UPDATE "Student" SET "otpCode" = $1, "otpExpiry" = $2, "pendingEmail" = $3 WHERE "id" = $4`,
      [code, expiry, email, student_id]
    )

    try {
      await sendOtpEmail(email, code)
    } catch (emailErr) {
      console.error('SEND OTP EMAIL ERROR:', emailErr)
      return res.status(500).json({ message: 'Failed to send verification email' })
    }

    return res.status(200).json({ message: 'OTP sent' })
  } catch (err) {
    console.error('SEND OTP ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const verifyOtp = async (req, res) => {
  const { student_id, code } = req.body
  try {
    if (!student_id || String(student_id).trim() === '') {
      return res.status(400).json({ message: 'student_id and code are required' })
    }
    if (!code || String(code).trim() === '') {
      return res.status(400).json({ message: 'student_id and code are required' })
    }

    const result = await pool.query(
      `SELECT "id", "name", "photo", "department", "username", "isActivated", "otpCode", "otpExpiry", "pendingEmail" FROM "Student" WHERE "id" = $1`,
      [student_id]
    )
    const student = result.rows[0]
    if (!student) {
      return res.status(404).json({ message: 'Student not found' })
    }
    if (student.isActivated) {
      return res.status(409).json({ message: 'Account already activated' })
    }

    if (!student.otpCode || student.otpCode !== String(code)) {
      return res.status(400).json({ message: 'Invalid verification code' })
    }
    if (!student.otpExpiry || new Date(student.otpExpiry) < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired' })
    }

    // Clear OTP fields
    await pool.query(
      `UPDATE "Student" SET "otpCode" = NULL, "otpExpiry" = NULL WHERE "id" = $1`,
      [student_id]
    )

    const otpToken = generateOtpToken(student_id, student.pendingEmail)
    return res.status(200).json({
      otpToken,
      name: student.name,
      photo: student.photo,
      department: student.department,
      username: student.username,
    })
  } catch (err) {
    console.error('VERIFY OTP ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const forgotPassword = async (req, res) => {
  const { email } = req.body
  try {
    if (!email || String(email).trim() === '') {
      return res.status(400).json({ message: 'Email is required' })
    }

    // Look up activated Student by email
    const studentResult = await pool.query(
      `SELECT "id", "email" FROM "Student" WHERE "email" = $1 AND "isActivated" = true`,
      [email]
    )
    const student = studentResult.rows[0]
    if (!student) {
      return res.status(404).json({ message: 'No account found with that email' })
    }

    // Look up linked User
    const userResult = await pool.query(
      `SELECT "id" FROM "User" WHERE "studentId" = $1`,
      [student.id]
    )
    const user = userResult.rows[0]
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email' })
    }

    // Generate 6-digit code with 15-minute expiry
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiry = new Date(Date.now() + 15 * 60 * 1000)

    await pool.query(
      `UPDATE "User" SET "verificationCode" = $1, "verificationCodeExpiry" = $2 WHERE "id" = $3`,
      [code, expiry, user.id]
    )

    await sendVerificationEmail(email, code)

    res.json({ message: 'Verification code sent to your email.' })
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body
  try {
    if (!email || String(email).trim() === '') {
      return res.status(400).json({ message: 'Email is required' })
    }
    if (!code || String(code).trim() === '') {
      return res.status(400).json({ message: 'Verification code is required' })
    }
    if (!newPassword) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    // Look up Student by email
    const studentResult = await pool.query(
      `SELECT "id" FROM "Student" WHERE "email" = $1`,
      [email]
    )
    const student = studentResult.rows[0]
    if (!student) {
      return res.status(404).json({ message: 'No account found with that email' })
    }

    // Look up linked User and verify code
    const userResult = await pool.query(
      `SELECT "id", "verificationCode", "verificationCodeExpiry" FROM "User" WHERE "studentId" = $1`,
      [student.id]
    )
    const user = userResult.rows[0]
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email' })
    }

    if (!user.verificationCode || user.verificationCode !== String(code)) {
      return res.status(400).json({ message: 'Invalid or expired verification code' })
    }
    if (!user.verificationCodeExpiry || new Date(user.verificationCodeExpiry) < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' })
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await pool.query(
      `UPDATE "User" SET "password" = $1, "verificationCode" = NULL, "verificationCodeExpiry" = NULL WHERE "id" = $2`,
      [hashed, user.id]
    )
    await pool.query(
      `UPDATE "Student" SET "password_hash" = $1 WHERE "id" = $2`,
      [hashed, student.id]
    )

    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    console.error('RESET PASSWORD ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}
