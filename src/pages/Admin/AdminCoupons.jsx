import { useState } from 'react'
import { Plus, Trash2, Ticket } from 'lucide-react'
import { useBooking } from '../../contexts/BookingContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Input from '../../components/ui/Input.jsx'
import './AdminCoupons.css'

const empty = { code: '', percent: 10, description: '', onlyServiceName: '' }

export default function AdminCoupons() {
  const { coupons, services, addCoupon, deleteCoupon } = useBooking()
  const { show } = useToast()
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const save = () => {
    if (!editing.code || !editing.percent) return
    addCoupon(editing)
    setEditing(null)
    show(`Cupom ${editing.code} criado.`, 'success')
  }

  const remove = (coupon) => {
    deleteCoupon(coupon.code)
    setConfirming(null)
    show('Cupom removido.', 'info')
  }

  return (
    <div className="coupons-admin">
      <header className="coupons-admin__head">
        <div>
          <span className="eyebrow">Promoções</span>
          <h1>Cupons de desconto</h1>
          <p className="coupons-admin__lead">Crie códigos para campanhas especiais. Funcionam automaticamente no fluxo de agendamento.</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setEditing({ ...empty })}>Novo cupom</Button>
      </header>

      <Card ornament padding="md">
        {coupons.length === 0 ? (
          <p className="coupons-admin__empty">Nenhum cupom cadastrado.</p>
        ) : (
          <table className="coupons-admin__table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Desconto</th>
                <th>Descrição</th>
                <th>Restrição</th>
                <th style={{ width: 1 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.code}>
                  <td><span className="coupons-admin__code">{c.code}</span></td>
                  <td><strong>{c.percent}%</strong></td>
                  <td>{c.description || '—'}</td>
                  <td>
                    {c.onlyServiceName ? (
                      <small>Apenas serviços com "{c.onlyServiceName}"</small>
                    ) : (
                      <small style={{ color: 'var(--color-brown-400)' }}>Todos os serviços</small>
                    )}
                  </td>
                  <td>
                    <button
                      className="coupons-admin__del"
                      onClick={() => setConfirming(c)}
                      aria-label="Remover cupom"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Novo cupom"
        subtitle="Defina código, percentual e regras."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} icon={<Ticket size={16} />}>Criar cupom</Button>
          </>
        }
      >
        {editing && (
          <div className="coupons-admin__form">
            <Input
              label="Código (sem espaços, em maiúsculas)"
              value={editing.code}
              onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
              placeholder="VOLTA10"
            />
            <Input
              label="Desconto (%)"
              type="number"
              min="1"
              max="100"
              value={editing.percent}
              onChange={(e) => setEditing({ ...editing, percent: Number(e.target.value) || 0 })}
            />
            <Input
              label="Descrição"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="10% para clientes que voltam este mês"
            />
            <div className="coupons-admin__services">
              <span className="field__label">Restringir a um serviço (opcional)</span>
              <select
                value={editing.onlyServiceName || ''}
                onChange={(e) => setEditing({ ...editing, onlyServiceName: e.target.value })}
              >
                <option value="">Todos os serviços</option>
                {services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Remover cupom"
        subtitle={confirming?.code}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>Manter</Button>
            <Button variant="danger" onClick={() => remove(confirming)}>Remover</Button>
          </>
        }
      >
        <p>O cupom deixará de funcionar imediatamente para novos agendamentos.</p>
      </Modal>
    </div>
  )
}
