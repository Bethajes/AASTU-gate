import QRCode from 'qrcode'
import pool from '../lib/db.js'
import crypto from 'crypto'

// Generate 8-digit code
const generate8DigitCode = () => {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

const isUniqueViolation = (err) =>
  err && (err.code === '23505' || /duplicate key value violates unique constraint/i.test(err.message || ''))

const clean = (value) => String(value ?? '').trim()
const usernameFromStudentId = (studentId) => studentId.replace(/[^a-z0-9]/gi, '').toLowerCase()

async function resolveLaptopOwner({ studentId, registrantName, allowCreate }) {
  const existingUser = await pool.query(
    `SELECT "id", "name", "studentId" FROM "User" WHERE "studentId" = $1`,
    [studentId]
  )
  if (existingUser.rows[0]) return existingUser.rows[0]

  if (!allowCreate) return null

  const name = registrantName || studentId
  const username = usernameFromStudentId(studentId)

  await pool.query(
    `INSERT INTO "Student" ("id", "username", "name", "email", "department", "isActivated")
     VALUES ($1, $2, $3, NULL, $4, false)
     ON CONFLICT ("id") DO UPDATE
       SET "name" = COALESCE(NULLIF("Student"."name", ''), EXCLUDED."name")`,
    [studentId, username, name, 'Unassigned']
  )

  const ownerId = crypto.randomUUID()
  const syntheticEmail = `guard-${ownerId}@aastu.local`
  const result = await pool.query(
    `INSERT INTO "User" ("id", "name", "email", "password", "role", "studentId", "isVerified")
     VALUES ($1, $2, $3, $4, 'STUDENT'::"Role", $5, false)
     RETURNING "id", "name", "studentId"`,
    [ownerId, name, syntheticEmail, crypto.randomUUID(), studentId]
  )

  return result.rows[0]
}

function laptopJson(row) {
  return {
    id: row.id,
    serial_number: row.serialNumber,
    brand: row.brand,
    model: row.model,
    qr_code: row.qrCode,
    is_in_campus: row.isInCampus,
    registered_at: row.registeredAt,
    owner_id: row.ownerId,
    owner_name: row.owner_name,
    student_id: row.student_id,
    registrant_name: row.registrantName,
    registrant_phone: row.registrantPhone,
    photo_url: row.photoUrl,
    verification_status: row.verificationStatus,
    security_status: row.securityStatus || 'ACTIVE',
    report_reason: row.reportReason,
    reported_at: row.reportedAt,
    reported_by_id: row.reportedById,
    recovered_at: row.recoveredAt,
    recovered_by_id: row.recoveredById,
    recovery_note: row.recoveryNote,
    verified_at: row.verifiedAt,
    verified_by_name: row.verified_by_name,
  }
}

export const registerLaptop = async (req, res) => {
  const { serialNumber, brand, model } = req.body
  const ownerId = req.user.id
  const photoUrl = req.file ? `/uploads/laptops/${req.file.filename}` : null

  if (!serialNumber || !brand || !model) {
    return res.status(400).json({ message: 'serialNumber, brand, and model are required' })
  }

  const qrData = generate8DigitCode()

  try {
    const qrImage = await QRCode.toDataURL(qrData)
    const id = crypto.randomUUID()

    const result = await pool.query(
      `INSERT INTO "Laptop" ("id", "serialNumber", "brand", "model", "qrCode", "ownerId", "photoUrl", "verificationStatus")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, serialNumber, brand, model, qrData, ownerId, photoUrl, 'PENDING']
    )

    const row = result.rows[0]
    res.status(201).json({
      message: 'Laptop registered',
      laptop: {
        id: row.id,
        serial_number: row.serialNumber,
        brand: row.brand,
        model: row.model,
        qr_code: row.qrCode,
        is_in_campus: row.isInCampus,
        registered_at: row.registeredAt,
        owner_id: row.ownerId,
        photo_url: row.photoUrl,
      },
      qrImage,
      qrCodeNumber: qrData,
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(400).json({ message: 'Serial number already registered' })
    }
    console.error('REGISTER LAPTOP ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: ownerId,
      serialNumber,
      code: err.code
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const getMyLaptops = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u."name" as owner_name, u."studentId" as student_id,
              vb."name" as verified_by_name
       FROM "Laptop" l
       JOIN "User" u ON l."ownerId" = u."id"
       LEFT JOIN "User" vb ON l."verifiedById" = vb."id"
       WHERE l."ownerId" = $1
       ORDER BY l."registeredAt" DESC`,
      [req.user.id]
    )
    res.json(result.rows.map(laptopJson))
  } catch (err) {
    console.error('GET MY LAPTOPS ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: req.user.id
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const getAllLaptops = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u."name" as owner_name, u."studentId" as student_id,
              vb."name" as verified_by_name
       FROM "Laptop" l
       JOIN "User" u ON l."ownerId" = u."id"
       LEFT JOIN "User" vb ON l."verifiedById" = vb."id"
       ORDER BY l."registeredAt" DESC`
    )
    res.json(result.rows.map(laptopJson))
  } catch (err) {
    console.error('GET ALL LAPTOPS ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: req.user.id,
      userRole: req.user.role
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const regenerateCode = async (req, res) => {
  const { id } = req.params
  const ownerId = req.user.id

  try {
    // Make sure this laptop belongs to the requesting student
    const check = await pool.query(
      `SELECT * FROM "Laptop" WHERE "id" = $1 AND "ownerId" = $2`,
      [id, ownerId]
    )
    if (!check.rows[0]) {
      return res.status(404).json({ message: 'Laptop not found' })
    }

    const newCode = generate8DigitCode()
    const qrImage = await QRCode.toDataURL(newCode)

    await pool.query(
      `UPDATE "Laptop" SET "qrCode" = $1 WHERE "id" = $2`,
      [newCode, id]
    )

    res.json({ qrCodeNumber: newCode, qrImage })
  } catch (err) {
    console.error('REGENERATE CODE ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: ownerId,
      laptopId: id
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const updatePhoto = async (req, res) => {
  const { id } = req.params
  const ownerId = req.user.id
  const photoUrl = req.file ? `/uploads/laptops/${req.file.filename}` : null

  if (!photoUrl) {
    return res.status(400).json({ message: 'No photo uploaded' })
  }

  try {
    const result = await pool.query(
      `UPDATE "Laptop" SET "photoUrl" = $1 WHERE "id" = $2 AND "ownerId" = $3 RETURNING *`,
      [photoUrl, id, ownerId]
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Laptop not found' })
    }
    res.json({ photo_url: result.rows[0].photoUrl })
  } catch (err) {
    console.error('UPDATE PHOTO ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: ownerId,
      laptopId: id
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const editLaptop = async (req, res) => {
  const { id } = req.params
  const ownerId = req.user.id
  const { serialNumber, brand, model } = req.body
  const photoUrl = req.file ? `/uploads/laptops/${req.file.filename}` : undefined

  if (!serialNumber && !brand && !model && !photoUrl) {
    return res.status(400).json({ message: 'Provide at least one field to update' })
  }

  try {
    // Verify ownership
    const check = await pool.query(
      `SELECT id FROM "Laptop" WHERE id = $1 AND "ownerId" = $2`,
      [id, ownerId]
    )
    if (!check.rows[0]) return res.status(404).json({ message: 'Laptop not found' })

    // Build dynamic SET clause — always reset verification
    const sets = [
      `"verificationStatus" = 'PENDING'`,
      `"verifiedAt" = NULL`,
      `"verifiedById" = NULL`,
    ]
    const values = []
    let idx = 1

    if (serialNumber) { sets.push(`"serialNumber" = $${idx++}`); values.push(serialNumber) }
    if (brand)        { sets.push(`brand = $${idx++}`);          values.push(brand) }
    if (model)        { sets.push(`model = $${idx++}`);          values.push(model) }
    if (photoUrl)     { sets.push(`"photoUrl" = $${idx++}`);     values.push(photoUrl) }

    values.push(id)
    const result = await pool.query(
      `UPDATE "Laptop" SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )

    const row = result.rows[0]
    res.json({
      message: 'Laptop updated. Re-verification by a guard is required.',
      laptop: {
        id: row.id,
        serial_number: row.serialNumber,
        brand: row.brand,
        model: row.model,
        photo_url: row.photoUrl,
        verification_status: row.verificationStatus,
      },
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(400).json({ message: 'Serial number already in use' })
    }
    console.error('EDIT LAPTOP ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: ownerId,
      laptopId: id,
      code: err.code
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// ─── Admin: get laptops for a specific student ────────────────────────────────
export const getLaptopsByStudent = async (req, res) => {
  const { studentId } = req.params
  try {
    const result = await pool.query(
      `SELECT l.*, u."name" as owner_name, u."studentId" as student_id,
              vb."name" as verified_by_name
       FROM "Laptop" l
       JOIN "User" u ON l."ownerId" = u."id"
       LEFT JOIN "User" vb ON l."verifiedById" = vb."id"
       WHERE u."studentId" = $1
       ORDER BY l."registeredAt" DESC`,
      [studentId]
    )
    res.json(result.rows.map(laptopJson))
  } catch (err) {
    console.error('GET LAPTOPS BY STUDENT ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// ─── Admin: delete a laptop ───────────────────────────────────────────────────
export const deleteLaptop = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `DELETE FROM "Laptop" WHERE "id" = $1 RETURNING "id"`,
      [id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Laptop not found' })
    res.json({ message: 'Laptop deleted' })
  } catch (err) {
    console.error('DELETE LAPTOP ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// ─── Admin: register a laptop on behalf of a student ─────────────────────────
export const adminRegisterLaptop = async (req, res) => {
  const studentId = clean(req.body.studentId)
  const serialNumber = clean(req.body.serialNumber)
  const brand = clean(req.body.brand)
  const model = clean(req.body.model)
  const registrantName = clean(req.body.name)
  const registrantPhone = clean(req.body.phone)
  const photoUrl = req.file ? `/uploads/laptops/${req.file.filename}` : null

  if (!studentId || !serialNumber || !brand || !model) {
    return res.status(400).json({ message: 'studentId, serialNumber, brand, and model are required' })
  }
  if (req.user?.role === 'GUARD' && (!registrantName || !registrantPhone)) {
    return res.status(400).json({ message: 'name and phone are required' })
  }

  try {
    const owner = await resolveLaptopOwner({
      studentId,
      registrantName,
      allowCreate: req.user?.role === 'GUARD',
    })
    if (!owner) {
      return res.status(404).json({ message: 'No user account found for this student. The student must activate their account first.' })
    }
    const ownerId = owner.id

    const qrData = Math.floor(10000000 + Math.random() * 90000000).toString()
    const qrImage = await QRCode.toDataURL(qrData)
    const id = crypto.randomUUID()

    const result = await pool.query(
      `INSERT INTO "Laptop" (
         "id", "serialNumber", "brand", "model", "qrCode", "ownerId", "photoUrl",
         "registrantName", "registrantPhone", "verificationStatus"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING') RETURNING *`,
      [id, serialNumber, brand, model, qrData, ownerId, photoUrl, registrantName || null, registrantPhone || null]
    )
    const row = result.rows[0]
    res.status(201).json({
      message: 'Laptop registered on behalf of student',
      laptop: {
        id: row.id,
        serial_number: row.serialNumber,
        brand: row.brand,
        model: row.model,
        qr_code: row.qrCode,
        is_in_campus: row.isInCampus,
        registered_at: row.registeredAt,
        owner_id: row.ownerId,
        owner_name: owner.name,
        student_id: owner.studentId,
        photo_url: row.photoUrl,
        registrant_name: row.registrantName,
        registrant_phone: row.registrantPhone,
        verification_status: row.verificationStatus,
        security_status: row.securityStatus || 'ACTIVE',
      },
      qrImage,
      qrCodeNumber: qrData,
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(400).json({ message: 'Serial number already registered' })
    }
    console.error('ADMIN REGISTER LAPTOP ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// ─── Admin: update photo for any laptop ──────────────────────────────────────
export const adminUpdateLaptopPhoto = async (req, res) => {
  const { id } = req.params
  const photoUrl = req.file ? `/uploads/laptops/${req.file.filename}` : null

  if (!photoUrl) {
    return res.status(400).json({ message: 'No photo uploaded' })
  }

  try {
    const result = await pool.query(
      `UPDATE "Laptop" SET "photoUrl" = $1 WHERE "id" = $2 RETURNING "id", "photoUrl"`,
      [photoUrl, id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Laptop not found' })
    res.json({ photo_url: result.rows[0].photoUrl })
  } catch (err) {
    console.error('ADMIN UPDATE LAPTOP PHOTO ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const getLaptopByCode = async (req, res) => {
  const { code } = req.params
  try {
    const result = await pool.query(
      `SELECT l.*, u."name" as owner_name, u."studentId" as student_id,
              vb."name" as verified_by_name
       FROM "Laptop" l
       JOIN "User" u ON l."ownerId" = u."id"
       LEFT JOIN "User" vb ON l."verifiedById" = vb."id"
       WHERE l."qrCode" = $1`,
      [code]
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'No laptop found with this code' })
    }
    const row = result.rows[0]
    res.json(laptopJson(row))
  } catch (err) {
    console.error('GET LAPTOP BY CODE ERROR:', {
      message: err.message,
      stack: err.stack,
      code: req.params.code,
      userId: req.user?.id
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const reportLaptopSecurityStatus = async (req, res) => {
  const { id } = req.params
  const status = clean(req.body.status).toUpperCase()
  const reason = clean(req.body.reason)
  const userId = req.user.id

  if (!['LOST', 'STOLEN'].includes(status)) {
    return res.status(400).json({ message: 'status must be LOST or STOLEN' })
  }
  if (!reason) {
    return res.status(400).json({ message: 'reason is required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query(
      `SELECT id, "ownerId", "securityStatus" FROM "Laptop" WHERE id = $1 AND "ownerId" = $2`,
      [id, userId]
    )
    if (!current.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Laptop not found' })
    }

    const updated = await client.query(
      `UPDATE "Laptop"
       SET "securityStatus" = $1,
           "reportReason" = $2,
           "reportedAt" = NOW(),
           "reportedById" = $3,
           "recoveredAt" = NULL,
           "recoveredById" = NULL,
           "recoveryNote" = NULL
       WHERE id = $4
       RETURNING *`,
      [status, reason, userId, id]
    )
    await client.query(
      `INSERT INTO "lost_stolen_audit_logs"
       ("id", "laptopId", "action", "fromStatus", "toStatus", "reason", "actorId", "actorRole")
       VALUES ($1, $2, 'REPORT', $3, $4, $5, $6, $7)`,
      [crypto.randomUUID(), id, current.rows[0].securityStatus || 'ACTIVE', status, reason, userId, req.user.role]
    )
    await client.query(
      `INSERT INTO "Notification" ("id", "type", "title", "body", "laptopId")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        crypto.randomUUID(),
        `LAPTOP_${status}`,
        `Laptop Reported ${status}`,
        `A student reported a laptop as ${status.toLowerCase()}. Reason: ${reason}`,
        id,
      ]
    )
    await client.query('COMMIT')
    res.json({ message: `Laptop marked as ${status}`, laptop: laptopJson(updated.rows[0]) })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('REPORT LAPTOP SECURITY STATUS ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  } finally {
    client.release()
  }
}

export const notifyLaptopFound = async (req, res) => {
  const { id } = req.params
  const note = clean(req.body.note)
  const userId = req.user.id

  if (!note) {
    return res.status(400).json({ message: 'comment is required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query(
      `SELECT l.id, l."securityStatus", l.brand, l.model, l."serialNumber",
              owner."name" as owner_name, owner."studentId" as student_id
       FROM "Laptop" l
       JOIN "User" owner ON l."ownerId" = owner."id"
       WHERE l.id = $1 AND l."ownerId" = $2`,
      [id, userId]
    )
    const laptop = current.rows[0]
    if (!laptop) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Laptop not found' })
    }
    if (!['LOST', 'STOLEN'].includes(laptop.securityStatus)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Only lost or stolen laptops can be marked found' })
    }

    const updated = await client.query(
      `UPDATE "Laptop"
       SET "securityStatus" = 'ACTIVE',
           "recoveredAt" = NOW(),
           "recoveredById" = $1,
           "recoveryNote" = $2
       WHERE id = $3
       RETURNING *`,
      [userId, note, id]
    )

    await client.query(
      `INSERT INTO "lost_stolen_audit_logs"
       ("id", "laptopId", "action", "fromStatus", "toStatus", "reason", "actorId", "actorRole")
       VALUES ($1, $2, 'FOUND', $3, 'ACTIVE', $4, $5, $6)`,
      [crypto.randomUUID(), id, laptop.securityStatus, note, userId, req.user.role]
    )
    await client.query(
      `INSERT INTO "Notification" ("id", "type", "title", "body", "laptopId")
       VALUES ($1, 'LAPTOP_FOUND', $2, $3, $4)`,
      [
        crypto.randomUUID(),
        'Student Marked Laptop Found',
        `${laptop.owner_name} (${laptop.student_id || 'N/A'}) says ${laptop.brand} ${laptop.model} (${laptop.serialNumber}) has been found. Comment: ${note}`,
        id,
      ]
    )

    await client.query('COMMIT')
    res.json({
      message: 'Laptop marked as active. Admins have been notified that it was found.',
      laptop: laptopJson(updated.rows[0]),
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('NOTIFY LAPTOP FOUND ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  } finally {
    client.release()
  }
}

export const getLostStolenReports = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, owner."name" as owner_name, owner."studentId" as student_id,
              reporter."name" as reported_by_name,
              admin."name" as recovered_by_name
       FROM "Laptop" l
       JOIN "User" owner ON l."ownerId" = owner."id"
       LEFT JOIN "User" reporter ON l."reportedById" = reporter."id"
       LEFT JOIN "User" admin ON l."recoveredById" = admin."id"
       WHERE l."securityStatus" IN ('LOST', 'STOLEN')
          OR l."reportedAt" IS NOT NULL
       ORDER BY COALESCE(l."reportedAt", l."registeredAt") DESC`
    )
    res.json(result.rows.map(row => ({
      ...laptopJson(row),
      reported_by_name: row.reported_by_name,
      recovered_by_name: row.recovered_by_name,
    })))
  } catch (err) {
    console.error('GET LOST/STOLEN REPORTS ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const recoverLaptop = async (req, res) => {
  const { id } = req.params
  const note = clean(req.body.note)
  const adminId = req.user.id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query(
      `SELECT id, "securityStatus" FROM "Laptop" WHERE id = $1`,
      [id]
    )
    if (!current.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Laptop not found' })
    }

    const updated = await client.query(
      `UPDATE "Laptop"
       SET "securityStatus" = 'ACTIVE',
           "recoveredAt" = NOW(),
           "recoveredById" = $1,
           "recoveryNote" = $2
       WHERE id = $3
       RETURNING *`,
      [adminId, note || null, id]
    )
    await client.query(
      `INSERT INTO "lost_stolen_audit_logs"
       ("id", "laptopId", "action", "fromStatus", "toStatus", "reason", "actorId", "actorRole")
       VALUES ($1, $2, 'RECOVER', $3, 'ACTIVE', $4, $5, $6)`,
      [crypto.randomUUID(), id, current.rows[0].securityStatus || 'ACTIVE', note || null, adminId, req.user.role]
    )
    await client.query('COMMIT')
    res.json({ message: 'Laptop marked as recovered', laptop: laptopJson(updated.rows[0]) })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('RECOVER LAPTOP ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  } finally {
    client.release()
  }
}

// ─── Admin: transfer laptop ownership ────────────────────────────────────────
export const transferLaptop = async (req, res) => {
  const { id } = req.params
  const { targetStudentId } = req.body
  const adminId = req.user.id

  if (!targetStudentId) {
    return res.status(400).json({ message: 'targetStudentId is required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Verify laptop exists
    const laptopRes = await client.query(
      `SELECT id, "ownerId" FROM "Laptop" WHERE id = $1`,
      [id]
    )
    if (!laptopRes.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Laptop not found' })
    }
    const laptop = laptopRes.rows[0]

    // 2. Resolve target student to an activated User account
    const userRes = await client.query(
      `SELECT u.id FROM "User" u
       JOIN "Student" s ON u."studentId" = s.id
       WHERE s.id = $1 AND s."isActivated" = true`,
      [targetStudentId]
    )
    if (!userRes.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: `No activated user account found for student ${targetStudentId}` })
    }
    const targetUserId = userRes.rows[0].id

    // 3. Reject transfer to current owner
    if (laptop.ownerId === targetUserId) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Laptop is already owned by this student' })
    }

    // 4. Execute transfer + audit log in one transaction
    const updated = await client.query(
      `UPDATE "Laptop"
       SET "ownerId" = $1, "verificationStatus" = 'PENDING', "verifiedAt" = NULL, "verifiedById" = NULL
       WHERE id = $2
       RETURNING id, "ownerId", "verificationStatus", "verifiedAt", "verifiedById"`,
      [targetUserId, id]
    )

    const logId = crypto.randomUUID()
    await client.query(
      `INSERT INTO "laptop_transfer_logs" (id, "laptopId", "fromUserId", "toUserId", "transferredById")
       VALUES ($1, $2, $3, $4, $5)`,
      [logId, id, laptop.ownerId, targetUserId, adminId]
    )

    await client.query('COMMIT')

    const row = updated.rows[0]
    res.json({
      message: 'Laptop transferred successfully',
      laptop: {
        id: row.id,
        owner_id: row.ownerId,
        verification_status: row.verificationStatus,
        verified_at: row.verifiedAt,
        verified_by_id: row.verifiedById,
      },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('TRANSFER LAPTOP ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  } finally {
    client.release()
  }
}

// ─── Admin: get transfer logs for a laptop ────────────────────────────────────
export const getLaptopTransferLogs = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT
         tl.id,
         tl."laptopId"        AS laptop_id,
         tl."fromUserId"      AS from_user_id,
         fu.name              AS from_owner_name,
         fu."studentId"       AS from_student_id,
         tl."toUserId"        AS to_user_id,
         tu.name              AS to_owner_name,
         tu."studentId"       AS to_student_id,
         tl."transferredById" AS transferred_by_id,
         ab.name              AS transferred_by_name,
         tl."transferredAt"   AS transferred_at
       FROM "laptop_transfer_logs" tl
       JOIN "User" fu ON tl."fromUserId"      = fu.id
       JOIN "User" tu ON tl."toUserId"        = tu.id
       JOIN "User" ab ON tl."transferredById" = ab.id
       WHERE tl."laptopId" = $1
       ORDER BY tl."transferredAt" DESC`,
      [id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('GET TRANSFER LOGS ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}
