import crypto from 'crypto'
import pool from '../lib/db.js'

// POST /api/laptops/update-request
// Auth: STUDENT only
export const createUpdateRequest = async (req, res) => {
  const studentId = req.user.id
  const { laptopId, newBrand, newSerialNumber, reason } = req.body
  const newImage = req.file ? `/uploads/laptops/${req.file.filename}` : null

  // Validate at least one change field is provided
  if (!newBrand && !newSerialNumber && !newImage) {
    return res.status(400).json({
      message: 'At least one of newBrand, newSerialNumber, or photo must be provided',
    })
  }

  if (!laptopId) {
    return res.status(400).json({ message: 'laptopId is required' })
  }

  try {
    // Verify the laptop belongs to the requesting student
    const laptopCheck = await pool.query(
      `SELECT id FROM "Laptop" WHERE id = $1 AND "ownerId" = $2`,
      [laptopId, studentId]
    )
    if (!laptopCheck.rows[0]) {
      return res.status(403).json({ message: 'Forbidden: laptop does not belong to you' })
    }

    // Check for an existing PENDING request for the same laptop
    const pendingCheck = await pool.query(
      `SELECT id FROM "laptop_update_requests"
       WHERE "laptopId" = $1 AND status = 'PENDING'`,
      [laptopId]
    )
    if (pendingCheck.rows[0]) {
      return res.status(409).json({
        message: 'A pending update request already exists for this laptop',
      })
    }

    // Insert the new request
    const id = crypto.randomUUID()
    const result = await pool.query(
      `INSERT INTO "laptop_update_requests"
         ("id", "laptopId", "studentId", "newBrand", "newSerialNumber", "newImage", "reason", "status", "requestedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW())
       RETURNING *`,
      [id, laptopId, studentId, newBrand || null, newSerialNumber || null, newImage, reason || null]
    )

    const row = result.rows[0]
    res.status(201).json({
      message: 'Update request submitted',
      request: {
        id: row.id,
        laptop_id: row.laptopId,
        student_id: row.studentId,
        new_brand: row.newBrand,
        new_serial_number: row.newSerialNumber,
        new_image: row.newImage,
        reason: row.reason,
        status: row.status,
        requested_at: row.requestedAt,
      },
    })
  } catch (err) {
    console.error('CREATE UPDATE REQUEST ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: studentId,
      laptopId,
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// GET /api/laptops/update-request
// Auth: ADMIN | GUARD
export const listUpdateRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r."laptopId",
         r."studentId",
         r."newBrand",
         r."newSerialNumber",
         r."newImage",
         r.reason,
         r.status,
         r."requestedAt",
         r."reviewedAt",
         r."reviewedById",
         l.brand          AS current_brand,
         l."serialNumber" AS current_serial_number,
         l."photoUrl"     AS current_photo_url,
         l."verificationStatus" AS current_verification_status,
         u."name"         AS student_name,
         u."studentId"    AS student_number
       FROM "laptop_update_requests" r
       JOIN "Laptop" l ON r."laptopId" = l.id
       JOIN "User"   u ON r."studentId" = u.id
       ORDER BY r."requestedAt" DESC`
    )

    res.json(
      result.rows.map(row => ({
        id: row.id,
        laptop_id: row.laptopId,
        student_id: row.studentId,
        student_name: row.student_name,
        student_number: row.student_number,
        // current laptop data
        current_brand: row.current_brand,
        current_serial_number: row.current_serial_number,
        current_photo_url: row.current_photo_url,
        current_verification_status: row.current_verification_status,
        // proposed new data
        new_brand: row.newBrand,
        new_serial_number: row.newSerialNumber,
        new_image: row.newImage,
        reason: row.reason,
        status: row.status,
        requested_at: row.requestedAt,
        reviewed_at: row.reviewedAt,
        reviewed_by_id: row.reviewedById,
      }))
    )
  } catch (err) {
    console.error('LIST UPDATE REQUESTS ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// PUT /api/laptops/update-request/:id/approve
// Auth: ADMIN | GUARD
export const approveUpdateRequest = async (req, res) => {
  const { id } = req.params
  const reviewerId = req.user.id

  try {
    // Fetch the request
    const reqResult = await pool.query(
      `SELECT * FROM "laptop_update_requests" WHERE id = $1`,
      [id]
    )
    if (!reqResult.rows[0]) {
      return res.status(404).json({ message: 'Not found' })
    }

    const updateReq = reqResult.rows[0]

    if (updateReq.status !== 'PENDING') {
      return res.status(409).json({ message: 'Request is not in PENDING status' })
    }

    // Build dynamic SET clause for Laptop — only update non-null new values
    const laptopSets = [
      `"verificationStatus" = 'PENDING'`,
      `"verifiedAt" = NULL`,
      `"verifiedById" = NULL`,
    ]
    const laptopValues = []
    let idx = 1

    if (updateReq.newBrand) {
      laptopSets.push(`brand = $${idx++}`)
      laptopValues.push(updateReq.newBrand)
    }
    if (updateReq.newSerialNumber) {
      laptopSets.push(`"serialNumber" = $${idx++}`)
      laptopValues.push(updateReq.newSerialNumber)
    }
    if (updateReq.newImage) {
      laptopSets.push(`"photoUrl" = $${idx++}`)
      laptopValues.push(updateReq.newImage)
    }

    laptopValues.push(updateReq.laptopId)
    await pool.query(
      `UPDATE "Laptop" SET ${laptopSets.join(', ')} WHERE id = $${idx}`,
      laptopValues
    )

    // Update the request record
    const updated = await pool.query(
      `UPDATE "laptop_update_requests"
       SET status = 'APPROVED', "reviewedAt" = NOW(), "reviewedById" = $1
       WHERE id = $2
       RETURNING *`,
      [reviewerId, id]
    )

    const row = updated.rows[0]
    res.json({
      message: 'Update request approved',
      request: {
        id: row.id,
        status: row.status,
        reviewed_at: row.reviewedAt,
        reviewed_by_id: row.reviewedById,
      },
    })
  } catch (err) {
    console.error('APPROVE UPDATE REQUEST ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: reviewerId,
      requestId: id,
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// PUT /api/laptops/update-request/:id/reject
// Auth: ADMIN | GUARD
export const rejectUpdateRequest = async (req, res) => {
  const { id } = req.params
  const reviewerId = req.user.id

  try {
    // Fetch the request
    const reqResult = await pool.query(
      `SELECT * FROM "laptop_update_requests" WHERE id = $1`,
      [id]
    )
    if (!reqResult.rows[0]) {
      return res.status(404).json({ message: 'Not found' })
    }

    if (reqResult.rows[0].status !== 'PENDING') {
      return res.status(409).json({ message: 'Request is not in PENDING status' })
    }

    // Update request status only — Laptop row is left unchanged
    const updated = await pool.query(
      `UPDATE "laptop_update_requests"
       SET status = 'REJECTED', "reviewedAt" = NOW(), "reviewedById" = $1
       WHERE id = $2
       RETURNING *`,
      [reviewerId, id]
    )

    const row = updated.rows[0]
    res.json({
      message: 'Update request rejected',
      request: {
        id: row.id,
        status: row.status,
        reviewed_at: row.reviewedAt,
        reviewed_by_id: row.reviewedById,
      },
    })
  } catch (err) {
    console.error('REJECT UPDATE REQUEST ERROR:', {
      message: err.message,
      stack: err.stack,
      userId: reviewerId,
      requestId: id,
    })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}
