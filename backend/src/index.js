import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.routes.js'
import laptopRoutes from './routes/laptop.routes.js'
import gateRoutes from './routes/gate.routes.js'
import guestRoutes from './routes/guest.routes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/laptops', laptopRoutes)
app.use('/api/gate', gateRoutes)
app.use('/api/guests', guestRoutes)

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/_auth_routes', (req, res) => {
  const stack = authRoutes?.stack || []
  const routes = []
  for (const layer of stack) {
    if (layer?.route?.path) {
      const methods = Object.keys(layer.route.methods || {}).filter(Boolean)
      routes.push({ path: layer.route.path, methods })
    }
  }
  res.json({ count: routes.length, routes })
})

app.get('/api/_routes', (req, res) => {
  const router = app.router || app._router
  const stack = router?.stack || []

  const routes = []
  for (const layer of stack) {
    if (!layer) continue
    if (layer.route?.path) {
      const methods = Object.keys(layer.route.methods || {}).filter(Boolean)
      routes.push({ path: layer.route.path, methods })
      continue
    }
    // Mounted routers: layer.handle.stack contains route layers
    const mount = layer.regexp && layer.handle?.stack ? layer : null
    if (mount) {
      const mountPath = layer?.path || layer?.route?.path
      for (const sub of layer.handle.stack) {
        if (sub?.route?.path) {
          const methods = Object.keys(sub.route.methods || {}).filter(Boolean)
          routes.push({ path: `${mountPath || ''}${sub.route.path}`, methods })
        }
      }
    }
  }

  res.json({ count: routes.length, routes })
})

app.get('/', (req, res) => res.json({ message: 'AASTU Gate Pass API running' }))

const PORT = process.env.PORT || 5000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})