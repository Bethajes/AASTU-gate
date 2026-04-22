import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'aastusecretkey123'

export const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'No token provided' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ message: 'Invalid token' })
  }
}

export const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    console.warn(`Access denied: user role="${req.user.role}" not in [${roles.join(', ')}]`)
    return res.status(403).json({ message: `Access denied: your role is "${req.user.role}"` })
  }
  next()
}