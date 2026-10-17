import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, Users, Check } from 'lucide-react'
import { addDays, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { useBooking } from '../../contexts/BookingContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Badge from '../../components/ui/Badge.jsx'
import { formatCurrency } from '../../utils/validation.js'
import { formatPtBR } from '../../utils/dateUtils.js'
import './AdminDashboard.css'

export default function AdminDashboard() {
  const { appointments, services, barbers, completeAppointment, cancelAppointment, getServiceById, getBarberById } = useBooking()
  const { show } = useToast()
  const [selectedDate, setSelectedDate] = useState(() => format(startOfDay(new Date()), 'yyyy-MM-dd'))

  const dayAppts = useMemo(() => {
    return appointments
      .filter((a) => a.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [appointments, selectedDate])

  const metrics = useMemo(() => {
    const total = dayAppts.length
    const confirmed = dayAppts.filter((a) => a.status === 'confirmed').length
    const cancelled = dayAppts.filter((a) => a.status === 'cancelled').length
    const revenue = dayAppts
      .filter((a) => a.status !== 'cancelled')
      .reduce((sum, a) => sum + (getServiceById(a.serviceId)?.price || 0), 0)
    return { total, confirmed, cancelled, revenue }
  }, [dayAppts, getServiceById])

  const dateObj = parseISO(selectedDate)
  const today = startOfDay(new Date())

  const handleAction = (id, action, label) => {
    if (action === 'complete') completeAppointment(id)
    else cancelAppointment(id)
    show(`Agendamento marcado como ${label}.`, 'success')
  }

  return (
    <div className="dashboard">
      <header className="dashboard__head">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Agenda do dia</h1>
        </div>
        <div className="dashboard__date-nav">
          <button
            type="button"
            onClick={() => setSelectedDate(format(addDays(dateObj, -1), 'yyyy-MM-dd'))}
            disabled={isSameDay(dateObj, today)}
            aria-label="Dia anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="dashboard__date-display">
            <Calendar size={14} />
            <span>{formatPtBR(selectedDate)}</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(format(addDays(dateObj, 1), 'yyyy-MM-dd'))}
            aria-label="Próximo dia"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="metrics">
        <Card ornament padding="md">
          <span className="metrics__label"><Calendar size={14} /> Total do dia</span>
          <strong className="metrics__value">{metrics.total}</strong>
        </Card>
        <Card ornament padding="md">
          <span className="metrics__label"><Check size={14} /> Confirmados</span>
          <strong className="metrics__value metrics__value--success">{metrics.confirmed}</strong>
        </Card>
        <Card ornament padding="md">
          <span className="metrics__label"><Users size={14} /> Cancelados</span>
          <strong className="metrics__value metrics__value--danger">{metrics.cancelled}</strong>
        </Card>
        <Card ornament padding="md">
          <span className="metrics__label"><TrendingUp size={14} /> Faturamento previsto</span>
          <strong className="metrics__value">{formatCurrency(metrics.revenue)}</strong>
        </Card>
      </div>

      <Card ornament padding="md" className="dashboard__list-card">
        {dayAppts.length === 0 ? (
          <div className="dashboard__empty">
            <Calendar size={28} />
            <p>Nenhum agendamento para este dia.</p>
          </div>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Horário</th>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Barbeiro</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dayAppts.map((a) => {
                const service = getServiceById(a.serviceId)
                const barber = getBarberById(a.barberId)
                return (
                  <tr key={a.id}>
                    <td className="dashboard-table__time">{a.time}</td>
                    <td>
                      <strong>{a.customerName}</strong>
                      <small>{a.customerPhone}</small>
                    </td>
                    <td>{service?.name || '—'}</td>
                    <td>{barber?.name || <em>Qualquer</em>}</td>
                    <td><Badge status={a.status} /></td>
                    <td>
                      <div className="dashboard-table__actions">
                        {a.status === 'confirmed' && (
                          <>
                            <Button size="sm" onClick={() => handleAction(a.id, 'complete', 'concluído')}>
                              Concluir
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => handleAction(a.id, 'cancel', 'cancelado')}>
                              Cancelar
                            </Button>
                          </>
                        )}
                        {a.status === 'completed' && <span className="dashboard-table__done">Atendido</span>}
                        {a.status === 'cancelled' && <span className="dashboard-table__done dashboard-table__done--muted">Cancelado</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
