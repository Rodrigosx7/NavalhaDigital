import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Calendar, Clock, Scissors, User2, Search, X, Phone, AlertCircle, Star,
} from 'lucide-react'
import { useBooking } from '../../contexts/BookingContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { formatCurrency, formatPhone, onlyDigits } from '../../utils/validation.js'
import { formatPtBR } from '../../utils/dateUtils.js'
import './MyBookingsPage.css'

export default function MyBookingsPage() {
  const { appointments, services, barbers, cancelAppointment, completeAppointment, addReview, getServiceById, getBarberById, reviews } = useBooking()
  const { show } = useToast()
  const [searchParams] = useSearchParams()
  const initialPhone = searchParams.get('phone') || sessionStorage.getItem('navalha_last_phone') || ''
  const [phone, setPhone] = useState(formatPhone(initialPhone))
  const [searched, setSearched] = useState(Boolean(initialPhone))
  const [pendingCancel, setPendingCancel] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')

  const lookup = onlyDigits(phone)

  const myAppointments = useMemo(() => {
    if (!lookup || !searched) return []
    return [...appointments]
      .filter((a) => a.customerPhone === lookup)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  }, [appointments, lookup, searched])

  const upcoming = myAppointments.filter((a) => a.status !== 'completed' && a.status !== 'cancelled')
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const history = myAppointments.filter((a) => a.status === 'cancelled' || a.status === 'completed')

  const handleSearch = (e) => {
    e.preventDefault()
    setSearched(true)
  }

  const handleCancel = (id) => {
    cancelAppointment(id)
    setPendingCancel(null)
    show('Agendamento cancelado.', 'info')
  }

  const handleMarkDone = (id) => {
    completeAppointment(id)
    show('Atendimento marcado como concluído. Agora você pode avaliar!', 'success')
  }

  const handleSubmitReview = () => {
    if (!reviewing) return
    addReview({
      appointmentId: reviewing.id,
      serviceId: reviewing.serviceId,
      barberId: reviewing.barberId,
      customerName: reviewing.customerName,
      customerPhone: reviewing.customerPhone,
      rating: reviewRating,
      comment: reviewComment.trim(),
      date: reviewing.date,
    })
    show('Obrigado pela avaliação!', 'success')
    setReviewing(null)
    setReviewRating(5)
    setReviewComment('')
  }

  const alreadyReviewed = (apptId) => reviews.some((r) => r.appointmentId === apptId)

  return (
    <div className="my-bookings">
      <div className="container">
        <header className="my-bookings__head">
          <span className="eyebrow">Área do cliente</span>
          <h1>Meus agendamentos</h1>
          <p>Encontre seus horários passando apenas o telefone cadastrado.</p>
        </header>

        <Card ornament padding="lg" className="my-bookings__search">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-form__field">
              <Phone size={16} />
              <input
                type="tel"
                placeholder="(11) 9 9999-9999"
                value={phone}
                onChange={(e) => { setPhone(formatPhone(e.target.value)); setSearched(false) }}
              />
            </div>
            <Button type="submit" icon={<Search size={16} />}>
              Buscar
            </Button>
          </form>
        </Card>

        {!searched && (
          <p className="my-bookings__hint">
            <AlertCircle size={14} /> Informe o telefone usado no agendamento para visualizar sua lista.
          </p>
        )}

        {searched && myAppointments.length === 0 && (
          <p className="my-bookings__hint my-bookings__hint--empty">
            Nenhum agendamento encontrado para este telefone. Verifique os números ou faça seu primeiro agendamento.
          </p>
        )}

        {searched && upcoming.length > 0 && (
          <section className="my-bookings__section">
            <header className="my-bookings__section-head">
              <h2>Próximos atendimentos</h2>
              <span className="my-bookings__section-meta">{upcoming.length} agendamento(s)</span>
            </header>
            <ul className="booking-list">
              {upcoming.map((a) => {
                const service = getServiceById(a.serviceId)
                const barber = getBarberById(a.barberId)
                return (
                  <li key={a.id}>
                    <Card ornament padding="md">
                      <div className="booking-row">
                        <div className="booking-row__when">
                          <strong>{formatPtBR(a.date)}</strong>
                          <span><Clock size={14} /> {a.time}</span>
                        </div>
                        <div className="booking-row__info">
                          <h3>{service?.name || 'Serviço'}</h3>
                          <ul className="booking-row__meta">
                            <li><Scissors size={12} /> {service ? formatCurrency(service.price) : ''}</li>
                            <li><User2 size={12} /> {barber?.name || 'Qualquer disponível'}</li>
                          </ul>
                        </div>
                        <div className="booking-row__status">
                          <Badge status={a.status} />
                          <Button variant="ghost" size="sm" onClick={() => setPendingCancel(a)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {searched && history.length > 0 && (
          <section className="my-bookings__section">
            <header className="my-bookings__section-head">
              <h2>Histórico</h2>
              <span className="my-bookings__section-meta">{history.length} registro(s)</span>
            </header>
            <ul className="booking-list booking-list--muted">
              {history.map((a) => {
                const service = getServiceById(a.serviceId)
                const barber = getBarberById(a.barberId)
                const reviewed = alreadyReviewed(a.id)
                return (
                  <li key={a.id}>
                    <Card padding="md">
                      <div className="booking-row">
                        <div className="booking-row__when">
                          <strong>{formatPtBR(a.date)}</strong>
                          <span><Clock size={14} /> {a.time}</span>
                        </div>
                        <div className="booking-row__info">
                          <h3>{service?.name || 'Serviço'}</h3>
                          <ul className="booking-row__meta">
                            <li><Scissors size={12} /> {service ? formatCurrency(service.price) : ''}</li>
                            <li><User2 size={12} /> {barber?.name || 'Qualquer disponível'}</li>
                          </ul>
                        </div>
                        <div className="booking-row__status">
                          <Badge status={a.status} />
                          {a.status === 'cancelled' && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarkDone(a.id)}>
                              Compareci
                            </Button>
                          )}
                          {a.status === 'completed' && !reviewed && (
                            <Button variant="secondary" size="sm" icon={<Star size={12} />} onClick={() => setReviewing(a)}>
                              Avaliar
                            </Button>
                          )}
                          {a.status === 'completed' && reviewed && (
                            <span className="booking-row__reviewed"><Star size={11} /> Avaliado</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      <Modal
        open={Boolean(pendingCancel)}
        onClose={() => setPendingCancel(null)}
        title="Cancelar agendamento?"
        subtitle={
          pendingCancel
            ? `${formatPtBR(pendingCancel.date)} às ${pendingCancel.time}`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingCancel(null)}>Manter agendamento</Button>
            <Button variant="danger" onClick={() => handleCancel(pendingCancel.id)}>Sim, cancelar</Button>
          </>
        }
      >
        <p>
          Seu horário será liberado para outros clientes. Você pode fazer um novo
          agendamento a qualquer momento.
        </p>
      </Modal>

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Como foi o atendimento?"
        subtitle={
          reviewing
            ? `${getServiceById(reviewing.serviceId)?.name} · ${formatPtBR(reviewing.date)}`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewing(null)}>Agora não</Button>
            <Button icon={<Star size={14} />} onClick={handleSubmitReview}>Enviar avaliação</Button>
          </>
        }
      >
        <div className="review-modal">
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setReviewRating(n)}
                aria-label={`${n} estrelas`}
              >
                <Star size={32} fill={n <= reviewRating ? 'currentColor' : 'none'} strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <span className="review-modal__label">
            {reviewRating === 5 && 'Excelente!'}
            {reviewRating === 4 && 'Muito bom'}
            {reviewRating === 3 && 'Bom'}
            {reviewRating === 2 && 'Pode melhorar'}
            {reviewRating === 1 && 'Insatisfeito'}
          </span>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Conte como foi sua experiência (opcional)"
            rows={4}
          />
        </div>
      </Modal>
    </div>
  )
}
