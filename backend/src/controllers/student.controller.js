import pool from '../lib/db.js'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import unzipper from 'unzipper'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const AASTU_STUDENT_ID_PATTERN = /^[A-Z]+\d+\/\d{2}$/i
const AASTU_STUDENT_ID_SQL_PATTERN = '^[A-Z]+[0-9]+/[0-9]{2}$'
const PHOTO_UPLOAD_DIR = path.join(__dirname, '../../uploads/photos')
const PUBLIC_PHOTO_DIR = 'uploads/photos'
const ALLOWED_PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

function hasValidImageSignature(buffer, ext) {
  if (ext === '.jpg' || ext === '.jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (ext === '.png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (ext === '.webp') {
    return buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP'
  }
  if (ext === '.gif') {
    const signature = buffer.slice(0, 6).toString('ascii')
    return signature === 'GIF87a' || signature === 'GIF89a'
  }
  return false
}

export function usernameFromStudentId(studentId) {
  return String(studentId || '').trim().replace(/\//g, '')
}

function normalizeStudentPayload(body) {
  const studentId = String(body.student_id ?? body.id ?? '').trim()
  const fullName = String(body.full_name ?? body.name ?? '').trim()
  const department = String(body.department ?? '').trim()
  const photo = body.photo ? String(body.photo).trim() : null
  const username = usernameFromStudentId(studentId)

  return { studentId, username, fullName, department, photo }
}

export const createStudent = async (req, res) => {
  const { studentId, username, fullName, department, photo } = normalizeStudentPayload(req.body)
  if (!studentId || !fullName || !department) {
    return res.status(400).json({ message: 'student_id, full_name, and department are required' })
  }
  if (!AASTU_STUDENT_ID_PATTERN.test(studentId)) {
    return res.status(400).json({ message: 'Student ID must use AASTU format, e.g. ETS023/15' })
  }
  try {
    const result = await pool.query(
      `INSERT INTO "Student" ("id", "username", "name", "email", "photo", "department", "isActivated")
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING "id", "username", "name", "email", "photo", "department", "isActivated"`,
      [studentId, username, fullName, null, photo, department]
    )
    const student = result.rows[0]
    return res.status(201).json({
      student: {
        ...student,
        student_id: student.id,
        full_name: student.name,
      },
    })
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'Student_username_key') {
        return res.status(409).json({ message: 'A student record with this username already exists' })
      }
      return res.status(409).json({ message: 'A student record with this ID or email already exists' })
    }
    console.error('CREATE STUDENT ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const uploadSinglePhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' })
  }
  const photoPath = `${PUBLIC_PHOTO_DIR}/${req.file.filename}`
  return res.status(201).json({ photo: photoPath })
}

export const listStudents = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT "id", "id" AS student_id, "username", "name", "name" AS full_name,
              "email", "photo", "department", "isActivated"
       FROM "Student"
       WHERE "id" ~* $1
       ORDER BY "name" ASC`,
      [AASTU_STUDENT_ID_SQL_PATTERN]
    )
    res.json({ students: result.rows })
  } catch (err) {
    console.error('LIST STUDENTS ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const getStudent = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT "id", "id" AS student_id, "username", "name", "name" AS full_name,
              "email", "photo", "department", "isActivated"
       FROM "Student"
       WHERE "id" = $1 AND "id" ~* $2`,
      [id, AASTU_STUDENT_ID_SQL_PATTERN]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' })
    res.json({ student: result.rows[0] })
  } catch (err) {
    console.error('GET STUDENT ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const updateStudent = async (req, res) => {
  const { id } = req.params
  const { name, email, photo, department } = req.body
  if (!name && !email && !photo && !department) {
    return res.status(400).json({ message: 'Provide at least one field to update' })
  }
  try {
    const sets = []
    const values = []
    let idx = 1
    if (name)       { sets.push(`"name" = $${idx++}`);       values.push(name) }
    if (email)      { sets.push(`"email" = $${idx++}`);      values.push(email) }
    if (photo)      { sets.push(`"photo" = $${idx++}`);      values.push(photo) }
    if (department) { sets.push(`"department" = $${idx++}`); values.push(department) }
    values.push(id)
    const result = await pool.query(
      `UPDATE "Student" SET ${sets.join(', ')} WHERE "id" = $${idx}
       RETURNING "id", "name", "email", "photo", "department", "isActivated"`,
      values
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' })
    res.json({ student: result.rows[0] })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email already in use by another student' })
    }
    console.error('UPDATE STUDENT ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const deleteStudent = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `DELETE FROM "Student" WHERE "id" = $1 RETURNING "id"`,
      [id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' })
    res.json({ message: 'Student deleted' })
  } catch (err) {
    console.error('DELETE STUDENT ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const uploadStudentPhotos = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'ZIP file is required' })
  }

  const summary = {
    matched: 0,
    skippedUnmatched: 0,
    skippedNonImage: 0,
    skippedDuplicate: 0,
    failed: 0,
    updated: [],
    skipped: [],
  }

  try {
    await fsp.mkdir(PHOTO_UPLOAD_DIR, { recursive: true })

    const studentsResult = await pool.query(
      `SELECT "username" FROM "Student" WHERE "id" ~* $1`,
      [AASTU_STUDENT_ID_SQL_PATTERN]
    )
    const knownUsernames = new Set(studentsResult.rows.map(row => row.username))
    const seenInZip = new Set()
    const zip = await unzipper.Open.file(req.file.path)

    for (const entry of zip.files) {
      if (entry.type === 'Directory') continue

      const entryName = path.basename(entry.path)
      const ext = path.extname(entryName).toLowerCase()
      const username = path.basename(entryName, ext)

      if (!ALLOWED_PHOTO_EXTENSIONS.has(ext)) {
        summary.skippedNonImage++
        summary.skipped.push({ file: entry.path, reason: 'Unsupported image format' })
        continue
      }

      if (!knownUsernames.has(username)) {
        summary.skippedUnmatched++
        summary.skipped.push({ file: entry.path, reason: 'No student username match' })
        continue
      }

      if (seenInZip.has(username)) {
        summary.skippedDuplicate++
        summary.skipped.push({ file: entry.path, reason: 'Duplicate username in ZIP' })
        continue
      }
      seenInZip.add(username)

      const storedFileName = `${username}${ext}`
      const destination = path.join(PHOTO_UPLOAD_DIR, storedFileName)
      if (fs.existsSync(destination)) {
        summary.skippedDuplicate++
        summary.skipped.push({ file: entry.path, reason: 'Photo already exists' })
        continue
      }

      try {
        await new Promise((resolve, reject) => {
          entry
            .stream()
            .pipe(fs.createWriteStream(destination, { flags: 'wx' }))
            .on('finish', resolve)
            .on('error', reject)
        })

        const header = await fsp.open(destination, 'r')
          .then(async fileHandle => {
            const buffer = Buffer.alloc(12)
            const { bytesRead } = await fileHandle.read(buffer, 0, 12, 0)
            await fileHandle.close()
            return buffer.subarray(0, bytesRead)
          })

        if (!hasValidImageSignature(header, ext)) {
          await fsp.rm(destination, { force: true })
          summary.skippedNonImage++
          summary.skipped.push({ file: entry.path, reason: 'Invalid image file' })
          continue
        }

        const photoPath = `${PUBLIC_PHOTO_DIR}/${storedFileName}`
        await pool.query(
          `UPDATE "Student" SET "photo" = $1 WHERE "username" = $2`,
          [photoPath, username]
        )

        summary.matched++
        summary.updated.push({ username, photo: photoPath })
      } catch (err) {
        summary.failed++
        summary.skipped.push({ file: entry.path, reason: err.message })
      }
    }

    res.json({
      message: 'Photo ZIP processed',
      ...summary,
    })
  } catch (err) {
    console.error('UPLOAD STUDENT PHOTOS ERROR:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  } finally {
    if (req.file?.path) {
      await fsp.rm(req.file.path, { force: true }).catch(() => {})
    }
  }
}
