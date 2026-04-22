import QRCode from 'qrcode'
import pool from '../lib/db.js'
import crypto from 'crypto'

// Generate 8-digit code
const generate8DigitCode = () => {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

const isUniqueViolation = (err) =>
  err && (err.code === '23505' || /duplicate key value violates unique constraint/i.test(err.message || ''))

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
      `INSERT INTO "Laptop" ("id", "serialNumber", "brand", "model", "qrCode", "ownerId", "photoUrl")
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, serialNumber, brand, model, qrData, ownerId, photoUrl]
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
    console.error('REGISTER LAPTOP ERROR:', err)
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
    res.json(result.rows.map(row => ({
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
      photo_url: row.photoUrl,
      verification_status: row.verificationStatus,
      verified_at: row.verifiedAt,
      verified_by_name: row.verified_by_name,
    })))
  } catch (err) {
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
    res.json(result.rows.map(row => ({
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
      photo_url: row.photoUrl,
      verification_status: row.verificationStatus,
      verified_at: row.verifiedAt,
      verified_by_name: row.verified_by_name,
    })))
  } catch (err) {
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
    console.error('REGENERATE CODE ERROR:', err)
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
    console.error('UPDATE PHOTO ERROR:', err)
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
    console.error('EDIT LAPTOP ERROR:', err)
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
    res.json({
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
      photo_url: row.photoUrl,
      verification_status: row.verificationStatus,
      verified_at: row.verifiedAt,
      verified_by_name: row.verified_by_name,
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}
