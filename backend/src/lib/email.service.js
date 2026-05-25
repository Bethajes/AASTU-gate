import nodemailer from 'nodemailer'

let transporterCache = null

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured for email delivery')
  }

  const secure = process.env.SMTP_SECURE === 'true' || port === 465

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    ...(secure ? {} : { requireTLS: true }),
  }
}

async function createTransporter() {
  const transporter = nodemailer.createTransport(getSmtpConfig())
  await transporter.verify()
  return transporter
}

async function getTransporter() {
  if (!transporterCache) {
    transporterCache = await createTransporter()
  }
  return transporterCache
}

function formatFromAddress() {
  return `"AASTU ICT Security" <${process.env.SMTP_USER}>`
}

/**
 * Sends a verification/reset code email via SMTP (nodemailer).
 * Set SMTP_USER and SMTP_PASS in .env (use a Gmail App Password).
 */
/**
 * Sends an OTP activation email via SMTP (nodemailer).
 * Used during the student account activation flow.
 */
export async function sendOtpEmail(to, code) {
  const transporter = await getTransporter()

  await transporter.sendMail({
    from: formatFromAddress(),
    to,
    subject: 'Activate your AASTU account',
    text: `Your activation code is: ${code}\n\nThis code expires in 5 minutes.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#0033A0">Activate your AASTU account</h2>
        <p>Use the code below to verify your institutional email address:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0033A0;padding:16px 0">${code}</div>
        <p style="color:#666;font-size:13px">This code expires in 5 minutes. If you did not request this, ignore this email.</p>
      </div>
    `,
  })
}

export async function sendVerificationEmail(to, code) {
  const transporter = await getTransporter()

  await transporter.sendMail({
    from: formatFromAddress(),
    to,
    subject: 'Your AASTU password reset code',
    text: `Your password reset code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#0033A0">AASTU Password Reset</h2>
        <p>Use the code below to reset your password:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0033A0;padding:16px 0">${code}</div>
        <p style="color:#666;font-size:13px">This code expires in 15 minutes. If you did not request a reset, ignore this email.</p>
      </div>
    `,
  })
}
