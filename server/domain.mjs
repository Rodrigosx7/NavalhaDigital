import { verificarSenha } from './security.mjs'

export class ErroDominio extends Error {
  constructor(message, status = 422, codigo) { super(message); this.status = status; this.codigo = codigo }
}

export function exigir(condicao, mensagem, status = 422, codigo) {
  if (!condicao) throw new ErroDominio(mensagem, status, codigo)
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


// ---------------------------------------------------------------------------
// Entidades do diagrama de classes (Entrega 1 corrigida, Figuras 3 a 5).
// Atributos marcados com "-" no UML são campos privados (#) e só podem ser lidos
// pelos getters; alterações acontecem exclusivamente pelos métodos de negócio.
// ---------------------------------------------------------------------------

export const ESTADOS_FINAIS = ['CONCLUIDO', 'NAO_COMPARECEU', 'CANCELADO']

// Acesso "protegido" (# no UML): somente as classes deste módulo enxergam as
// operações de persistência vinculadas a um usuário.
let executarOperacao

export class Usuario {
  #id
  #nome
  #email
  #senhaHash
  #telefone
  #dataCadastro
  #operacoes

  static {
    executarOperacao = (usuario, nome, ...args) => {
      exigir(usuario.#operacoes, 'Operações do usuário não foram vinculadas.')
      return usuario.#operacoes[nome](usuario, ...args)
    }
  }

  constructor(dados = {}, operacoes) {
    exigir(new.target !== Usuario, 'Usuario é abstrato.')
    this.#id = dados.id ?? null
    this.#nome = dados.nome ?? ''
    this.#email = dados.email ?? ''
    this.#senhaHash = dados.senhaHash ?? null
    this.#telefone = dados.telefone ?? ''
    this.#dataCadastro = dados.dataCadastro ?? null
    this.#operacoes = operacoes
  }

  get id() { return this.#id }
  get nome() { return this.#nome }
  get email() { return this.#email }
  get telefone() { return this.#telefone }
  get dataCadastro() { return this.#dataCadastro }
  get perfil() { throw new ErroDominio('Perfil indefinido para usuário abstrato.', 500) }

  cadastrar(dados) { return executarOperacao(this, 'cadastrar', dados) }

  // Information Expert: o próprio usuário confere a senha contra o hash que possui.
  async autenticar(email, senha) {
    if (typeof email !== 'string' || email.trim().toLowerCase() !== this.#email || typeof senha !== 'string') return false
    const hash = this.#senhaHash ?? (await executarOperacao(this, 'obterSenhaHash'))
    return Boolean(hash) && (await verificarSenha(senha, hash))
  }

  atualizarDados(dados) { return executarOperacao(this, 'atualizarDados', dados) }

  toJSON() {
    return { id: this.#id, perfil: this.perfil, nome: this.#nome, email: this.#email, telefone: this.#telefone, dataCadastro: this.#dataCadastro }
  }
}

export class Cliente extends Usuario {
  #dataNascimento
  #endereco

  constructor(dados = {}, operacoes) {
    exigir(!dados.perfil || dados.perfil === 'CLIENTE', 'Perfil incompatível.')
    super(dados, operacoes)
    this.#dataNascimento = dados.dataNascimento ?? null
    this.#endereco = dados.endereco ?? ''
  }

  get perfil() { return 'CLIENTE' }
  get dataNascimento() { return this.#dataNascimento }
  get endereco() { return this.#endereco }

  consultarAgenda(barbeiroId) { return executarOperacao(this, 'consultarDisponibilidades', barbeiroId) }
  agendar(barbeiroId, servicoIds, dataHora, { chave, ...opcoes } = {}) {
    return executarOperacao(this, 'agendar', { ...opcoes, barbeiroId, servicoIds, dataHora }, chave)
  }
  cancelarAgendamento(agendamentoId, motivo) {
    return executarOperacao(this, 'emTransacaoDoAgendamento', agendamentoId, (agendamento) => agendamento.cancelar(motivo))
  }

  toJSON() { return { ...super.toJSON(), dataNascimento: this.#dataNascimento ?? undefined, endereco: this.#endereco } }
}

export class Barbeiro extends Usuario {
  #registroProfissional
  #bio
  #disponibilidades

  constructor(dados = {}, operacoes) {
    exigir(!dados.perfil || dados.perfil === 'BARBEIRO', 'Perfil incompatível.')
    super(dados, operacoes)
    this.#registroProfissional = dados.registroProfissional ?? ''
    this.#bio = dados.bio ?? ''
    this.#disponibilidades = (dados.disponibilidades ?? []).map((item) => (item instanceof Disponibilidade ? item : new Disponibilidade(item)))
  }

  get perfil() { return 'BARBEIRO' }
  get registroProfissional() { return this.#registroProfissional }
  get bio() { return this.#bio }
  // Associação "define" (Barbeiro 1 — 0..* Disponibilidade).
  get disponibilidades() { return [...this.#disponibilidades] }

  consultarAgenda() { return executarOperacao(this, 'consultarAgenda') }
  agendar(clienteId, servicoIds, dataHora, { chave, ...opcoes } = {}) {
    return executarOperacao(this, 'agendar', { barbeiroId: this.id, ...opcoes, clienteId, servicoIds, dataHora }, chave)
  }
  cancelarAgendamento(agendamentoId, motivo) {
    return executarOperacao(this, 'emTransacaoDoAgendamento', agendamentoId, (agendamento) => agendamento.cancelar(motivo))
  }
  cadastrarHorarios(horario, id) { return executarOperacao(this, 'cadastrarHorarios', horario, id) }
  cadastrarServicos(servico, id) { return executarOperacao(this, 'cadastrarServicos', servico, id) }

  // UC09 / Entrega 2, Figura 3: o barbeiro resolve os identificadores dos serviços
  // e envia reagendar(novaDataHora, novosServicos) ao agendamento (mensagem 2).
  alterarAgendamento(agendamentoId, novaDataHora, servicoIds, { chave, ...opcoes } = {}) {
    return executarOperacao(
      this,
      'emTransacaoDoAgendamento',
      agendamentoId,
      async (agendamento, catalogo) => {
        const novosServicos = await catalogo.resolverServicos(servicoIds)
        await agendamento.reagendar(novaDataHora, novosServicos)
      },
      { exclusivoBarbeiro: true, chave, assinatura: { tipo: 'reagendar', id: agendamentoId, dataHora: novaDataHora, servicoIds, revisao: opcoes.revisao }, revisao: opcoes.revisao },
    )
  }

  gerarRelatorio(inicio, fim) { return executarOperacao(this, 'gerarRelatorio', inicio, fim) }

  // RF08/RN08: o barbeiro escolhe a transição; o agendamento valida e aplica.
  alterarStatus(agendamentoId, novoStatus) {
    return executarOperacao(
      this,
      'emTransacaoDoAgendamento',
      agendamentoId,
      (agendamento) => {
        if (novoStatus === 'CONCLUIDO') return agendamento.concluir()
        if (novoStatus === 'NAO_COMPARECEU') return agendamento.registrarNaoComparecimento()
        if (novoStatus === 'PENDENTE') return agendamento.manterPendente()
        throw new ErroDominio('Situação inválida. Use a operação própria para cancelar.')
      },
      { exclusivoBarbeiro: true },
    )
  }

  toJSON() { return { ...super.toJSON(), registroProfissional: this.#registroProfissional, bio: this.#bio } }
}

// Factory (padrão criacional): única responsável por decidir qual subclasse de
// Usuario instanciar a partir do perfil persistido.
export class FabricaUsuarios {
  #operacoes
  constructor(operacoes) { this.#operacoes = operacoes }
  criar(dados) {
    if (!dados) return null
    if (dados instanceof Usuario) return dados
    exigir(['CLIENTE', 'BARBEIRO'].includes(dados.perfil), 'Perfil inválido.')
    return dados.perfil === 'BARBEIRO' ? new Barbeiro(dados, this.#operacoes) : new Cliente(dados, this.#operacoes)
  }
}

export class Servico {
  #id
  #nome
  #descricao
  #categoria
  #duracaoMinutos
  #precoCentavos
  #ativo

  constructor(dados = {}) {
    this.#id = dados.id ?? null
    this.#aplicar(dados)
    const ativo = dados.ativo ?? true
    exigir(typeof ativo === 'boolean', 'Situação ativa inválida.')
    this.#ativo = ativo
  }

  #aplicar(dados) {
    const nome = texto(dados.nome, 'Nome', 2, 100)
    const descricao = texto(dados.descricao ?? '', 'Descrição', 0, 1000)
    exigir(CATEGORIAS.includes(dados.categoria), 'Categoria inválida.')
    const preco = centavos(dados.preco)
    const duracao = inteiro(dados.duracaoMinutos, 'Duração', 1, 1440)
    this.#nome = nome
    this.#descricao = descricao
    this.#categoria = dados.categoria
    this.#precoCentavos = preco
    this.#duracaoMinutos = duracao
  }

  get id() { return this.#id }
  get nome() { return this.#nome }
  get descricao() { return this.#descricao }
  get categoria() { return this.#categoria }
  get duracaoMinutos() { return this.#duracaoMinutos }
  get preco() { return this.#precoCentavos / 100 }
  get precoCentavos() { return this.#precoCentavos }
  get ativo() { return this.#ativo }

  atualizar(dados) {
    this.#aplicar({
      nome: dados.nome ?? this.#nome,
      descricao: dados.descricao ?? this.#descricao,
      categoria: dados.categoria ?? this.#categoria,
      preco: dados.preco ?? this.preco,
      duracaoMinutos: dados.duracaoMinutos ?? this.#duracaoMinutos,
    })
  }
  desativar() { this.#ativo = false }
  ativar() { this.#ativo = true }

  toJSON() {
    return { id: this.#id, nome: this.#nome, descricao: this.#descricao, categoria: this.#categoria, preco: this.preco, duracaoMinutos: this.#duracaoMinutos, ativo: this.#ativo }
  }
}

export class Disponibilidade {
  #id
  #barbeiroId
  #diaSemana
  #horaInicio
  #horaFim
  #intervaloMinutos
  #ativo

  constructor(dados = {}) {
    exigir(DIAS.includes(dados.diaSemana), 'Dia da semana inválido.')
    const intervalo = inteiro(dados.intervaloMinutos, 'Intervalo', 1, 1440)
    exigir(minutos(dados.horaInicio) < minutos(dados.horaFim), 'O início deve ser anterior ao fim da janela.')
    const ativo = dados.ativo ?? true
    exigir(typeof ativo === 'boolean', 'Situação ativa inválida.')
    this.#id = dados.id ?? null
    this.#barbeiroId = dados.barbeiroId ?? null
    this.#diaSemana = dados.diaSemana
    this.#horaInicio = dados.horaInicio
    this.#horaFim = dados.horaFim
    this.#intervaloMinutos = intervalo
    this.#ativo = ativo
  }

  get id() { return this.#id }
  get barbeiroId() { return this.#barbeiroId }
  get diaSemana() { return this.#diaSemana }
  get horaInicio() { return this.#horaInicio }
  get horaFim() { return this.#horaFim }
  get intervaloMinutos() { return this.#intervaloMinutos }
  get ativo() { return this.#ativo }

  // RN10: janelas ativas do mesmo dia não podem se sobrepor.
  sobrepoe(outra) {
    return this.#ativo && outra.ativo && outra.id !== this.#id && outra.diaSemana === this.#diaSemana &&
      minutos(outra.horaInicio) < minutos(this.#horaFim) && minutos(this.#horaInicio) < minutos(outra.horaFim)
  }

  // Entrega 2, seção 5.2 (dicionário de métodos).
  possuiDisponibilidade(dataHora, duracaoMinutos) {
    try {
      const inicio = validarDataHora(dataHora)
      const hora = minutos(inicio.slice(11, 16))
      const inicioJanela = minutos(this.#horaInicio), fimJanela = minutos(this.#horaFim)
      return (
        this.#ativo &&
        Number.isInteger(duracaoMinutos) && duracaoMinutos > 0 &&
        DIAS[new Date(`${inicio.slice(0, 10)}T12:00Z`).getUTCDay()] === this.#diaSemana &&
        hora >= inicioJanela && hora < fimJanela && hora + duracaoMinutos <= fimJanela &&
        (hora - inicioJanela) % this.#intervaloMinutos === 0
      )
    } catch {
      return false
    }
  }

  toJSON() {
    return { id: this.#id, barbeiroId: this.#barbeiroId, diaSemana: this.#diaSemana, horaInicio: this.#horaInicio, horaFim: this.#horaFim, intervaloMinutos: this.#intervaloMinutos, ativo: this.#ativo }
  }
}

const referencia = (valor, id) => valor ?? (id === undefined || id === null ? null : { id })

export class Agendamento {
  #id
  #dataHora
  #status
  #observacao
  #dataCriacao
  #dataAtualizacao
  #servicos
  #valorCentavos
  #duracaoTotalMinutos
  #cliente
  #barbeiro
  #disponibilidade
  #relogio
  #proposta = null

  constructor(dados = {}) {
    this.#id = dados.id ?? null
    this.#dataHora = dados.dataHora ?? null
    this.#status = dados.status ?? null
    this.#observacao = dados.observacao ?? ''
    this.#dataCriacao = dados.dataCriacao ?? null
    this.#dataAtualizacao = dados.dataAtualizacao ?? null
    this.#servicos = (dados.servicos ?? []).map((item) => (item instanceof Servico ? item : new Servico(item)))
    this.#valorCentavos = dados.valorCentavos ?? (dados.valorTotal === undefined || dados.valorTotal === null ? null : centavos(Number(dados.valorTotal).toFixed(2)))
    this.#duracaoTotalMinutos = dados.duracaoTotalMinutos ?? null
    this.#cliente = referencia(dados.cliente, dados.clienteId)
    this.#barbeiro = referencia(dados.barbeiro, dados.barbeiroId)
    this.#disponibilidade = referencia(dados.disponibilidade, dados.disponibilidadeId)
    this.#relogio = dados.relogio ?? agoraLocal
  }

  get id() { return this.#id }
  get dataHora() { return this.#dataHora }
  get status() { return this.#status }
  get observacao() { return this.#observacao }
  get dataCriacao() { return this.#dataCriacao }
  get dataAtualizacao() { return this.#dataAtualizacao }
  get servicos() { return [...this.#servicos] }
  get valorTotal() { return this.#valorCentavos === null ? null : this.#valorCentavos / 100 }
  get valorCentavos() { return this.#valorCentavos }
  get duracaoTotalMinutos() { return this.#duracaoTotalMinutos }
  get cliente() { return this.#cliente }
  get barbeiro() { return this.#barbeiro }
  get disponibilidade() { return this.#disponibilidade }
  get clienteId() { return this.#cliente?.id ?? null }
  get barbeiroId() { return this.#barbeiro?.id ?? null }
  get disponibilidadeId() { return this.#disponibilidade?.id ?? null }

  // Os cálculos usam a proposta em edição, quando existe (contexto isolado da
  // Entrega 2, seção 3.5); caso contrário, os serviços gravados.
  calcularValorTotal() { return this.#emCalculo().reduce((total, servico) => total + servico.precoCentavos, 0) / 100 }
  calcularDuracaoTotal() { return this.#emCalculo().reduce((total, servico) => total + servico.duracaoMinutos, 0) }

  // UC04 passo 7-8: valida a nova reserva e atribui PENDENTE (RN03, RN04, RN07, RN08).
  async confirmar() {
    exigir(this.#status === null, 'Esta reserva já foi confirmada.')
    exigir(this.#cliente?.id, 'Selecione um cliente cadastrado.')
    const proposta = await this.#validarProposta(this.#dataHora, this.#servicos)
    this.#aplicar(proposta)
    this.#status = 'PENDENTE'
    this.#dataCriacao = proposta.momento
  }

  // UC05 / RN05: somente reservas pendentes que ainda não começaram.
  cancelar(motivo) {
    this.#verificarElegibilidade()
    this.#observacao = texto(motivo, 'Motivo', 3, 500)
    this.#status = 'CANCELADO'
    this.#dataAtualizacao = this.#relogio()
  }

  // RN08: conclusão e falta só depois do término previsto.
  concluir() { this.#finalizar('CONCLUIDO') }
  registrarNaoComparecimento() { this.#finalizar('NAO_COMPARECEU') }
  manterPendente() { exigir(this.#status === 'PENDENTE', 'Um estado final não pode ser alterado.') }

  // UC09 / Entrega 2, seção 5.1 (dicionário de métodos).
  async reagendar(novaDataHora, novosServicos) {
    this.#verificarElegibilidade()
    const proposta = await this.#validarProposta(novaDataHora, novosServicos, this.#id)
    this.#aplicar(proposta)
  }

  #emCalculo() { return this.#proposta?.servicos ?? this.#servicos }

  #fim() {
    const fim = minutos(this.#dataHora.slice(11, 16)) + this.#duracaoTotalMinutos
    return `${this.#dataHora.slice(0, 10)}T${horario(fim)}:00`
  }

  #verificarElegibilidade() {
    exigir(this.#status === 'PENDENTE' && this.#dataHora > this.#relogio(), 'A operação exige uma reserva pendente que ainda não começou.', 422, 'RESERVA_INELEGIVEL')
  }

  #finalizar(estado) {
    exigir(this.#status === 'PENDENTE', 'Um estado final não pode ser alterado.')
    exigir(this.#fim() <= this.#relogio(), 'Aguarde o término previsto do atendimento.')
    this.#status = estado
    this.#dataAtualizacao = this.#relogio()
  }

  // Passos 2 a 6 do dicionário: valida início e serviços, calcula os totais sobre
  // a proposta isolada, pede à Disponibilidade a verificação da janela e ao
  // Barbeiro a sua agenda para detectar sobreposições. Não altera o estado.
  async #validarProposta(dataHora, servicos, ignorarId = null) {
    const momento = this.#relogio()
    const inicio = validarDataHora(dataHora)
    exigir(inicio > momento, 'Escolha um início futuro.')
    exigir(
      Array.isArray(servicos) && servicos.length > 0 && servicos.length <= 30 && new Set(servicos.map((item) => item.id)).size === servicos.length,
      'Selecione um ou mais serviços, sem repetir.',
    )
    exigir(servicos.every((item) => item instanceof Servico && item.ativo), 'Um serviço foi desativado ou não existe. Revise as escolhas.')
    exigir(this.#barbeiro instanceof Barbeiro, 'Barbeiro não encontrado.')
    this.#proposta = { servicos }
    try {
      const [valorTotal, duracao] = [this.calcularValorTotal(), this.calcularDuracaoTotal()]
      const janela = this.#barbeiro.disponibilidades.find((item) => item.possuiDisponibilidade(inicio, duracao))
      exigir(janela, 'O atendimento não cabe em uma janela ativa ou o início está fora da grade.', 409)
      const agenda = await this.#barbeiro.consultarAgenda()
      const conflito = agenda.some(
        (reserva) =>
          reserva.id !== ignorarId &&
          reserva.status !== 'CANCELADO' &&
          reserva.dataHora.slice(0, 10) === inicio.slice(0, 10) &&
          sobrepoe(inicio.slice(11, 16), duracao, reserva.dataHora.slice(11, 16), reserva.duracaoTotalMinutos),
      )
      exigir(!conflito, 'Horário não está mais disponível. Revise suas escolhas.', 409)
      return { inicio, servicos, valorCentavos: Math.round(valorTotal * 100), duracao, janela, momento }
    } finally {
      this.#proposta = null
    }
  }

  #aplicar({ inicio, servicos, valorCentavos, duracao, janela, momento }) {
    this.#dataHora = inicio
    this.#servicos = [...servicos]
    this.#valorCentavos = valorCentavos
    this.#duracaoTotalMinutos = duracao
    this.#disponibilidade = janela
    this.#dataAtualizacao = momento
  }

  toJSON() {
    const resumo = (pessoa) => (pessoa ? { id: pessoa.id, nome: pessoa.nome } : null)
    return {
      id: this.#id,
      clienteId: this.clienteId,
      barbeiroId: this.barbeiroId,
      disponibilidadeId: this.disponibilidadeId,
      cliente: resumo(this.#cliente),
      barbeiro: resumo(this.#barbeiro),
      dataHora: this.#dataHora,
      status: this.#status,
      observacao: this.#observacao,
      dataCriacao: this.#dataCriacao,
      dataAtualizacao: this.#dataAtualizacao,
      valorTotal: this.valorTotal,
      duracaoTotalMinutos: this.#duracaoTotalMinutos,
      servicos: this.#servicos.map((item) => item.toJSON()),
    }
  }
}
