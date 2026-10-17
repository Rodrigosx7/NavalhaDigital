import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { fimAtendimento } from '../../services/reservation.js'
import './System.css'

export const moeda = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const dataLegivel = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value.slice(0, 10) + 'T12:00Z')) : ''
export const STATUS = { PENDENTE: 'Pendente', CONCLUIDO: 'Concluído', NAO_COMPARECEU: 'Não compareceu', CANCELADO: 'Cancelado' }
export const DIAS = ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']
export const NOMES_DIAS = { DOMINGO: 'Domingo', SEGUNDA: 'Segunda-feira', TERCA: 'Terça-feira', QUARTA: 'Quarta-feira', QUINTA: 'Quinta-feira', SEXTA: 'Sexta-feira', SABADO: 'Sábado' }
export const CATEGORIAS = { CORTE: 'Corte', BARBA: 'Barba', TRATAMENTO: 'Tratamento', OUTRO: 'Outro' }
export function Erro({ children }) { return children ? <p role="alert" className="sys-error">{children}</p> : null }
export function Vazio({ children }) { return <div className="sys-empty">{children}</div> }
export function Status({ value }) { return <span className={`sys-status sys-status--${value}`}>{STATUS[value] || value}</span> }
export function Cabecalho({ titulo, descricao, children }) { return <header className="sys-heading"><div><h1>{titulo}</h1>{descricao && <p>{descricao}</p>}</div>{children}</header> }
export function Campo({ label, children, ...props }) { return <label className="sys-field"><span>{label}</span><select {...props}>{children}</select></label> }
export function useResource(path) {
  const [data, setData] = useState(null), [erro, setErro] = useState(''), [carregando, setCarregando] = useState(true), [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao(value => value + 1), [])
  useEffect(() => {
    if (!path) { setData(null); setCarregando(false); return }
    const abort = new AbortController(); setCarregando(true); setErro('')
    api(path, { signal: abort.signal }).then(setData).catch(error => { if (error.name !== 'AbortError') { setData(null); setErro(error.message) } }).finally(() => { if (!abort.signal.aborted) setCarregando(false) })
    return () => abort.abort()
  }, [path, versao])
  return { data, erro, carregando, recarregar }
}
export function Protegido({ profissional = false, children }) {
  const { usuario, carregando, erro } = useAuth(), location = useLocation()
  if (carregando) return <div className="container sys-page" role="status">Verificando sua sessão…</div>
  if (erro) return <div className="container sys-page"><Erro>{erro}</Erro><button className="btn btn--secondary" onClick={() => window.location.reload()}>Tentar novamente</button></div>
  if (!usuario) return <Navigate to={'/entrar?destino=' + encodeURIComponent(location.pathname + location.search)} replace />
  if (profissional && usuario.perfil !== 'BARBEIRO') return <Navigate to="/meus-agendamentos" replace />
  return children
}
export function Resumo({ reserva }) {
  return <dl className="sys-summary"><div><dt>Cliente</dt><dd>{reserva.cliente.nome}</dd></div><div><dt>Barbeiro</dt><dd>{reserva.barbeiro.nome}</dd></div><div><dt>Data</dt><dd>{dataLegivel(reserva.dataHora)}</dd></div><div><dt>Horário</dt><dd>{reserva.dataHora.slice(11, 16)} · horário de Brasília</dd></div><div><dt>Término previsto</dt><dd>{fimAtendimento(reserva)}</dd></div><div><dt>Serviços</dt><dd>{reserva.servicos.map(item => item.nome).join(', ')}</dd></div><div><dt>Duração</dt><dd>{reserva.duracaoTotalMinutos} minutos</dd></div><div><dt>Valor da reserva</dt><dd>{moeda(reserva.valorTotal)}</dd></div><div><dt>Situação</dt><dd><Status value={reserva.status} /></dd></div></dl>
}
