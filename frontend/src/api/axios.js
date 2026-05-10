import axios from 'axios'

const API = axios.create({
// Change Line 4 to this:
baseURL: import.meta.env.VITE_API_URL || 'https://aastu-api.onrender.com',  headers: {
    'Content-Type': 'application/json',
  },
})
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token')
  if (token) req.headers.Authorization = `Bearer ${token}`
  return req
})

export default API