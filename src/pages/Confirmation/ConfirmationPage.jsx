import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMemo } from 'react'
import { CheckCircle2, Calendar, Clock, Scissors, User2, ArrowLeft, ExternalLink, Copy } from 'lucide-react'
import Button from '../../components/ui/Button.jsx'
import { useBooking } from '../../contexts/BookingContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import { formatCurrency } from '../../utils/validation.js'
import { formatPtBR } from '../../utils/dateUtils.js'
import './ConfirmationPage.css'

function buildGoogleCalendarUrl({ service, barber, date, time, customerName }) {
  const [h, m] = time.split(':').map(Number)
  const start = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
  const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000)
  const fmt = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const text = encodeURIComponent(`${service.name} — Navalha Digital`)
  const details = encodeURIComponent(
    `Agendamento confirmado em Navalha Digital.\n` +
    `Cliente: ${customerName}\n` +
    `Barbeiro: ${barber?.name || 'Qualquer disponível'}\n` +
    `Duração: ${service.durationMinutes} min`,
  )
  const location = encodeURIComponent('Rua das Tesouras, 42 — Centro')
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`
}

export default function ConfirmationPage() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const navigate = useNavigate()
  const { appointments, getServiceById, getBarberById } = useBooking()
  const { show } = useToast()

  const appt = useMemo(() => appointments.find((a) => a.id === id), [appointments, id])
  if (!appt) {
    return (
      <div className="container confirmation-empty">
        <h1>Agendamento não encontrado</h1>
        <p>Pode ter sido cancelado ou o link expirou.</p>
        <Link to="/agendar"><Button>Fazer novo agendamento</Button></Link>
      </div>
    )
  }

  const service = getServiceById(appt.serviceId)
  const barber = getBarberById(appt.barberId)
  const gcal = buildGoogleCalendarUrl({
    service,
    barber,
    date: appt.date,
    time: appt.time,
    customerName: appt.customerName,
  })
  const protocol = appt.id.slice(0, 8).toUpperCase()

  const copyProtocol = async () => {
    try {
      await navigator.clipboard.writeText(protocol)
      show('Protocolo copiado.', 'success')
    } catch {
      show('Não foi possível copiar.', 'error')
    }
  }

  return (
    <div className="confirmation">
      <div className="container confirmation__container">
        <div className="confirmation__seal" aria-hidden="true">
          <CheckCircle2 size={56} />
        </div>
        <span className="eyebrow">— Confirmação —</span>
        <h1 className="confirmation__title">Agendamento confirmado</h1>
        <p className="confirmation__lead">
          Sua cadeira está reservada. Mostre o protocolo na chegada — ele
          facilita o atendimento.
        </p>

        <div className="confirmation__protocol" onClick={copyProtocol} role="button" tabIndex={0}>
          <span>
            <small>Protocolo</small>
            <strong>{protocol}</strong>
          </span>
          <span className="confirmation__protocol-copy">
            <Copy size={14} /> Copiar
          </span>
        </div>

        <ul className="confirmation__details">
          <li>
            <span><Calendar size={14} /> Data</span>
            <strong>{formatPtBR(appt.date)}</strong>
          </li>
          <li>
            <span><Clock size={14} /> Horário</span>
            <strong>{appt.time}</strong>
          </li>
          <li>
            <span><Scissors size={14} /> Serviço</span>
            <strong>{service?.name || '—'}</strong>
          </li>
          <li>
            <span><User2 size={14} /> Barbeiro</span>
            <strong>{barber?.name || 'Qualquer disponível'}</strong>
          </li>
          <li>
            <span>Valor</span>
            <strong>{service ? formatCurrency(service.price) : '—'}</strong>
          </li>
        </ul>

        <div className="confirmation__actions">
          <a href={gcal} target="_blank" rel="noopener noreferrer">
            <Button icon={<ExternalLink size={16} />}>Adicionar ao Google Calendar</Button>
          </a>
          <Button
            variant="secondary"
            onClick={() => navigate('/meus-agendamentos?phone=' + appt.customerPhone)}
            icon={<ArrowLeft size={16} />}
          >
            Ver meus agendamentos
          </Button>
        </div>

        <p className="confirmation__hint">
          Enviaremos um lembrete 24h antes do seu atendimento.
          Para cancelar, acesse “Meus agendamentos” pelo menos 2h antes.
        </p>
      </div>
    </div>
  )
}
