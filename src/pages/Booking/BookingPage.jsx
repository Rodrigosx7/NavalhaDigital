import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scissors, Sparkles, Crown, Eye, Brush, Minus, Droplet,
  ChevronLeft, ChevronRight, Calendar, Clock, Check, User2,
} from 'lucide-react'
import { useBooking } from '../../contexts/BookingContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import { formatCurrency, formatPhone, isValidName, isValidPhone, onlyDigits } from '../../utils/validation.js'
import { addDays, format, startOfDay, isSameDay } from 'date-fns'
import { ptBR as locale } from 'date-fns/locale'
import { formatPtBR, todayISO } from '../../utils/dateUtils.js'
import './BookingPage.css'

const ICONS = { Scissors, Sparkles, Crown, Eye, Brush, Minus, Droplet }
const STEPS = [
  { key: 'service', label: 'Serviço' },
  { key: 'barber',  label: 'Barbeiro' },
  { key: 'when',    label: 'Data e horário' },
  { key: 'confirm', label: 'Confirmação' },
]

export default function BookingPage() {
  const { services, barbers, addAppointment, getAvailableSlots, validateCoupon, applyCouponDiscount } = useBooking()
  const { show } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState(null)
  const [barberId, setBarberId] = useState(null)
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(startOfDay(new Date()))
  const [errors, setErrors] = useState({})

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId])
  const barber = useMemo(() => barbers.find((b) => b.id === barberId), [barbers, barberId])

  const slots = useMemo(
    () => (date && serviceId ? getAvailableSlots(date, serviceId, barberId) : []),
    [date, serviceId, barberId, getAvailableSlots],
  )

  const finalPrice = useMemo(() => {
    if (!service) return 0
    return applyCouponDiscount(service.price, appliedCoupon)
  }, [service, appliedCoupon, applyCouponDiscount])

  const handleApplyCoupon = () => {
    if (!serviceId) {
      setCouponError('Selecione um serviço antes.')
      return
    }
    const result = validateCoupon(couponCode, serviceId)
    if (result.ok) {
      setAppliedCoupon(result.coupon)
      setCouponError('')
      show(`Cupom ${result.coupon.code} aplicado: -${result.coupon.percent}%.`, 'success')
    } else {
      setAppliedCoupon(null)
      setCouponError(result.error)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
  }

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const goPrev = () => setStep((s) => Math.max(s - 1, 0))

  const handleConfirm = () => {
    const newErrors = {}
    if (!isValidName(name)) newErrors.name = 'Informe seu nome completo.'
    if (!isValidPhone(phone)) newErrors.phone = 'Telefone inválido (10 ou 11 dígitos).'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return

    const appt = addAppointment({
      serviceId,
      barberId,
      customerName: name.trim(),
      customerPhone: onlyDigits(phone),
      date,
      time,
      couponCode: appliedCoupon?.code || null,
      finalPrice,
    })
    sessionStorage.setItem('navalha_last_phone', onlyDigits(phone))
    sessionStorage.setItem('navalha_last_appt', appt.id)
    show(`Agendamento confirmado para ${appt.time}.`, 'success')
    navigate('/confirmacao?id=' + appt.id)
  }

  const stepperIndex = step

  return (
    <div className="booking-page">
      <div className="container">
        <header className="booking-header">
          <span className="eyebrow">Agendamento</span>
          <h1 className="booking-header__title">Reserve sua cadeira</h1>
          <p className="booking-header__lead">
            Siga os quatro passos para garantir seu horário.
          </p>
        </header>

        {/* === STEPPER === */}
        <ol className="stepper" aria-label="Progresso do agendamento">
          {STEPS.map((s, i) => (
            <li key={s.key} className={`stepper__item ${i <= stepperIndex ? 'is-active' : ''} ${i < stepperIndex ? 'is-done' : ''}`}>
              <span className="stepper__bullet">
                {i < stepperIndex ? <Check size={14} /> : i + 1}
              </span>
              <span className="stepper__label">{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="booking-grid">
          {/* === Painel principal === */}
          <div className="booking-main">
            {step === 0 && (
              <section className="step-section">
                <header className="step-section__head">
                  <h2>Escolha o serviço</h2>
                  <p>Toque no ritual que você precisa hoje.</p>
                </header>
                <div className="services-pick">
                  {services.map((s) => {
                    const Icon = ICONS[s.icon] || Scissors
                    const selected = s.id === serviceId
                    return (
                      <button
                        key={s.id}
                        className={`pick-card ${selected ? 'is-selected' : ''}`}
                        onClick={() => { setServiceId(s.id); setTime(null) }}
                        type="button"
                      >
                        <span className="pick-card__icon"><Icon size={22} /></span>
                        <span className="pick-card__body">
                          <span className="pick-card__title">{s.name}</span>
                          <span className="pick-card__desc">{s.description}</span>
                          <span className="pick-card__meta">
                            <span><Clock size={12} /> {s.durationMinutes} min</span>
                            <span className="pick-card__price">{formatCurrency(s.price)}</span>
                          </span>
                        </span>
                        {selected && <span className="pick-card__check"><Check size={14} /></span>}
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {step === 1 && (
              <section className="step-section">
                <header className="step-section__head">
                  <h2>Escolha o barbeiro</h2>
                  <p>Cada um tem um ofício. Escolha o seu, ou deixe a sorte escolher.</p>
                </header>
                <div className="barbers-pick">
                  <button
                    className={`barber-pick ${barberId === null ? 'is-selected' : ''}`}
                    onClick={() => setBarberId(null)}
                    type="button"
                  >
                    <span className="barber-pick__avatar barber-pick__avatar--any">
                      <User2 size={26} />
                    </span>
                    <span className="barber-pick__body">
                      <strong>Qualquer disponível</strong>
                      <span>Mais rápido · encaixe imediato</span>
                    </span>
                    {barberId === null && <span className="pick-card__check"><Check size={14} /></span>}
                  </button>
                  {barbers.map((b) => {
                    const selected = b.id === barberId
                    return (
                      <button
                        key={b.id}
                        className={`barber-pick ${selected ? 'is-selected' : ''}`}
                        onClick={() => setBarberId(b.id)}
                        type="button"
                      >
                        <span className="barber-pick__avatar" style={{ background: b.avatarColor }}>
                          {b.initials}
                        </span>
                        <span className="barber-pick__body">
                          <strong>{b.name}</strong>
                          <span>{b.specialty}</span>
                        </span>
                        {selected && <span className="pick-card__check"><Check size={14} /></span>}
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="step-section">
                <header className="step-section__head">
                  <h2>Data e horário</h2>
                  <p>Escolha um dia disponível e um horário livre.</p>
                </header>

                <CalendarPicker
                  value={date}
                  onChange={(iso) => { setDate(iso); setTime(null) }}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                />

                <div className="slots">
                  <div className="slots__head">
                    <Clock size={16} />
                    <span>
                      {formatPtBR(date, "EEEE, dd 'de' MMMM")}
                      {service && ` · ${service.durationMinutes} min`}
                    </span>
                  </div>

                  {slots.length === 0 ? (
                    <p className="slots__empty">
                      {date
                        ? 'Barbearia fechada neste dia. Escolha outra data.'
                        : 'Selecione uma data para ver os horários.'}
                    </p>
                  ) : (
                    <div className="slots__grid">
                      {slots.map((s) => (
                        <button
                          key={s.time}
                          disabled={s.blocked}
                          className={`slot ${time === s.time ? 'is-selected' : ''} ${s.blocked ? 'is-blocked' : ''}`}
                          onClick={() => setTime(s.time)}
                          type="button"
                        >
                          {s.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="step-section">
                <header className="step-section__head">
                  <h2>Seus dados</h2>
                  <p>Precisamos só do básico para confirmar o agendamento.</p>
                </header>

                <div className="confirm-form">
                  <Input
                    label="Nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                    error={errors.name}
                  />
                  <Input
                    label="Telefone (WhatsApp)"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(11) 9 9999-9999"
                    error={errors.phone}
                    inputMode="tel"
                  />

                  <div className="coupon-field">
                    <span className="field__label">Cupom de desconto</span>
                    {appliedCoupon ? (
                      <div className="coupon-applied">
                        <span>
                          <strong>{appliedCoupon.code}</strong> · {appliedCoupon.percent}% off aplicado
                        </span>
                        <button type="button" onClick={handleRemoveCoupon} aria-label="Remover cupom">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="coupon-input-row">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError('') }}
                          placeholder="Ex: VOLTA10"
                          maxLength={20}
                        />
                        <button type="button" onClick={handleApplyCoupon}>Aplicar</button>
                      </div>
                    )}
                    {couponError && <span className="coupon-error">{couponError}</span>}
                    {!couponError && !appliedCoupon && (
                      <span className="coupon-hint">Tente <strong>VOLTA10</strong>, <strong>BARBA20</strong> ou <strong>INDICACAO15</strong>.</span>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Actions */}
            <div className="step-actions">
              <Button variant="secondary" onClick={goPrev} disabled={step === 0} icon={<ChevronLeft size={16} />}>
                Voltar
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  onClick={goNext}
                  disabled={(step === 0 && !serviceId) || (step === 2 && !time)}
                  iconRight={<ChevronRight size={16} />}
                >
                  Próximo
                </Button>
              ) : (
                <Button onClick={handleConfirm}>Confirmar agendamento</Button>
              )}
            </div>
          </div>

          {/* === Resumo lateral === */}
          <aside className="booking-summary">
            <Card ornament padding="lg">
              <span className="eyebrow">Seu agendamento</span>
              <h3 className="booking-summary__title">Resumo</h3>

              <ul className="summary-list">
                <li>
                  <span>Serviço</span>
                  <strong>{service?.name || '—'}</strong>
                </li>
                <li>
                  <span>Barbeiro</span>
                  <strong>{barber?.name || 'Qualquer disponível'}</strong>
                </li>
                <li>
                  <span>Data</span>
                  <strong>{date ? formatPtBR(date) : '—'}</strong>
                </li>
                <li>
                  <span>Horário</span>
                  <strong>{time || '—'}</strong>
                </li>
                <li>
                  <span>Duração</span>
                  <strong>{service ? `${service.durationMinutes} min` : '—'}</strong>
                </li>
              </ul>

              {service && (
                <div className="summary-total">
                  <span>Total</span>
                  <strong>
                    {appliedCoupon && (
                      <s style={{ color: 'var(--color-brown-400)', fontSize: '0.85rem', marginRight: 8 }}>
                        {formatCurrency(service.price)}
                      </s>
                    )}
                    {formatCurrency(finalPrice)}
                  </strong>
                </div>
              )}

              <p className="summary-note">
                Pague apenas ao final do atendimento. Cancelamentos são
                gratuitos até 2 horas antes.
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ====== Calendário interno ====== */
function CalendarPicker({ value, onChange, month, onMonthChange }) {
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const startWeekday = (first.getDay() + 6) % 7 // segunda = 0
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const list = []
    for (let i = 0; i < startWeekday; i++) list.push(null)
    for (let d = 1; d <= lastDay; d++) {
      list.push(new Date(month.getFullYear(), month.getMonth(), d))
    }
    return list
  }, [month])

  const today = startOfDay(new Date())
  const minDate = today
  const maxDate = addDays(today, 60)

  const canPrev = month.getTime() > new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  const canNext = month.getTime() < new Date(maxDate.getFullYear(), maxDate.getMonth(), 1).getTime()

  return (
    <div className="calendar">
      <header className="calendar__head">
        <button
          type="button"
          className="calendar__nav"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          disabled={!canPrev}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="calendar__title">
          {format(month, "MMMM 'de' yyyy", { locale })}
        </span>
        <button
          type="button"
          className="calendar__nav"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          disabled={!canNext}
          aria-label="Próximo mês"
        >
          <ChevronRight size={18} />
        </button>
      </header>
      <div className="calendar__weekdays">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar__grid">
        {days.map((d, i) => {
          if (!d) return <span key={i} className="calendar__cell calendar__cell--empty" />
          const iso = format(d, 'yyyy-MM-dd')
          const past = d.getTime() < minDate.getTime()
          const closed = d.getDay() === 0 || d.getDay() === 1
          const isToday = isSameDay(d, today)
          const selected = iso === value
          const disabled = past || closed
          return (
            <button
              key={i}
              type="button"
              className={`calendar__cell ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''} ${isToday ? 'is-today' : ''}`}
              disabled={disabled}
              onClick={() => onChange(iso)}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      <p className="calendar__hint">
        <Calendar size={14} /> Funcionamos terça a sábado. Domingos e segundas estamos fechados.
      </p>
    </div>
  )
}
