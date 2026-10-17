export class ErroDominio extends Error {
  constructor(message, status = 422) { super(message); this.status = status }
}

export function exigir(condicao, mensagem, status = 422) {
  if (!condicao) throw new ErroDominio(mensagem, status)
}

export const DIAS = ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']
export const CATEGORIAS = ['CORTE', 'BARBA', 'TRATAMENTO', 'OUTRO']
export const ESTADOS = ['PENDENTE', 'CONCLUIDO', 'NAO_COMPARECEU', 'CANCELADO']

export function texto(value, label, minimum = 1, maximum = 200) {
  exigir(typeof value === 'string' && value.trim().length >= minimum && value.trim().length <= maximum, `${label}: informe entre ${minimum} e ${maximum} caracteres.`)
  return value.trim()
}

export function inteiro(value, label, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  exigir(Number.isSafeInteger(value) && value >= minimum && value <= maximum, `${label} inválido.`)
  return value
}

export function centavos(value) {
  exigir((typeof value === 'number' || typeof value === 'string') && /^\d+(?:\.\d{1,2})?$/.test(String(value)), 'Preço deve ser não negativo e ter no máximo duas casas decimais.')
  const [whole, decimal = ''] = String(value).split('.')
  return inteiro(Number(whole) * 100 + Number(decimal.padEnd(2, '0')), 'Preço', 0, 100_000_000)
}

export function minutos(horario) {
  exigir(typeof horario === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(horario), 'Horário inválido.')
  return Number(horario.slice(0, 2)) * 60 + Number(horario.slice(3))
}

export function horario(total) { return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` }

export function validarData(data) {
  exigir(typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data), 'Data inválida.')
  const parsed = new Date(`${data}T12:00:00Z`)
  exigir(!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === data, 'Data inexistente.')
  return data
}

export function validarDataHora(value) {
  exigir(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:00)?$/.test(value), 'Data e hora inválidas. Use o horário da barbearia.')
  validarData(value.slice(0, 10)); minutos(value.slice(11, 16))
  return `${value.slice(0, 16)}:00`
}

export function agoraLocal() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

export function sobrepoe(inicio, duracao, outroInicio, outraDuracao) {
  return minutos(inicio) < minutos(outroInicio) + outraDuracao && minutos(outroInicio) < minutos(inicio) + duracao
}

export class Usuario {
  constructor(data) { exigir(new.target !== Usuario, 'Usuario é abstrato.'); Object.assign(this, data) }
  atualizarDados(data) { Object.assign(this, data) }
}

export class Cliente extends Usuario {}
export class Barbeiro extends Usuario {}

export class Servico {
  constructor(data) {
    Object.assign(this, data, { nome: texto(data.nome, 'Nome', 2, 100), descricao: texto(data.descricao ?? '', 'Descrição', 0, 1000), preco: centavos(data.preco) / 100, duracaoMinutos: inteiro(data.duracaoMinutos, 'Duração', 1, 1440), ativo: data.ativo ?? true })
    exigir(CATEGORIAS.includes(this.categoria), 'Categoria inválida.')
    exigir(typeof this.ativo === 'boolean', 'Situação ativa inválida.')
  }
  atualizar(data) { Object.assign(this, new Servico({ ...this, ...data })) }
  desativar() { this.ativo = false }
}

export class Disponibilidade {
  constructor(data) {
    Object.assign(this, data, { intervaloMinutos: inteiro(data.intervaloMinutos, 'Intervalo', 1, 1440), ativo: data.ativo ?? true })
    exigir(DIAS.includes(this.diaSemana), 'Dia da semana inválido.')
    exigir(minutos(this.horaInicio) < minutos(this.horaFim), 'O início deve ser anterior ao fim da janela.')
    exigir(typeof this.ativo === 'boolean', 'Situação ativa inválida.')
  }
  possuiDisponibilidade(dataHora, duracaoMinutos) {
    try {
      const inicio = validarDataHora(dataHora)
      const hora = minutos(inicio.slice(11, 16))
      return this.ativo && Number.isInteger(duracaoMinutos) && duracaoMinutos > 0 && DIAS[new Date(`${inicio.slice(0, 10)}T12:00Z`).getUTCDay()] === this.diaSemana && hora >= minutos(this.horaInicio) && hora < minutos(this.horaFim) && hora + duracaoMinutos <= minutos(this.horaFim) && (hora - minutos(this.horaInicio)) % this.intervaloMinutos === 0
    } catch { return false }
  }
}

export class Agendamento {
  constructor(data) { Object.assign(this, data) }
  calcularValorTotal() { return this.servicos.reduce((total, servico) => total + centavos(servico.preco), 0) / 100 }
  calcularDuracaoTotal() { return this.servicos.reduce((total, servico) => total + servico.duracaoMinutos, 0) }
  confirmar() { this.status = 'PENDENTE'; this.valorTotal = this.calcularValorTotal(); this.duracaoTotalMinutos = this.calcularDuracaoTotal() }
  cancelar(motivo) { this.observacao = texto(motivo, 'Motivo', 3, 500); this.status = 'CANCELADO' }
  concluir() { this.status = 'CONCLUIDO' }
  reagendar(novaDataHora, novosServicos) { this.dataHora = validarDataHora(novaDataHora); this.servicos = novosServicos; this.valorTotal = this.calcularValorTotal(); this.duracaoTotalMinutos = this.calcularDuracaoTotal() }
}
