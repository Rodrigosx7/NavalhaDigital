import { format, parseISO, addDays, isSameDay, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function toISODate(date) {
  if (typeof date === 'string') return date
  return format(date, 'yyyy-MM-dd')
}

export function fromISODate(iso) {
  return parseISO(iso)
}

export function formatPtBR(isoDate, pattern = "dd 'de' MMMM 'de' yyyy") {
  try {
    const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate
    return format(date, pattern, { locale: ptBR })
  } catch {
    return ''
  }
}

export function formatDayMonth(isoDate) {
  return formatPtBR(isoDate, "dd 'de' MMM")
}

export function formatWeekday(isoDate) {
  return formatPtBR(isoDate, 'EEEE')
}

export function formatTime(time24) {
  return time24
}

export function todayISO() {
  return toISODate(new Date())
}

export function getNextDays(n = 30) {
  const start = startOfDay(new Date())
  return Array.from({ length: n }, (_, i) => addDays(start, i))
}

export function isPastDate(isoDate) {
  const today = startOfDay(new Date())
  const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate
  return isBefore(date, today) && !isSameDay(date, today)
}

export function isToday(isoDate) {
  return isSameDay(typeof isoDate === 'string' ? parseISO(isoDate) : isoDate, new Date())
}

export function minutesBetween(startHHMM, endHHMM) {
  const [sh, sm] = startHHMM.split(':').map(Number)
  const [eh, em] = endHHMM.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

export function addMinutesToTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor((total / 60) % 24)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function overlap(startA, endA, startB, endB) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA)
}
