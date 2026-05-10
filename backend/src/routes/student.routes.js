import { Router } from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { createStudent, listStudents, getStudent, updateStudent, deleteStudent, uploadStudentPhotos } from '../controllers/student.controller.js'
import { protect, allowRoles } from '../middleware/auth.middleware.js'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const tmpUploadDir = path.join(__dirname, '../../uploads/tmp')

const zipStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(tmpUploadDir, { recursive: true })
    cb(null, tmpUploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`)
  },
})

const zipUpload = multer({
  storage: zipStorage,
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isZip = path.extname(file.originalname).toLowerCase() === '.zip'
    if (!isZip) return cb(new Error('Only ZIP files are allowed'))
    cb(null, true)
  },
})

router.post('/',     protect, allowRoles('ADMIN'), createStudent)
router.post('/photos', protect, allowRoles('ADMIN'), zipUpload.single('photos'), uploadStudentPhotos)
router.get('/',      protect, allowRoles('ADMIN'), listStudents)
router.get('/:id',   protect, allowRoles('ADMIN'), getStudent)
router.put('/:id',   protect, allowRoles('ADMIN'), updateStudent)
router.delete('/:id', protect, allowRoles('ADMIN'), deleteStudent)

export default router
