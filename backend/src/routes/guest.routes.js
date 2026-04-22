import { Router } from 'express'
import { protect, allowRoles } from '../middleware/auth.middleware.js'
import {
  registerGuest,
  lookupGuest,
  guestEntry,
  guestExit,
} from '../controllers/guest.controller.js'

const router = Router()

// All guest routes require authentication and GUARD or ADMIN role
router.use(protect, allowRoles('GUARD', 'ADMIN'))

router.post('/register', registerGuest)
router.get('/lookup', lookupGuest)
router.post('/entry/:id', guestEntry)
router.post('/exit/:id', guestExit)

export default router
