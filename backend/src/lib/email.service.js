import sgMail from '@sendgrid/mail'

/**
 * Sends a verification email with the OTP code using SendGrid.
 * Requires SENDGRID_API_KEY and SENDGRID_FROM environment variables.
 */
export async function sendVerificationEmail(to, code) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)

  await sgMail.send({
    from: process.env.SENDGRID_FROM,
    to,
    subject: 'Verify your AASTU account',
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#0033A0">Verify your AASTU account</h2>
        <p>Use the code below to verify your email address:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0033A0;padding:16px 0">${code}</div>
        <p style="color:#666;font-size:13px">This code expires in 10 minutes. If you did not register, ignore this email.</p>
      </div>
    `,
  })
}
