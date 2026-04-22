import crypto from 'crypto'
import pool from '../lib/db.js'

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Generate a unique 8-digit numeric guest code.
 * Retries up to 5 times on collision.
 * Requirements: 1.3
 */
export async function generateGuestCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(Math.floor(10000000 + Math.random() * 90000000))
    const { rows } = await pool.query(
      `SELECT id FROM "GuestPass" WHERE "guestCode" = $1`,
      [code]
    )
    if (!rows.length) return code
  }
  throw new Error('Failed to generate unique guest code after 5 attempts')
}

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------

const REQUIRED = ['guestName', 'phone', 'purpose', 'deviceBrand', 'deviceModel', 'serialNumber']

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/guests/register
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export const registerGuest = async (req, res) => {
  const { guestName, phone, purpose, deviceBrand, deviceModel, serialNumber } = req.body
  const registeredById = req.user.id

  // Validate required fields
  for (const field of REQUIRED) {
    const val = req.body[field]
    if (!val || !String(val).trim()) {
      return res.status(400).json({ message: `${field} is required` })
    }
  }

  try {
    const guestCode = await generateGuestCode()

    const { rows } = await pool.query(
      `INSERT INTO "GuestPass"
         ("id", "guestName", "phone", "purpose", "deviceBrand", "deviceModel",
          "serialNumber", "guestCode", "registeredById")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        crypto.randomUUID(),
        guestName.trim(),
        phone.trim(),
        purpose.trim(),
        deviceBrand.trim(),
        deviceModel.trim(),
        serialNumber.trim(),
        guestCode,
        registeredById,
      ]
    )

    res.status(201).json({ message: 'Guest registered successfully', guestPass: rows[0] })
  } catch (err) {
    console.error('REGISTER GUEST ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * GET /api/guests/lookup?code=
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export const lookupGuest = async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).json({ message: 'Provide code query parameter' })

  try {
    const { rows } = await pool.query(
      `SELECT gp.id, gp."guestName" as guest_name, gp.phone, gp.purpose,
              gp."deviceBrand" as device_brand, gp."deviceModel" as device_model,
              gp."serialNumber" as serial_number, gp."guestCode" as guest_code,
              gp."isInCampus" as is_in_campus,
              gp."verificationStatus" as verification_status,
              gp."registeredAt" as registered_at,
              u.name as registered_by_name
       FROM "GuestPass" gp
       JOIN "User" u ON gp."registeredById" = u.id
       WHERE gp."guestCode" = $1`,
      [code]
    )

    if (!rows.length) return res.status(404).json({ message: 'No record found' })

    res.json({ ...rows[0], type: 'guest' })
  } catch (err) {
    console.error('LOOKUP GUEST ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * POST /api/guests/entry/:id
 * Requirements: 3.1, 3.3, 3.4
 */
export const guestEntry = async (req, res) => {
  const { id } = req.params
  const guardId = req.user.id

  try {
    const { rows } = await pool.query(
      `SELECT id, "verificationStatus", "isInCampus" FROM "GuestPass" WHERE id = $1`,
      [id]
    )
    const gp = rows[0]
    if (!gp) return res.status(404).json({ message: 'No record found' })

    if (gp.verificationStatus === 'BLOCKED')
      return res.status(403).json({ message: 'Guest pass is blocked' })
    if (gp.isInCampus)
      return res.status(400).json({ message: 'Guest is already inside campus' })

    await pool.query(
      `UPDATE "GuestPass" SET "isInCampus" = true WHERE id = $1`,
      [id]
    )
    await pool.query(
      `INSERT INTO "GateLog" ("id", "scanType", "scannedById", "guestPassId", "action")
       VALUES ($1, 'IN'::"ScanType", $2, $3, 'ENTRY')`,
      [crypto.randomUUID(), guardId, id]
    )

    res.json({ message: 'Guest entry logged successfully' })
  } catch (err) {
    console.error('GUEST ENTRY ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * POST /api/guests/exit/:id
 * Requirements: 3.2, 3.3, 3.5
 */
export const guestExit = async (req, res) => {
  const { id } = req.params
  const guardId = req.user.id

  try {
    const { rows } = await pool.query(
      `SELECT id, "verificationStatus", "isInCampus" FROM "GuestPass" WHERE id = $1`,
      [id]
    )
    const gp = rows[0]
    if (!gp) return res.status(404).json({ message: 'No record found' })

    if (gp.verificationStatus === 'BLOCKED')
      return res.status(403).json({ message: 'Guest pass is blocked' })
    if (!gp.isInCampus)
      return res.status(400).json({ message: 'Guest is not inside campus' })

    await pool.query(
      `UPDATE "GuestPass" SET "isInCampus" = false WHERE id = $1`,
      [id]
    )
    await pool.query(
      `INSERT INTO "GateLog" ("id", "scanType", "scannedById", "guestPassId", "action")
       VALUES ($1, 'OUT'::"ScanType", $2, $3, 'EXIT')`,
      [crypto.randomUUID(), guardId, id]
    )

    res.json({ message: 'Guest exit logged successfully' })
  } catch (err) {
    console.error('GUEST EXIT ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}
