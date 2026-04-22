import { Router } from 'express'
import { registerLaptop, getMyLaptops, getAllLaptops, regenerateCode, updatePhoto, getLaptopByCode, editLaptop } from '../controllers/laptop.controller.js'
import { protect, allowRoles } from '../middleware/auth.middleware.js'
import upload from '../middleware/upload.js'

const router = Router()

router.post('/register', protect, allowRoles('STUDENT'), upload.single('photo'), registerLaptop)
router.get('/my', protect, allowRoles('STUDENT'), getMyLaptops)
router.get('/all', protect, allowRoles('ADMIN', 'GUARD'), getAllLaptops)
router.get('/code/:code', protect, allowRoles('ADMIN', 'GUARD'), getLaptopByCode)
router.post('/:id/regenerate-code', protect, allowRoles('STUDENT'), regenerateCode)
router.post('/:id/update-photo', protect, allowRoles('STUDENT'), upload.single('photo'), updatePhoto)
router.put('/:id', protect, allowRoles('STUDENT'), upload.single('photo'), editLaptop)

export default router