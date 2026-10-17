import { Link } from 'react-router-dom'
import { Scissors, CalendarDays, UserRound } from 'lucide-react'
import './Footer.css'

export default function Footer() {
  return <footer className="site-footer"><div className="container site-footer__inner"><div className="footer-brand"><h3 className="footer-brand__title">Navalha Digital</h3><p className="footer-brand__text">Serviços, profissionais e horários reunidos para organizar cada atendimento.</p></div><div className="footer-col"><h4 className="footer-col__title">Sua visita</h4><ul className="footer-col__list"><li><CalendarDays size={14} /><Link to="/agendar">Consultar horários e reservar</Link></li><li><UserRound size={14} /><Link to="/meus-agendamentos">Meus agendamentos</Link></li><li>Pagamento exclusivamente presencial.</li></ul></div><div className="footer-col"><h4 className="footer-col__title">Conheça o projeto</h4><ul className="footer-col__list"><li><Link to="/sobre">Sobre o Navalha Digital</Link></li><li><Link to="/contato">Informações de atendimento</Link></li><li><Scissors size={14} /><Link to="/barbeiro">Área do barbeiro</Link></li></ul></div></div><div className="footer-bar container"><p>© {new Date().getFullYear()} Navalha Digital</p><p>Horários conforme as janelas de cada profissional.</p></div></footer>
}
