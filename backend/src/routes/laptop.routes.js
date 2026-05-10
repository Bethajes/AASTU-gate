import { Router } from 'express'
import { registerLaptop, getMyLaptops, getAllLaptops, regenerateCode, updatePhoto, getLaptopByCode, editLaptop, getLaptopsByStudent, deleteLaptop, adminRegisterLaptop, adminUpdateLaptopPhoto } from '../controllers/laptop.controller.js'
import { protect, allowRoles } from '../middleware/auth.middleware.js'
import upload from '../middleware/upload.js'

const router = Router()

router.post('/register', protect, allowRoles('STUDENT'), upload.single('photo'), registerLaptop)
router.post('/admin-register', protect, allowRoles('ADMIN'), upload.single('photo'), adminRegisterLaptop)
router.get('/my', protect, allowRoles('STUDENT'), getMyLaptops)
router.get('/all', protect, allowRoles('ADMIN', 'GUARD'), getAllLaptops)
router.get('/by-student/:studentId', protect, allowRoles('ADMIN'), getLaptopsByStudent)
router.get('/code/:code', protect, allowRoles('ADMIN', 'GUARD'), getLaptopByCode)
router.post('/:id/admin-update-photo', protect, allowRoles('ADMIN'), upload.single('photo'), adminUpdateLaptopPhoto)
router.post('/:id/regenerate-code', protect, allowRoles('STUDENT'), regenerateCode)
router.post('/:id/update-photo', protect, allowRoles('STUDENT'), upload.single('photo'), updatePhoto)
router.put('/:id', protect, allowRoles('STUDENT'), upload.single('photo'), editLaptop)
router.delete('/:id', protect, allowRoles('ADMIN'), deleteLaptop)

export default router