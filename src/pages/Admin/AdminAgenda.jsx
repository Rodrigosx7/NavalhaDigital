import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { addDays, format, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useBooking } from '../../contexts/BookingContext.jsx'
import Card from '../../components/ui/Card.jsx'
import Badge from '../../components/ui/Badge.jsx'
import { BUSINESS_HOURS } from '../../data/businessHours.js'
import './AdminAgenda.css'

const DOW_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function AdminAgenda() {
  const [refDate, setRefDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const { appointments, services, getServiceById, getBarberById } = useBooking()

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(refDate, i)), [refDate])

  const grouped = useMemo(() => {
    const map = {}
    week.forEach((d) => {
      const iso = format(d, 'yyyy-MM-dd')
      map[iso] = appointments.filter((a) => a.date === iso)
        .sort((a, b) => a.time.localeCompare(b.time))
    })
    return map
  }, [week, appointments])

  return (
    <div className="agenda">
      <header className="agenda__head">
        <div>
          <span className="eyebrow">Visão semanal</span>
          <h1>Agenda da semana</h1>
        </div>
        <div className="agenda__nav">
          <button
            onClick={() => setRefDate((d) => addDays(d, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="agenda__range">
            {format(week[0], "dd 'de' MMM", { locale: ptBR })} — {format(week[6], "dd 'de' MMM yyyy", { locale: ptBR })}
          </span>
          <button
            onClick={() => setRefDate((d) => addDays(d, 7))}
            aria-label="Próxima semana"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setRefDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="agenda__today"
          >
            <Calendar size={14} /> Hoje
          </button>
        </div>
      </header>

      <div className="agenda__grid">
        {week.map((d, idx) => {
          const iso = format(d, 'yyyy-MM-dd')
          const items = grouped[iso]
          const day = d.getDay()
          const hours = BUSINESS_HOURS[day]
          return (
            <Card key={iso} padding="md" className="agenda-day">
              <header className="agenda-day__head">
                <span className="agenda-day__dow">{DOW_LABELS[idx]}</span>
                <strong className="agenda-day__num">{d.getDate()}</strong>
                <span className="agenda-day__meta">
                  {hours ? `${hours.open}–${hours.close}` : 'Fechado'}
                </span>
              </header>
              {!hours ? (
                <p className="agenda-day__closed">Fechado</p>
              ) : items.length === 0 ? (
                <p className="agenda-day__empty">Sem agendamentos</p>
              ) : (
                <ul className="agenda-day__list">
                  {items.map((a) => {
                    const svc = getServiceById(a.serviceId)
                    const brb = getBarberById(a.barberId)
                    return (
                      <li key={a.id} className={`agenda-day__item agenda-day__item--${a.status}`}>
                        <div className="agenda-day__time">{a.time}</div>
                        <div className="agenda-day__info">
                          <strong>{a.customerName}</strong>
                          <small>{svc?.name}{brb ? ` · ${brb.name}` : ''}</small>
                        </div>
                        <Badge status={a.status} />
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
