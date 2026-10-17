import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { useBooking } from '../../contexts/BookingContext.jsx'
import { criarCSV } from '../../services/csv.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import Input from '../../components/ui/Input.jsx'
import { Cabecalho, Erro, Vazio, dataLegivel, moeda, useResource } from './shared.jsx'

export default function Report() {
  const catalogo = useBooking(), hoje = catalogo.agora.slice(0, 10)
  const [inicio, setInicio] = useState(hoje ? hoje.slice(0, 7) + '-01' : ''), [fim, setFim] = useState(hoje), [periodo, setPeriodo] = useState(null), [erro, setErro] = useState('')
  const resource = useResource(periodo ? '/relatorios?' + new URLSearchParams(periodo) : null)
  function consultar(event) { event.preventDefault(); setErro(''); if (inicio > fim) { setErro('O início do período não pode ser posterior ao fim.'); return } setPeriodo({ inicio, fim }); resource.recarregar() }
  function exportar() {
    const rows = [['Reserva', 'Cliente', 'Data', 'Horário', 'Serviços', 'Duração em minutos', 'Valor total informativo', 'Situação'], ...resource.data.agendamentos.map(item => [item.id, item.cliente.nome, item.dataHora.slice(0, 10), item.dataHora.slice(11, 16), item.servicos.map(service => service.nome).join(' + '), item.duracaoTotalMinutos, item.valorTotal.toFixed(2).replace('.', ','), 'CONCLUIDO'])]
    const url = URL.createObjectURL(new Blob([criarCSV(rows)], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `atendimentos-${periodo.inicio}-${periodo.fim}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <><Cabecalho titulo="Relatório de atendimentos" descricao="Somente os atendimentos concluídos da sua agenda, com os valores registrados na reserva." /><Card><form className="sys-toolbar" onSubmit={consultar}><Input label="Data inicial *" type="date" required value={inicio} onChange={event => setInicio(event.target.value)} /><Input label="Data final *" type="date" required value={fim} onChange={event => setFim(event.target.value)} /><Button type="submit">Consultar período</Button><Button variant="secondary" disabled={!resource.data || resource.carregando} icon={<FileDown size={16} />} onClick={exportar}>Baixar CSV</Button></form><Erro>{erro || resource.erro}</Erro></Card>{resource.carregando && periodo ? <p role="status">Preparando relatório…</p> : resource.data ? <><div className="sys-report-totals"><div><span>Atendimentos concluídos</span><strong>{resource.data.quantidade}</strong></div><div><span>Valor dos atendimentos concluídos</span><strong>{moeda(resource.data.valorTotal)}</strong></div></div><p className="sys-note">Valores informativos. Este relatório não registra pagamentos, quitação ou receitas recebidas. Período: {dataLegivel(resource.data.inicio)} a {dataLegivel(resource.data.fim)}.</p>{resource.data.agendamentos.length ? <div className="sys-table-wrap"><table className="sys-table"><thead><tr><th>Data e hora</th><th>Cliente</th><th>Serviços</th><th>Duração</th><th>Valor total</th></tr></thead><tbody>{resource.data.agendamentos.map(item => <tr key={item.id}><td>{dataLegivel(item.dataHora)}<br />{item.dataHora.slice(11, 16)}</td><td>{item.cliente.nome}</td><td>{item.servicos.map(service => service.nome).join(' + ')}</td><td>{item.duracaoTotalMinutos} min</td><td>{moeda(item.valorTotal)}</td></tr>)}</tbody></table></div> : <Vazio>Nenhum atendimento concluído neste período.</Vazio>}</> : <Vazio>Escolha o período e consulte os atendimentos.</Vazio>}</>
}
