import jwt from 'jsonwebtoken'

/**
 * Validates that an email matches the AASTU institutional format:
 * firstname.fathername@aastustudent.edu.et  (upper years)
 * firstname.fathername@aastustudents.edu.et (freshman)
 */
export function isInstitutionalEmail(email) {
  return /^[a-zA-Z]+\.[a-zA-Z]+@aastustudents?\.edu\.et$/.test(email)
}

/**
 * Generates a random 6-digit numeric OTP string.
 */
export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Returns a Date `minutes` minutes from now (default 5).
 * @param {number} [minutes=5]
 */
export function generateOTPExpiry(minutes = 5) {
  return new Date(Date.now() + minutes * 60 * 1000)
}

/**
 * Signs a short-lived JWT encoding { studentId, email, purpose: 'otp-verified' }.
 * Expires in 10 minutes.
 * @param {string} studentId
 * @param {string} email
 * @returns {string} signed JWT
 */
export function generateOtpToken(studentId, email) {
  return jwt.sign(
    { studentId, email, purpose: 'otp-verified' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  )
}

/**
 * Verifies and decodes an OTP token.
 * @param {string} token
 * @returns {{ studentId: string, email: string } | null}
 */
export function verifyOtpToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.purpose !== 'otp-verified') return null
    return { studentId: payload.studentId, email: payload.email }
  } catch {
    return null
  }
}
