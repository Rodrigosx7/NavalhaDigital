import { Navigate, Outlet } from 'react-router-dom'

export default function RequireAdmin() {
  const isAuthed = sessionStorage.getItem('navalha_admin_auth') === 'true'
  if (!isAuthed) return <Navigate to="/admin" replace />
  return <Outlet />
}
