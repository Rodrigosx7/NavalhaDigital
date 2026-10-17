import './Badge.css'

const LABELS = {
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
}

export default function Badge({ status, children }) {
  const label = children || LABELS[status] || status
  return <span className={`badge badge--${status}`}>{label}</span>
}
