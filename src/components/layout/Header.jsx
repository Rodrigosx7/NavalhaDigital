import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { Scissors, Menu, X, LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import './Header.css'

export default function Header() {
  const { usuario, sair } = useAuth(), navigate = useNavigate()
  const [aberto, setAberto] = useState(false), [erro, setErro] = useState(''), [saindo, setSaindo] = useState(false)
  async function encerrar() { setSaindo(true); try { await sair(); setAberto(false); navigate('/entrar') } catch (error) { setErro(error.message) } finally { setSaindo(false) } }
  return <header className="site-header"><div className="container site-header__inner">
    <Link to="/" className="brand"><span className="brand__monogram" aria-hidden="true"><Scissors size={18} /></span><span className="brand__text"><strong className="brand__name">Navalha</strong><span className="brand__surname">Digital</span></span></Link>
    <button type="button" className="site-menu-toggle" aria-label={aberto ? 'Fechar menu' : 'Abrir menu'} aria-expanded={aberto} aria-controls="navegacao-principal" onClick={() => setAberto(!aberto)}>{aberto ? <X size={22} /> : <Menu size={22} />}</button>
    <nav id="navegacao-principal" className={'site-nav ' + (aberto ? 'is-open' : '')} aria-label="Navegação principal" onClick={() => setAberto(false)}>
      <NavLink className="nav-link" to="/" end>Início</NavLink><NavLink className="nav-link" to="/agendar">Agendar</NavLink><NavLink className="nav-link" to="/meus-agendamentos">Meus agendamentos</NavLink>
      {usuario?.perfil === 'BARBEIRO' && <NavLink className="nav-link" to="/barbeiro">Minha agenda</NavLink>}
      <NavLink className="nav-link" to="/sobre">Sobre</NavLink>
    </nav>
    <div className="header-account">{usuario ? <><Link to="/conta" className="header-admin"><UserRound size={15} /><span>Minha conta</span></Link><button type="button" className="header-logout" aria-label="Sair da conta" disabled={saindo} onClick={encerrar}><LogOut size={17} /></button></> : <Link to="/entrar" className="header-admin"><UserRound size={15} /><span>Entrar</span></Link>}</div>
  </div>{erro && <p role="alert" className="sys-error">{erro}</p>}</header>
}
