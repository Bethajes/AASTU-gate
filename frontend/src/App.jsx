import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import StudentDashboard from './pages/StudentDashboard'
import GuardScanner from './pages/GuardScanner'
import GuardDashboard from './pages/GuardDashboard'
import AdminDashboard from './pages/AdminDashboard'

const PrivateRoute = ({ children, roles }) => {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/student" element={
          <PrivateRoute roles={['STUDENT']}>
            <StudentDashboard />
          </PrivateRoute>
        } />
        <Route path="/guard" element={
          <PrivateRoute roles={['GUARD']}>
            <GuardDashboard />
          </PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute roles={['ADMIN']}>
            <AdminDashboard />
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}