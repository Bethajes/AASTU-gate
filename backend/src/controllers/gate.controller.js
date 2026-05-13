import pool from '../lib/db.js'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Existing handlers (preserved for backward compatibility)
// ---------------------------------------------------------------------------

export const scanLaptop = async (req, res) => {
  const { qrCode, scanType } = req.body
  const scannedById = req.user.id

  try {
    const laptopResult = await pool.query(
      `SELECT * FROM "Laptop" WHERE "qrCode" = $1`,
      [qrCode]
    )
    const laptop = laptopResult.rows[0]

    if (!laptop) return res.status(404).json({ message: 'Laptop not registered' })

    if (scanType === 'IN' && laptop.isInCampus)
      return res.status(400).json({ message: 'Laptop already inside campus' })
    if (scanType === 'OUT' && !laptop.isInCampus)
      return res.status(400).json({ message: 'Laptop is not inside campus' })

    await pool.query(
      `UPDATE "Laptop" SET "isInCampus" = $1 WHERE "id" = $2`,
      [scanType === 'IN', laptop.id]
    )

    await pool.query(
      `INSERT INTO "GateLog" ("id", "laptopId", "scanType", "scannedById")
       VALUES ($1, $2, $3::"ScanType", $4)`,
      [crypto.randomUUID(), laptop.id, scanType, scannedById]
    )

    res.json({ message: `Laptop scanned ${scanType} successfully` })
  } catch (err) {
    console.error('SCAN ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const getLogs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gl.id, gl."scanType" as scan_type, gl."scannedAt" as scanned_at,
              gl."action" as action,
              -- Laptop fields (null for guest rows)
              l."serialNumber" as serial_number, l.brand,
              owner."name" as owner_name,
              -- Guest fields (null for laptop rows)
              gp."guestName" as guest_name,
              gp."deviceBrand" as guest_brand,
              gp."serialNumber" as guest_serial,
              -- Guard name
              guard."name" as scanned_by_name,
              -- Type indicator
              CASE WHEN gl."guestPassId" IS NOT NULL THEN 'guest' ELSE 'laptop' END as type
       FROM "GateLog" gl
       LEFT JOIN "Laptop" l ON gl."laptopId" = l."id"
       LEFT JOIN "User" owner ON l."ownerId" = owner."id"
       LEFT JOIN "GuestPass" gp ON gl."guestPassId" = gp."id"
       JOIN "User" guard ON gl."scannedById" = guard."id"
       ORDER BY gl."scannedAt" DESC`
    )
    res.json(result.rows)
  } catch (err) {
    console.error('GET LOGS ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// ---------------------------------------------------------------------------
// New handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/gate/lookup?code=&studentId=
 * Requirements: 8.1, 3.2
 * Extended to also search GuestPass table (guest-registration req 2.1)
 */
export const lookupLaptop = async (req, res) => {
  const { code, studentId, guestName } = req.query

  if (!code && !studentId && !guestName) {
    return res.status(400).json({ message: 'Provide code, studentId, or guestName query parameter' })
  }

  try {
    // Guest name search — returns a list of matches
    if (guestName) {
      const guestResult = await pool.query(
        `SELECT gp.id, gp."guestName" as guest_name, gp.phone, gp.purpose,
                gp."deviceBrand" as device_brand, gp."deviceModel" as device_model,
                gp."serialNumber" as serial_number, gp."guestCode" as guest_code,
                gp."isInCampus" as is_in_campus,
                gp."verificationStatus" as verification_status,
                gp."registeredAt" as registered_at,
                u.name as registered_by_name
         FROM "GuestPass" gp
         JOIN "User" u ON gp."registeredById" = u.id
         WHERE LOWER(gp."guestName") LIKE LOWER($1)
         ORDER BY gp."registeredAt" DESC
         LIMIT 20`,
        [`%${guestName.trim()}%`]
      )
      return res.json({ type: 'guestList', results: guestResult.rows })
    }

    // If searching by code, also check GuestPass first
    if (code) {
      const guestResult = await pool.query(
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
      if (guestResult.rows.length) {
        return res.json({ ...guestResult.rows[0], type: 'guest' })
      }
    }

    let result

    if (code) {
      result = await pool.query(
        `SELECT l.id, l."serialNumber" as serial_number, l.brand, l.model,
                l."qrCode" as qr_code, l."isInCampus" as is_in_campus,
                l."photoUrl" as photo_url,
                l."verificationStatus" as verification_status,
                l."verifiedAt" as verified_at,
                l."verifiedById" as verified_by_id,
                vb."name" as verified_by_name,
                owner."name" as owner_name,
                owner."email" as owner_email,
                owner."studentId" as student_id,
                student."name" as student_full_name,
                student."photo" as student_photo_url
         FROM "Laptop" l
         JOIN "User" owner ON l."ownerId" = owner."id"
         LEFT JOIN "Student" student ON owner."studentId" = student."id"
         LEFT JOIN "User" vb ON l."verifiedById" = vb."id"
         WHERE l."qrCode" = $1`,
        [code]
      )
    } else {
      result = await pool.query(
        `SELECT l.id, l."serialNumber" as serial_number, l.brand, l.model,
                l."qrCode" as qr_code, l."isInCampus" as is_in_campus,
                l."photoUrl" as photo_url,
                l."verificationStatus" as verification_status,
                l."verifiedAt" as verified_at,
                l."verifiedById" as verified_by_id,
                vb."name" as verified_by_name,
                owner."name" as owner_name,
                owner."email" as owner_email,
                owner."studentId" as student_id,
                student."name" as student_full_name,
                student."photo" as student_photo_url
         FROM "Laptop" l
         JOIN "User" owner ON l."ownerId" = owner."id"
         LEFT JOIN "Student" student ON owner."studentId" = student."id"
         LEFT JOIN "User" vb ON l."verifiedById" = vb."id"
         WHERE owner."studentId" = $1`,
        [studentId]
      )
    }

    if (!result.rows.length) {
      return res.status(404).json({ message: 'No laptop found' })
    }

    res.json({ ...result.rows[0], type: 'laptop' })
  } catch (err) {
    console.error('LOOKUP ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * POST /api/gate/verify/:laptopId
 * Requirements: 4.1, 4.2, 4.3, 4.4, 1.2
 */
export const verifyLaptop = async (req, res) => {
  const { laptopId } = req.params
  const guardId = req.user.id

  try {
    const laptopResult = await pool.query(
      `SELECT id, "verificationStatus" FROM "Laptop" WHERE id = $1`,
      [laptopId]
    )
    const laptop = laptopResult.rows[0]

    if (!laptop) return res.status(404).json({ message: 'No laptop found' })

    if (laptop.verificationStatus !== 'PENDING') {
      return res.status(400).json({ message: 'Laptop is not in PENDING status' })
    }

    const updated = await pool.query(
      `UPDATE "Laptop"
       SET "verificationStatus" = 'VERIFIED',
           "verifiedAt" = NOW(),
           "verifiedById" = $1
       WHERE id = $2
       RETURNING id, "verificationStatus" as verification_status,
                 "verifiedAt" as verified_at, "verifiedById" as verified_by`,
      [guardId, laptopId]
    )

    res.json({ message: 'Laptop verified successfully', laptop: updated.rows[0] })
  } catch (err) {
    console.error('VERIFY ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * POST /api/gate/block/:laptopId
 * Body: { reason?: string }
 * Requirements: 1.3, 8.5
 */
export const blockLaptop = async (req, res) => {
  const { laptopId } = req.params
  const { reason } = req.body
  const guardId = req.user.id

  try {
    const laptopResult = await pool.query(
      `SELECT l.id, l."serialNumber", l.brand, l.model,
              owner."name" as owner_name, owner."studentId" as student_id,
              guard."name" as guard_name
       FROM "Laptop" l
       JOIN "User" owner ON l."ownerId" = owner."id"
       JOIN "User" guard ON guard."id" = $2
       WHERE l.id = $1`,
      [laptopId, guardId]
    )

    if (!laptopResult.rows.length) {
      return res.status(404).json({ message: 'No laptop found' })
    }

    const laptop = laptopResult.rows[0]

    const updated = await pool.query(
      `UPDATE "Laptop"
       SET "verificationStatus" = 'BLOCKED',
           "blockReason" = $1
       WHERE id = $2
       RETURNING id, "verificationStatus" as verification_status`,
      [reason || null, laptopId]
    )

    // Create admin notification
    const title = `Laptop Blocked by Guard`
    const body = `${laptop.guard_name} blocked ${laptop.brand} ${laptop.model} (${laptop.serial_number}) owned by ${laptop.owner_name}${reason ? `. Reason: ${reason}` : '.'}`
    await pool.query(
      `INSERT INTO "Notification" ("id", "type", "title", "body", "laptopId", "guardId")
       VALUES ($1, 'LAPTOP_BLOCKED', $2, $3, $4, $5)`,
      [crypto.randomUUID(), title, body, laptopId, guardId]
    )

    res.json({ message: 'Laptop blocked successfully', laptop: updated.rows[0] })
  } catch (err) {
    console.error('BLOCK ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * POST /api/gate/entry/:laptopId
 * Requirements: 5.1, 5.3, 5.5, 7.1, 7.3, 1.5
 */
export const logEntry = async (req, res) => {
  const { laptopId } = req.params
  const guardId = req.user.id

  try {
    const laptopResult = await pool.query(
      `SELECT id, "verificationStatus", "isInCampus" FROM "Laptop" WHERE id = $1`,
      [laptopId]
    )
    const laptop = laptopResult.rows[0]

    if (!laptop) return res.status(404).json({ message: 'No laptop found' })

    if (laptop.verificationStatus === 'BLOCKED') {
      return res.status(403).json({ message: 'Laptop is blocked' })
    }
    if (laptop.verificationStatus === 'PENDING') {
      return res.status(403).json({ message: 'Laptop must be verified first' })
    }
    if (laptop.isInCampus) {
      return res.status(400).json({ message: 'Laptop already inside campus' })
    }

    await pool.query(
      `UPDATE "Laptop" SET "isInCampus" = true WHERE id = $1`,
      [laptopId]
    )

    await pool.query(
      `INSERT INTO "GateLog" ("id", "laptopId", "scanType", "scannedById", "action")
       VALUES ($1, $2, 'IN'::"ScanType", $3, 'ENTRY')`,
      [crypto.randomUUID(), laptopId, guardId]
    )

    res.json({ message: 'Entry logged successfully' })
  } catch (err) {
    console.error('ENTRY ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * POST /api/gate/exit/:laptopId
 * Requirements: 5.2, 5.3, 5.6, 7.1, 7.3
 */
export const logExit = async (req, res) => {
  const { laptopId } = req.params
  const guardId = req.user.id

  try {
    const laptopResult = await pool.query(
      `SELECT id, "verificationStatus", "isInCampus" FROM "Laptop" WHERE id = $1`,
      [laptopId]
    )
    const laptop = laptopResult.rows[0]

    if (!laptop) return res.status(404).json({ message: 'No laptop found' })

    if (laptop.verificationStatus === 'BLOCKED') {
      return res.status(403).json({ message: 'Laptop is blocked' })
    }
    if (laptop.verificationStatus === 'PENDING') {
      return res.status(403).json({ message: 'Laptop must be verified first' })
    }
    if (!laptop.isInCampus) {
      return res.status(400).json({ message: 'Laptop is not inside campus' })
    }

    await pool.query(
      `UPDATE "Laptop" SET "isInCampus" = false WHERE id = $1`,
      [laptopId]
    )

    await pool.query(
      `INSERT INTO "GateLog" ("id", "laptopId", "scanType", "scannedById", "action")
       VALUES ($1, $2, 'OUT'::"ScanType", $3, 'EXIT')`,
      [crypto.randomUUID(), laptopId, guardId]
    )

    res.json({ message: 'Exit logged successfully' })
  } catch (err) {
    console.error('EXIT ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * GET /api/gate/notifications
 * Returns unread notifications for admins.
 */
export const getNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, type, title, body, "isRead", "createdAt", "laptopId", "guardId"
       FROM "Notification"
       ORDER BY "createdAt" DESC
       LIMIT 50`
    )
    res.json(result.rows)
  } catch (err) {
    console.error('GET NOTIFICATIONS ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * POST /api/gate/notifications/mark-read
 * Marks all notifications as read.
 */
export const markNotificationsRead = async (req, res) => {
  try {
    await pool.query(`UPDATE "Notification" SET "isRead" = true WHERE "isRead" = false`)
    res.json({ message: 'Marked as read' })
  } catch (err) {
    console.error('MARK READ ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}
