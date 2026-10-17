import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext.jsx'
import { BookingProvider } from './contexts/BookingContext.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'
import HomePage from './pages/Home/HomePage.jsx'
import AboutPage from './pages/About/AboutPage.jsx'
import ContactPage from './pages/Contact/ContactPage.jsx'
import NotFoundPage from './pages/NotFound/NotFoundPage.jsx'
import Access, { Account } from './pages/System/Access.jsx'
import Booking, { Confirmation } from './pages/System/Booking.jsx'
import Agenda, { BarberLayout } from './pages/System/Agenda.jsx'
import Management from './pages/System/Management.jsx'
import Report from './pages/System/Report.jsx'
import { Protegido } from './pages/System/shared.jsx'

export default function App() {
  return <ToastProvider><AuthProvider><BookingProvider><Header /><main><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/entrar" element={<Access />} />
    <Route path="/cadastro" element={<Access cadastro />} />
    <Route path="/conta" element={<Protegido><Account /></Protegido>} />
    <Route path="/agendar" element={<Protegido><Booking /></Protegido>} />
    <Route path="/confirmacao" element={<Protegido><Confirmation /></Protegido>} />
    <Route path="/meus-agendamentos" element={<Protegido><Agenda /></Protegido>} />
    <Route path="/sobre" element={<AboutPage />} />
    <Route path="/contato" element={<ContactPage />} />
    <Route path="/barbeiro" element={<Protegido profissional><BarberLayout /></Protegido>}>
      <Route index element={<Agenda profissional />} />
      <Route path="semana" element={<Agenda profissional semanal />} />
      <Route path="novo" element={<Booking />} />
      <Route path="alterar/:id" element={<Booking />} />
      <Route path="servicos" element={<Management />} />
      <Route path="horarios" element={<Management janelas />} />
      <Route path="relatorio" element={<Report />} />
    </Route>
    <Route path="/admin" element={<Navigate to="/barbeiro" replace />} />
    <Route path="/admin/dashboard" element={<Navigate to="/barbeiro" replace />} />
    <Route path="/admin/agenda" element={<Navigate to="/barbeiro/semana" replace />} />
    <Route path="/admin/servicos" element={<Navigate to="/barbeiro/servicos" replace />} />
    <Route path="/admin/relatorio" element={<Navigate to="/barbeiro/relatorio" replace />} />
    <Route path="/admin/*" element={<Navigate to="/barbeiro" replace />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></main><Footer /></BookingProvider></AuthProvider></ToastProvider>
}
