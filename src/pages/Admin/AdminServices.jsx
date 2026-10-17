import { useState } from 'react'
import { Plus, Pencil, Trash2, Clock, Scissors } from 'lucide-react'
import { useBooking } from '../../contexts/BookingContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Input from '../../components/ui/Input.jsx'
import { formatCurrency } from '../../utils/validation.js'
import './AdminServices.css'

const ICONS = ['Scissors', 'Sparkles', 'Crown', 'Eye', 'Brush', 'Minus', 'Droplet']

const empty = { name: '', description: '', durationMinutes: 30, price: 50, icon: 'Scissors' }

export default function AdminServices() {
  const { services, addService, updateService, deleteService } = useBooking()
  const { show } = useToast()
  const [editing, setEditing] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null)

  const openNew = () => setEditing({ ...empty })
  const openEdit = (svc) => setEditing({ ...svc })
  const close = () => setEditing(null)

  const save = () => {
    if (!editing.name || !editing.durationMinutes || !editing.price) return
    if (editing.id) {
      updateService(editing.id, editing)
      show('Serviço atualizado.', 'success')
    } else {
      addService(editing)
      show('Serviço adicionado.', 'success')
    }
    close()
  }

  const remove = (svc) => {
    deleteService(svc.id)
    setConfirmingDelete(null)
    show('Serviço removido.', 'info')
  }

  return (
    <div className="services-admin">
      <header className="services-admin__head">
        <div>
          <span className="eyebrow">Catálogo</span>
          <h1>Serviços</h1>
          <p className="services-admin__lead">
            Cadastre, edite ou remova os serviços oferecidos pela barbearia.
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openNew}>Novo serviço</Button>
      </header>

      <Card ornament padding="md" className="services-admin__list">
        <table className="services-admin__table">
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Duração</th>
              <th>Preço</th>
              <th style={{ width: 1 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 && (
              <tr><td colSpan="4" className="services-admin__empty">Nenhum serviço cadastrado.</td></tr>
            )}
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                  <small>{s.description}</small>
                </td>
                <td>
                  <Clock size={12} /> {s.durationMinutes} min
                </td>
                <td>{formatCurrency(s.price)}</td>
                <td>
                  <div className="services-admin__actions">
                    <button onClick={() => openEdit(s)} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(s)}
                      aria-label="Remover"
                      className="services-admin__del"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={close}
        title={editing?.id ? 'Editar serviço' : 'Novo serviço'}
        subtitle="Defina nome, descrição, duração e preço."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </>
        }
      >
        {editing && (
          <div className="services-admin__form">
            <Input
              label="Nome"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <Input
              label="Descrição"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
            <div className="services-admin__row">
              <Input
                label="Duração (min)"
                type="number"
                min="10"
                step="5"
                value={editing.durationMinutes}
                onChange={(e) => setEditing({ ...editing, durationMinutes: Number(e.target.value) || 0 })}
              />
              <Input
                label="Preço (R$)"
                type="number"
                min="0"
                step="5"
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(confirmingDelete)}
        onClose={() => setConfirmingDelete(null)}
        title="Remover serviço"
        subtitle={confirmingDelete?.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingDelete(null)}>Manter</Button>
            <Button variant="danger" onClick={() => remove(confirmingDelete)}>Remover</Button>
          </>
        }
      >
        <p>
          Essa ação não pode ser desfeita. O serviço deixará de aparecer no
          agendamento, mas agendamentos existentes continuam registrados.
        </p>
      </Modal>
    </div>
  )
}
