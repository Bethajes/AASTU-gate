import { Router } from 'express'
import {
  scanLaptop,
  getLogs,
  lookupLaptop,
  verifyLaptop,
  blockLaptop,
  logEntry,
  logExit,
} from '../controllers/gate.controller.js'
import { protect, allowRoles } from '../middleware/auth.middleware.js'

const router = Router()

// Existing routes (preserved)
router.post('/scan', protect, allowRoles('GUARD'), scanLaptop)
router.get('/logs', protect, allowRoles('ADMIN', 'GUARD'), getLogs)

// New routes — all require GUARD or ADMIN
router.get('/lookup', protect, allowRoles('GUARD', 'ADMIN'), lookupLaptop)
router.post('/verify/:laptopId', protect, allowRoles('GUARD', 'ADMIN'), verifyLaptop)
router.post('/entry/:laptopId', protect, allowRoles('GUARD', 'ADMIN'), logEntry)
router.post('/exit/:laptopId', protect, allowRoles('GUARD', 'ADMIN'), logExit)
router.post('/block/:laptopId', protect, allowRoles('GUARD', 'ADMIN'), blockLaptop)

export default router
