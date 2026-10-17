import { useMemo, useState } from 'react'
import { FileDown, TrendingUp, Users, Calendar } from 'lucide-react'
import { useBooking } from '../../contexts/BookingContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import { formatCurrency } from '../../utils/validation.js'
import { formatPtBR } from '../../utils/dateUtils.js'
import './AdminReport.css'

function toCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return /[",\n;]/.test(s) ? `"${s}"` : s
  }
  const lines = [headers.join(';'), ...rows.map((r) => headers.map((h) => escape(r[h])).join(';'))]
  return lines.join('\n')
}

function downloadCSV(filename, content) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function AdminReport() {
  const { appointments, services, getServiceById, getBarberById } = useBooking()
  const { show } = useToast()

  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))

  const filtered = useMemo(() => {
    return appointments
      .filter((a) => a.date >= from && a.date <= to)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  }, [appointments, from, to])

  const metrics = useMemo(() => {
    const confirmed = filtered.filter((a) => a.status === 'confirmed' || a.status === 'completed')
    const cancelled = filtered.filter((a) => a.status === 'cancelled').length
    const revenue = confirmed.reduce((sum, a) => sum + (a.finalPrice ?? getServiceById(a.serviceId)?.price ?? 0), 0)
    const ticket = confirmed.length ? revenue / confirmed.length : 0
    const topService = {}
    confirmed.forEach((a) => { topService[a.serviceId] = (topService[a.serviceId] || 0) + 1 })
    const top = Object.entries(topService).sort((a, b) => b[1] - a[1])[0]
    return {
      total: filtered.length,
      confirmed: confirmed.length,
      cancelled,
      revenue,
      ticket,
      topServiceId: top ? top[0] : null,
      topServiceCount: top ? top[1] : 0,
    }
  }, [filtered, getServiceById])

  const handleExport = () => {
    const rows = filtered.map((a) => {
      const svc = getServiceById(a.serviceId)
      const brb = getBarberById(a.barberId)
      return {
        Data: a.date,
        Horario: a.time,
        Cliente: a.customerName,
        Telefone: a.customerPhone,
        Servico: svc?.name || '',
        Barbeiro: brb?.name || 'Qualquer',
        Duracao_min: svc?.durationMinutes || '',
        Valor: svc?.price || 0,
        Valor_Final: a.finalPrice ?? svc?.price ?? 0,
        Cupom: a.couponCode || '',
        Status: a.status,
        Protocolo: a.id.slice(0, 8).toUpperCase(),
      }
    })
    const csv = toCSV(rows)
    downloadCSV(`navalha-agendamentos-${from}_a_${to}.csv`, csv)
    show(`${rows.length} agendamentos exportados.`, 'success')
  }

  const topService = metrics.topServiceId ? getServiceById(metrics.topServiceId) : null

  return (
    <div className="report">
      <header className="report__head">
        <div>
          <span className="eyebrow">Exportação</span>
          <h1>Relatório de agendamentos</h1>
          <p className="report__lead">Filtre por período e baixe a planilha em CSV (compatível com Excel).</p>
        </div>
        <Button icon={<FileDown size={16} />} onClick={handleExport}>
          Baixar CSV ({filtered.length})
        </Button>
      </header>

      <Card ornament padding="md" className="report__filters">
        <label>
          <span>De</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
        </label>
        <label>
          <span>Até</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} />
        </label>
      </Card>

      <div className="report__metrics">
        <Card ornament padding="md">
          <span><Calendar size={14} /> Período</span>
          <strong>{formatPtBR(from)} → {formatPtBR(to)}</strong>
        </Card>
        <Card ornament padding="md">
          <span><Users size={14} /> Agendamentos</span>
          <strong>{metrics.total}</strong>
          <small>{metrics.confirmed} ativos · {metrics.cancelled} cancelados</small>
        </Card>
        <Card ornament padding="md">
          <span><TrendingUp size={14} /> Faturamento previsto</span>
          <strong>{formatCurrency(metrics.revenue)}</strong>
          <small>Ticket médio: {formatCurrency(metrics.ticket)}</small>
        </Card>
        <Card ornament padding="md">
          <span>Serviço mais pedido</span>
          <strong>{topService?.name || '—'}</strong>
          <small>{metrics.topServiceCount > 0 ? `${metrics.topServiceCount} agendamentos` : 'Sem dados'}</small>
        </Card>
      </div>

      <Card ornament padding="md">
        {filtered.length === 0 ? (
          <p className="report__empty">Nenhum agendamento no período selecionado.</p>
        ) : (
          <table className="report__table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((a) => {
                const svc = getServiceById(a.serviceId)
                const price = a.finalPrice ?? svc?.price ?? 0
                return (
                  <tr key={a.id}>
                    <td><strong>{formatPtBR(a.date)}</strong> · {a.time}</td>
                    <td>{a.customerName}</td>
                    <td>{svc?.name || '—'}</td>
                    <td>
                      {a.couponCode && <s style={{ color: 'var(--color-brown-400)', marginRight: 6 }}>{formatCurrency(svc?.price || 0)}</s>}
                      <strong>{formatCurrency(price)}</strong>
                    </td>
                    <td>
                      <span className={`report__status report__status--${a.status}`}>
                        {a.status === 'confirmed' && 'Confirmado'}
                        {a.status === 'completed' && 'Concluído'}
                        {a.status === 'cancelled' && 'Cancelado'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {filtered.length > 50 && (
          <p className="report__hint">Exibindo 50 de {filtered.length} registros. Exporte o CSV para ver todos.</p>
        )}
      </Card>
    </div>
  )
}
