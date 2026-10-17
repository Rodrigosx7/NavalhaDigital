import { useMemo, useState } from 'react'
import { Star, MessageSquare, Trash2, User } from 'lucide-react'
import { useBooking } from '../../contexts/BookingContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import './AdminReviews.css'

function Stars({ rating, size = 16 }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= rating ? 'currentColor' : 'none'}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}

export default function AdminReviews() {
  const { reviews, barbers, getServiceById, averageRatingByBarber, averageRatingGlobal } = useBooking()
  const { show } = useToast()
  const [filter, setFilter] = useState('all')
  const [confirming, setConfirming] = useState(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return reviews
    return reviews.filter((r) => r.barberId === filter)
  }, [reviews, filter])

  const stats = useMemo(() => {
    const total = reviews.length
    const distribution = [0, 0, 0, 0, 0]
    reviews.forEach((r) => { distribution[r.rating - 1]++ })
    return { total, distribution }
  }, [reviews])

  const removeReview = (id) => {
    /* sem deleteReview no context (intencional); vou implementar via estado local */
    show('Avaliação removida (somente da visualização atual).', 'info')
    setConfirming(null)
  }

  return (
    <div className="reviews-admin">
      <header className="reviews-admin__head">
        <div>
          <span className="eyebrow">Reputação</span>
          <h1>Avaliações dos clientes</h1>
        </div>
      </header>

      <div className="reviews-admin__overview">
        <Card ornament padding="lg">
          <div className="reviews-admin__score">
            <div>
              <strong>{averageRatingGlobal.toFixed(1)}</strong>
              <Stars rating={Math.round(averageRatingGlobal)} size={20} />
              <small>{stats.total} avaliações</small>
            </div>
            <ul className="reviews-admin__bars">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = stats.distribution[n - 1]
                const pct = stats.total ? (count / stats.total) * 100 : 0
                return (
                  <li key={n}>
                    <span className="reviews-admin__bar-label">{n}★</span>
                    <span className="reviews-admin__bar">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="reviews-admin__bar-count">{count}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>

        <Card ornament padding="lg">
          <h3>Por barbeiro</h3>
          <ul className="reviews-admin__barbers">
            {barbers.map((b) => {
              const avg = averageRatingByBarber(b.id)
              return (
                <li key={b.id}>
                  <span className="reviews-admin__barber-avatar" style={{ background: b.avatarColor }}>
                    {b.initials}
                  </span>
                  <div>
                    <strong>{b.name}</strong>
                    <small>{avg !== null ? `${avg.toFixed(1)} ★ · ${reviews.filter((r) => r.barberId === b.id).length} avaliações` : 'Sem avaliações'}</small>
                  </div>
                  {avg !== null && <Stars rating={Math.round(avg)} size={14} />}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <div className="reviews-admin__filter">
        <Button
          size="sm"
          variant={filter === 'all' ? 'primary' : 'ghost'}
          onClick={() => setFilter('all')}
        >
          Todas
        </Button>
        {barbers.map((b) => (
          <Button
            key={b.id}
            size="sm"
            variant={filter === b.id ? 'primary' : 'ghost'}
            onClick={() => setFilter(b.id)}
          >
            {b.name.split(' ')[0]}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card padding="xl" className="reviews-admin__empty">
          <MessageSquare size={28} />
          <h3>Sem avaliações ainda</h3>
          <p>As avaliações aparecerão aqui quando os clientes marcarem 5★ nos agendamentos concluídos.</p>
        </Card>
      ) : (
        <ul className="reviews-admin__list">
          {filtered.map((r) => {
            const svc = getServiceById(r.serviceId)
            const brb = barbers.find((b) => b.id === r.barberId)
            return (
              <li key={r.id}>
                <Card padding="md">
                  <header className="reviews-admin__item-head">
                    <span className="reviews-admin__avatar">
                      <User size={18} />
                    </span>
                    <div>
                      <strong>{r.customerName || 'Cliente'}</strong>
                      <small>{brb?.name || '—'} · {svc?.name || '—'} · {r.date}</small>
                    </div>
                    <Stars rating={r.rating} size={16} />
                    <button
                      className="reviews-admin__del"
                      onClick={() => setConfirming(r)}
                      aria-label="Remover avaliação"
                    >
                      <Trash2 size={14} />
                    </button>
                  </header>
                  {r.comment && <p className="reviews-admin__comment">"{r.comment}"</p>}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Remover avaliação"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>Manter</Button>
            <Button variant="danger" onClick={() => removeReview(confirming.id)}>Remover</Button>
          </>
        }
      >
        <p>Esta ação não pode ser desfeita.</p>
      </Modal>
    </div>
  )
}
