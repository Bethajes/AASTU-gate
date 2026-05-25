import { afterEach, describe, expect, it } from 'vitest'
import crypto from 'crypto'
import pool from '../lib/db.js'
import { adminRegisterLaptop, notifyLaptopFound, recoverLaptop, reportLaptopSecurityStatus } from '../controllers/laptop.controller.js'
import { logExit } from '../controllers/gate.controller.js'

const createdLaptopIds = []
const createdUserIds = []
const createdStudentIds = []

function makeReqRes({ body = {}, user = {} } = {}) {
  const req = { body, user, file: null }
  let statusCode = 200
  let responseBody = null
  const res = {
    status(code) { statusCode = code; return res },
    json(body) { responseBody = body; return res },
    get statusCode() { return statusCode },
    get body() { return responseBody },
  }
  return { req, res }
}

async function makeStudentUser() {
  const id = crypto.randomUUID()
  const suffix = id.slice(0, 8)
  const studentId = `ETS${suffix}/16`
  const userId = crypto.randomUUID()

  await pool.query(
    `INSERT INTO "Student" (id, username, name, email, department, "isActivated")
     VALUES ($1, $2, $3, $4, $5, true)`,
    [studentId, `user_${suffix}`, `Test Student ${suffix}`, `${suffix}@student.test`, 'CS']
  )
  await pool.query(
    `INSERT INTO "User" (id, name, email, password, role, "studentId")
     VALUES ($1, $2, $3, 'hashed', 'STUDENT'::"Role", $4)`,
    [userId, `Test Student ${suffix}`, `${suffix}@user.test`, studentId]
  )

  createdStudentIds.push(studentId)
  createdUserIds.push(userId)
  return { userId, studentId }
}

afterEach(async () => {
  if (createdLaptopIds.length) {
    await pool.query(`DELETE FROM "Notification" WHERE "laptopId" = ANY($1)`, [createdLaptopIds])
    await pool.query(`DELETE FROM "lost_stolen_audit_logs" WHERE "laptopId" = ANY($1)`, [createdLaptopIds])
    await pool.query(`DELETE FROM "Laptop" WHERE id = ANY($1)`, [createdLaptopIds])
    createdLaptopIds.length = 0
  }
  if (createdUserIds.length) {
    await pool.query(`DELETE FROM "User" WHERE id = ANY($1)`, [createdUserIds])
    createdUserIds.length = 0
  }
  if (createdStudentIds.length) {
    await pool.query(`DELETE FROM "Student" WHERE id = ANY($1)`, [createdStudentIds])
    createdStudentIds.length = 0
  }
})

describe('guard laptop registration', () => {
  it('requires name and phone for guard registrations', async () => {
    const { studentId } = await makeStudentUser()
    const { req, res } = makeReqRes({
      user: { id: crypto.randomUUID(), role: 'GUARD' },
      body: {
        studentId,
        serialNumber: `SN-${crypto.randomUUID()}`,
        brand: 'Dell',
        model: 'Latitude',
      },
    })

    await adminRegisterLaptop(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('name and phone are required')
  })

  it('stores and returns guard-entered registrant contact fields', async () => {
    const { studentId } = await makeStudentUser()
    const serialNumber = `SN-${crypto.randomUUID()}`
    const { req, res } = makeReqRes({
      user: { id: crypto.randomUUID(), role: 'GUARD' },
      body: {
        name: '  Guard Entered Name  ',
        phone: '  0912345678  ',
        studentId,
        serialNumber,
        brand: 'HP',
        model: 'EliteBook',
      },
    })

    await adminRegisterLaptop(req, res)

    expect(res.statusCode).toBe(201)
    expect(res.body.laptop.registrant_name).toBe('Guard Entered Name')
    expect(res.body.laptop.registrant_phone).toBe('0912345678')
    createdLaptopIds.push(res.body.laptop.id)

    const dbRow = await pool.query(
      `SELECT "registrantName", "registrantPhone" FROM "Laptop" WHERE id = $1`,
      [res.body.laptop.id]
    )
    expect(dbRow.rows[0].registrantName).toBe('Guard Entered Name')
    expect(dbRow.rows[0].registrantPhone).toBe('0912345678')
  })

  it('creates a lightweight owner record when a guard registers a laptop for a student without an account', async () => {
    const studentId = `Ets${crypto.randomUUID().slice(0, 6)}`
    const { req, res } = makeReqRes({
      user: { id: crypto.randomUUID(), role: 'GUARD' },
      body: {
        name: 'Bethel Guard Registrant',
        phone: '+251966114216',
        studentId,
        serialNumber: `SN-${crypto.randomUUID()}`,
        brand: 'Lenovo',
        model: 'ThinkPad',
      },
    })

    await adminRegisterLaptop(req, res)

    expect(res.statusCode).toBe(201)
    expect(res.body.laptop.owner_id).toBeTruthy()
    expect(res.body.laptop.owner_name).toBe('Bethel Guard Registrant')
    expect(res.body.laptop.student_id).toBe(studentId)
    expect(res.body.laptop.registrant_phone).toBe('+251966114216')

    createdLaptopIds.push(res.body.laptop.id)
    createdUserIds.push(res.body.laptop.owner_id)
    createdStudentIds.push(studentId)

    const dbRow = await pool.query(
      `SELECT l."ownerId", u.name, u."studentId", s."isActivated"
       FROM "Laptop" l
       JOIN "User" u ON l."ownerId" = u.id
       JOIN "Student" s ON u."studentId" = s.id
       WHERE l.id = $1`,
      [res.body.laptop.id]
    )
    expect(dbRow.rows[0].name).toBe('Bethel Guard Registrant')
    expect(dbRow.rows[0].studentId).toBe(studentId)
    expect(dbRow.rows[0].isActivated).toBe(false)
  })
})

describe('lost and stolen laptop reporting', () => {
  it('lets a student report a laptop as stolen and lets admin recover it', async () => {
    const { userId } = await makeStudentUser()
    const laptopId = crypto.randomUUID()
    await pool.query(
      `INSERT INTO "Laptop" (id, "serialNumber", brand, model, "qrCode", "ownerId", "verificationStatus")
       VALUES ($1, $2, 'Dell', 'XPS', $3, $4, 'VERIFIED'::"VerificationStatus")`,
      [laptopId, `SN-${crypto.randomUUID()}`, Math.floor(10000000 + Math.random() * 90000000).toString(), userId]
    )
    createdLaptopIds.push(laptopId)

    const { req: reportReq, res: reportRes } = makeReqRes({
      user: { id: userId, role: 'STUDENT' },
      body: { status: 'STOLEN', reason: 'Taken from library desk' },
    })
    reportReq.params = { id: laptopId }
    await reportLaptopSecurityStatus(reportReq, reportRes)

    expect(reportRes.statusCode).toBe(200)
    expect(reportRes.body.laptop.security_status).toBe('STOLEN')

    const { req: exitReq, res: exitRes } = makeReqRes({
      user: { id: crypto.randomUUID(), role: 'GUARD' },
    })
    exitReq.params = { laptopId }
    await logExit(exitReq, exitRes)
    expect(exitRes.statusCode).toBe(403)
    expect(exitRes.body.message).toContain('reported stolen')

    const adminId = crypto.randomUUID()
    const { req: recoverReq, res: recoverRes } = makeReqRes({
      user: { id: adminId, role: 'ADMIN' },
      body: { note: 'Returned by campus security' },
    })
    recoverReq.params = { id: laptopId }
    await recoverLaptop(recoverReq, recoverRes)

    expect(recoverRes.statusCode).toBe(200)
    expect(recoverRes.body.laptop.security_status).toBe('ACTIVE')

    const audit = await pool.query(
      `SELECT action, "toStatus" FROM "lost_stolen_audit_logs" WHERE "laptopId" = $1 ORDER BY "createdAt" ASC`,
      [laptopId]
    )
    expect(audit.rows.map(r => `${r.action}:${r.toStatus}`)).toEqual(['REPORT:STOLEN', 'RECOVER:ACTIVE'])
  })

  it('lets a student notify admins when a reported laptop is found', async () => {
    const { userId } = await makeStudentUser()
    const laptopId = crypto.randomUUID()
    await pool.query(
      `INSERT INTO "Laptop" (id, "serialNumber", brand, model, "qrCode", "ownerId", "securityStatus")
       VALUES ($1, $2, 'HP', 'EliteBook', $3, $4, 'LOST')`,
      [laptopId, `SN-${crypto.randomUUID()}`, Math.floor(10000000 + Math.random() * 90000000).toString(), userId]
    )
    createdLaptopIds.push(laptopId)

    const { req, res } = makeReqRes({
      user: { id: userId, role: 'STUDENT' },
      body: { note: 'I found it in the lab.' },
    })
    req.params = { id: laptopId }
    await notifyLaptopFound(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.laptop.security_status).toBe('ACTIVE')

    const laptop = await pool.query(
      `SELECT "securityStatus", "recoveryNote" FROM "Laptop" WHERE id = $1`,
      [laptopId]
    )
    expect(laptop.rows[0].securityStatus).toBe('ACTIVE')
    expect(laptop.rows[0].recoveryNote).toBe('I found it in the lab.')

    const notification = await pool.query(
      `SELECT type, title, body FROM "Notification" WHERE "laptopId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [laptopId]
    )
    expect(notification.rows[0].type).toBe('LAPTOP_FOUND')
    expect(notification.rows[0].body).toContain('I found it in the lab.')

    const audit = await pool.query(
      `SELECT action, "fromStatus", "toStatus" FROM "lost_stolen_audit_logs" WHERE "laptopId" = $1`,
      [laptopId]
    )
    expect(audit.rows[0]).toMatchObject({ action: 'FOUND', fromStatus: 'LOST', toStatus: 'ACTIVE' })
  })
})
