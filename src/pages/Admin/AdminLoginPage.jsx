import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Lock, ArrowRight, Scissors } from 'lucide-react'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import './AdminLoginPage.css'

export default function AdminLoginPage() {
  const isAuthed = sessionStorage.getItem('navalha_admin_auth') === 'true'
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  if (isAuthed) return <Navigate to="/admin/dashboard" replace />

  const handleSubmit = (e) => {
    e.preventDefault()
    if (user === 'admin' && pass === '1234') {
      sessionStorage.setItem('navalha_admin_auth', 'true')
      navigate('/admin/dashboard')
    } else {
      setError('Usuário ou senha incorretos.')
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__bg" />
      <div className="container admin-login__container">
        <Card ornament padding="xl" className="admin-login__card">
          <div className="admin-login__brand">
            <span className="admin-login__monogram"><Scissors size={22} /></span>
            <span className="eyebrow">— Painel administrativo —</span>
            <h1>Navalha Digital</h1>
          </div>

          <form onSubmit={handleSubmit} className="admin-login__form">
            <Input
              label="Usuário"
              value={user}
              onChange={(e) => { setUser(e.target.value); setError('') }}
              placeholder="admin"
              autoComplete="username"
            />
            <Input
              label="Senha"
              type="password"
              value={pass}
              onChange={(e) => { setPass(e.target.value); setError('') }}
              placeholder="••••"
              autoComplete="current-password"
            />
            {error && <p className="admin-login__error">{error}</p>}
            <Button type="submit" size="lg" fullWidth icon={<ArrowRight size={16} />} iconRight={<Lock size={16} />}>
              Entrar no painel
            </Button>
          </form>

          <p className="admin-login__demo">
            <strong>Demo:</strong> usuário <code>admin</code> · senha <code>1234</code>
          </p>
        </Card>
      </div>
    </div>
  )
}
