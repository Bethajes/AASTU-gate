import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { register, login, forgotPassword, resetPassword, activateStudent, setPassword, sendOtp, verifyOtp, checkEmail, changePassword } from '../controllers/auth.controller.js'
import { protect, allowRoles } from '../middleware/auth.middleware.js'

const router = Router()

const activateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later' },
})

const sendOtpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later' },
})

router.post('/register', register)
router.get('/check-email', checkEmail)
router.post('/change-password', protect, allowRoles('ADMIN'), changePassword)
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.post('/activate', activateRateLimiter, activateStudent)
router.post('/set-password', setPassword)
router.post('/send-otp', sendOtpRateLimiter, sendOtp)
router.post('/verify-otp', verifyOtp)

export default router
