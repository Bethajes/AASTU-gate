import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
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
  const transporter = createTransporter()

  await transporter.sendMail({
    from: `"AASTU ICT Security" <${process.env.SMTP_USER}>`,
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
  const transporter = createTransporter()

  await transporter.sendMail({
    from: `"AASTU ICT Security" <${process.env.SMTP_USER}>`,
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
