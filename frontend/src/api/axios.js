import axios from 'axios'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])
const isLocalHost = LOCAL_HOSTNAMES.has(window.location.hostname)

const DEPLOYED_API_URL =
  import.meta.env.VITE_API_URL || 'https://aastu-gate-backend.onrender.com/api'

const API = axios.create({
  // In local development, requests go through the Vite proxy (vite.config.js)
  // to the local backend. Deployed builds use Render (or VITE_API_URL).
  baseURL: isLocalHost ? '/api' : DEPLOYED_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token')
  if (token) {
    req.headers.Authorization = `Bearer ${token}`
  }
  return req
})

export default API