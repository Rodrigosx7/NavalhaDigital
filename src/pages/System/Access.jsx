import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Scissors, ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import Input from '../../components/ui/Input.jsx'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import { Cabecalho, Campo, Erro } from './shared.jsx'

function DadosCadastro({ dados, mudar, profissional, conta = false }) {
  return <><Input label="Nome completo *" autoComplete="name" required minLength={3} maxLength={100} value={dados.nome} onChange={event => mudar('nome', event.target.value)} /><Input label="E-mail *" type="email" autoComplete="email" required maxLength={254} value={dados.email} onChange={event => mudar('email', event.target.value)} disabled={conta && profissional} /><Input label="Telefone *" type="tel" autoComplete="tel" required maxLength={22} value={dados.telefone} onChange={event => mudar('telefone', event.target.value)} />{profissional ? <><Input label="Registro profissional *" required maxLength={100} value={dados.registroProfissional} onChange={event => mudar('registroProfissional', event.target.value)} /><label className="sys-field"><span>Sobre seu trabalho</span><textarea maxLength={1000} value={dados.bio} onChange={event => mudar('bio', event.target.value)} /></label></> : <><Input label="Data de nascimento (opcional)" type="date" value={dados.dataNascimento} onChange={event => mudar('dataNascimento', event.target.value)} /><Input label="Endereço (opcional)" autoComplete="street-address" maxLength={300} value={dados.endereco} onChange={event => mudar('endereco', event.target.value)} /></>}</>
}

export default function Access({ cadastro = false }) {
  const auth = useAuth(), navigate = useNavigate(), [params] = useSearchParams()
  const [dados, setDados] = useState({ nome: '', email: '', telefone: '', senha: '', codigoAutorizacao: '', perfil: params.get('perfil') === 'BARBEIRO' ? 'BARBEIRO' : 'CLIENTE', registroProfissional: '', bio: '', dataNascimento: '', endereco: '' })
  const [erro, setErro] = useState(''), [enviando, setEnviando] = useState(false)
  const mudar = (field, value) => setDados(current => ({ ...current, [field]: value }))
  const destino = user => { const requested = params.get('destino'); return requested?.startsWith('/') && !requested.startsWith('//') ? requested : user.perfil === 'BARBEIRO' ? '/barbeiro' : '/meus-agendamentos' }
  if (auth.usuario) return <Navigate to={destino(auth.usuario)} replace />
  async function enviar(event) {
    event.preventDefault(); if (enviando) return; setEnviando(true); setErro('')
    try { const user = await (cadastro ? auth.cadastrar(dados) : auth.entrar({ email: dados.email, senha: dados.senha })); navigate(destino(user), { replace: true }) } catch (error) { setErro(error.message) } finally { setEnviando(false) }
  }
  return <div className="container sys-page sys-access"><aside className="sys-access-story"><Scissors size={42} /><h1>Seu próximo cuidado começa aqui.</h1><p>Uma conta para escolher seus serviços, reservar seu horário e acompanhar seus atendimentos.</p><p>Os barbeiros têm sua própria agenda, com horários e clientes organizados.</p><Link to="/">Voltar ao início</Link></aside><Card className="sys-access-form" ornament><h2>{cadastro ? 'Crie sua conta' : 'Entre na sua conta'}</h2><p className="sys-muted">{cadastro ? 'Campos com * são obrigatórios.' : 'Use o e-mail e a senha do seu cadastro.'}</p><form onSubmit={enviar} className="sys-form">{cadastro ? <><Campo label="Tipo de conta" value={dados.perfil} onChange={event => mudar('perfil', event.target.value)}><option value="CLIENTE">Cliente</option><option value="BARBEIRO">Barbeiro autorizado</option></Campo>{dados.perfil === 'BARBEIRO' && <><p className="sys-note">Solicite à barbearia seu código de autorização pessoal. Ele só pode ser usado uma vez e deve corresponder ao seu e-mail.</p><Input label="Código de autorização *" type="password" autoComplete="off" required minLength={16} maxLength={128} value={dados.codigoAutorizacao} onChange={event => mudar('codigoAutorizacao', event.target.value)} /></>}<DadosCadastro dados={dados} mudar={mudar} profissional={dados.perfil === 'BARBEIRO'} /></> : <Input label="E-mail *" type="email" required autoComplete="username" value={dados.email} onChange={event => mudar('email', event.target.value)} />}<Input label="Senha *" type="password" autoComplete={cadastro ? 'new-password' : 'current-password'} required minLength={10} maxLength={128} helperText={cadastro ? 'Use entre 10 e 128 caracteres.' : undefined} value={dados.senha} onChange={event => mudar('senha', event.target.value)} /><Erro>{erro}</Erro><Button type="submit" disabled={enviando || auth.carregando} fullWidth iconRight={<ArrowRight size={16} />}>{enviando ? 'Aguarde…' : cadastro ? 'Criar conta' : 'Entrar'}</Button></form><p className="sys-form-switch">{cadastro ? 'Já tem uma conta? ' : 'Primeira visita? '}<Link to={(cadastro ? '/entrar' : '/cadastro') + (params.get('destino') ? '?destino=' + encodeURIComponent(params.get('destino')) : '')}>{cadastro ? 'Entrar' : 'Criar minha conta'}</Link></p></Card></div>
}

export function Account() {
  const { usuario, atualizar } = useAuth()
  const [dados, setDados] = useState({ dataNascimento: '', endereco: '', registroProfissional: '', bio: '', ...usuario })
  const [erro, setErro] = useState(''), [mensagem, setMensagem] = useState(''), [salvando, setSalvando] = useState(false)
  async function enviar(event) { event.preventDefault(); setSalvando(true); setErro(''); setMensagem(''); try { const { perfil, id, dataCadastro, ...body } = dados; await atualizar(body); setMensagem('Seus dados foram atualizados.') } catch (error) { setErro(error.message) } finally { setSalvando(false) } }
  return <div className="container sys-page sys-narrow"><Cabecalho titulo="Minha conta" descricao={usuario.perfil === 'BARBEIRO' ? 'Dados do seu perfil profissional.' : 'Mantenha seus dados de contato atualizados.'} /><Card><form onSubmit={enviar} className="sys-form"><DadosCadastro dados={dados} mudar={(field, value) => setDados(current => ({ ...current, [field]: value }))} profissional={usuario.perfil === 'BARBEIRO'} conta /><Erro>{erro}</Erro>{mensagem && <p role="status" className="sys-success">{mensagem}</p>}<Button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar dados'}</Button></form></Card></div>
}
