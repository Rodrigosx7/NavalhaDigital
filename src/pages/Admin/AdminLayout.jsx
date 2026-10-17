import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, Sparkles, Ticket, Star, FileDown, LogOut } from 'lucide-react'
import './AdminLayout.css'

export default function AdminLayout() {
  const navigate = useNavigate()
  const handleLogout = () => {
    sessionStorage.removeItem('navalha_admin_auth')
    navigate('/admin')
  }

  return (
    <div className="admin">
      <aside className="admin__sidebar">
        <div className="admin__brand">
          <span className="eyebrow">Painel</span>
          <strong>Navalha Digital</strong>
        </div>
        <nav className="admin__nav">
          <NavLink to="/admin/dashboard" end className={({ isActive }) => `admin__link ${isActive ? 'is-active' : ''}`}>
            <LayoutDashboard size={16} /> Hoje
          </NavLink>
          <NavLink to="/admin/agenda" className={({ isActive }) => `admin__link ${isActive ? 'is-active' : ''}`}>
            <CalendarDays size={16} /> Agenda semanal
          </NavLink>
          <NavLink to="/admin/servicos" className={({ isActive }) => `admin__link ${isActive ? 'is-active' : ''}`}>
            <Sparkles size={16} /> Serviços
          </NavLink>
          <NavLink to="/admin/cupons" className={({ isActive }) => `admin__link ${isActive ? 'is-active' : ''}`}>
            <Ticket size={16} /> Cupons
          </NavLink>
          <NavLink to="/admin/avaliacoes" className={({ isActive }) => `admin__link ${isActive ? 'is-active' : ''}`}>
            <Star size={16} /> Avaliações
          </NavLink>
          <NavLink to="/admin/relatorio" className={({ isActive }) => `admin__link ${isActive ? 'is-active' : ''}`}>
            <FileDown size={16} /> Relatório CSV
          </NavLink>
        </nav>
        <button className="admin__logout" onClick={handleLogout}>
          <LogOut size={14} /> Sair
        </button>
      </aside>
      <section className="admin__content">
        <Outlet />
      </section>
    </div>
  )
}
