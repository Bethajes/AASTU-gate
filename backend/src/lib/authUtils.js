/**
 * Validates that an email matches the AASTU institutional format:
 * firstname.fathername@aastustudent.edu.et
 */
export function isInstitutionalEmail(email) {
  return /^[a-zA-Z]+\.[a-zA-Z]+@aastustudent\.edu\.et$/.test(email)
}

/**
 * Generates a random 6-digit numeric OTP string.
 */
export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Returns a Date 10 minutes from now (OTP expiry).
 */
export function generateOTPExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000)
}
