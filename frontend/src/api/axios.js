import axios from 'axios'

const API = axios.create({
  // This checks if the app is running on localhost. 
  // If it is, it uses your local backend; otherwise, it uses the Render URL.
  baseURL: window.location.hostname === 'localhost' 
    ? 'http://localhost:5001/api' 
    : 'https://aastu-gate-backend.onrender.com/api',
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