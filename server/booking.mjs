import { Agendamento, Disponibilidade, exigir, inteiro, horario, minutos, sobrepoe, texto, validarData } from './domain.mjs'
import { UsuariosService } from './users.mjs'

// Camada de serviço (Facade + Pure Fabrication/GRASP): coordena transação,
// idempotência e persistência. As regras de negócio ficam nas entidades.
export class AgendaService {
  #usuarios

  constructor(store, clock, usuarios) {
    this.store = store
    this.clock = clock
    this.#usuarios = usuarios
  }

  get usuarios() {
    this.#usuarios ??= new UsuariosService(this.store, this, this.clock)
    return this.#usuarios
  }
  set usuarios(value) {
    this.#usuarios = value
  }

  profissional(actor) {
    exigir(actor?.perfil === 'BARBEIRO', 'Operação exclusiva do barbeiro.', 403)
  }

  acessivel(actor, reserva) {
    exigir(reserva, 'Agendamento não encontrado.', 404, 'RESERVA_NAO_ENCONTRADA')
    exigir(
      actor.perfil === 'CLIENTE' ? reserva.clienteId === actor.id : reserva.barbeiroId === actor.id,
      'Você não tem acesso a este agendamento.',
      403,
      'RESERVA_SEM_ACESSO',
    )
    return reserva
  }

  revisar(agendamento, revisao) {
    if (revisao !== undefined)
      exigir(
        revisao &&
          typeof revisao === 'object' &&
          revisao.valorTotal === agendamento.valorTotal &&
          revisao.duracaoTotalMinutos === agendamento.duracaoTotalMinutos,
        'Os valores ou a duração foram atualizados. Revise o novo resumo antes de confirmar.',
        409,
      )
  }

  // Converte identificadores em objetos Servico do catálogo. A validação da
  // seleção (vazia, repetida, inativa) é responsabilidade do Agendamento.
  async resolverServicos(ids) {
    exigir(Array.isArray(ids), 'Selecione um ou mais serviços, sem repetir.')
    const catalogo = await this.store.servicos()
    return ids.map((id) => {
      inteiro(id, 'Serviço')
      const servico = catalogo.find((item) => item.id === id)
      exigir(servico, 'Um serviço foi desativado ou não existe. Revise as escolhas.')
      return servico
    })
  }

  // Barbeiro com suas janelas (associação "define") e operações vinculadas.
  async carregarBarbeiro(barbeiroId) {
    inteiro(barbeiroId, 'Barbeiro')
    const dados = await this.store.getUsuario(barbeiroId)
    exigir(dados?.perfil === 'BARBEIRO', 'Barbeiro não encontrado.')
    return this.usuarios.usuario({ ...dados, disponibilidades: await this.store.janelas(barbeiroId) })
  }

  async horarios(actor, data, barbeiroId, ids, excluirId) {
    validarData(data)
    if (excluirId) {
      this.profissional(actor)
      const reserva = this.acessivel(actor, await this.store.getReserva(excluirId))
      exigir(reserva.barbeiroId === barbeiroId, 'Barbeiro incompatível.', 403)
    }
    exigir(Array.isArray(ids) && ids.length > 0 && ids.length <= 30 && new Set(ids).size === ids.length, 'Selecione um ou mais serviços, sem repetir.')
    const servicos = await this.resolverServicos(ids)
    exigir(servicos.every((item) => item.ativo), 'Um serviço foi desativado ou não existe. Revise as escolhas.')
    inteiro(barbeiroId, 'Barbeiro')
    exigir((await this.store.getUsuario(barbeiroId))?.perfil === 'BARBEIRO', 'Barbeiro não encontrado.')
    const duracao = new Agendamento({ servicos }).calcularDuracaoTotal()
    const reservas = (await this.store.reservas(barbeiroId)).filter(
      (item) => item.id !== excluirId && item.status !== 'CANCELADO' && item.dataHora.slice(0, 10) === data,
    )
    const slots = new Map()
    for (const janela of (await this.store.janelas(barbeiroId)).filter((item) => item.ativo)) {
      for (let minuto = minutos(janela.horaInicio); minuto + duracao <= minutos(janela.horaFim); minuto += janela.intervaloMinutos) {
        const inicio = `${data}T${horario(minuto)}:00`
        if (inicio <= this.clock() || !janela.possuiDisponibilidade(inicio, duracao)) continue
        if (reservas.some((item) => sobrepoe(inicio.slice(11, 16), duracao, item.dataHora.slice(11, 16), item.duracaoTotalMinutos))) continue
        slots.set(inicio, { dataHora: inicio, hora: horario(minuto), fim: horario(minuto + duracao), disponibilidadeId: janela.id })
      }
    }
    return [...slots.values()].sort((first, second) => first.dataHora.localeCompare(second.dataHora))
  }

  async #idempotente(actor, chave, assinatura) {
    if (!chave) return null
    texto(chave, 'Identificador de confirmação', 16, 100)
    const previous = await this.store.sql.prepare('SELECT * FROM operacoes WHERE chave=?').get(chave)
    if (!previous) return null
    exigir(previous.usuario_id === actor.id && previous.assinatura === assinatura, 'Confirmação já usada em outra operação.', 409)
    return previous
  }

  async #registrarOperacao(actor, chave, agendamentoId, assinatura) {
    if (chave)
      await this.store.sql
        .prepare('INSERT INTO operacoes(chave,usuario_id,agendamento_id,assinatura) VALUES(?,?,?,?)')
        .run(chave, actor.id, agendamentoId, assinatura)
  }

  // UC04: Cliente.agendar / Barbeiro.agendar → Agendamento.confirmar().
  async criar(actor, data, chave = null) {
    exigir(
      !['cupom', 'couponCode', 'finalPrice', 'valorTotal', 'duracaoTotalMinutos', 'status', 'desconto', 'taxa'].some((key) => Object.hasOwn(data, key)),
      'Valores, estado, descontos e taxas não podem ser informados na criação.',
    )
    const assinatura = JSON.stringify({ barbeiroId: data.barbeiroId, clienteId: data.clienteId, servicoIds: data.servicoIds, dataHora: data.dataHora })
    return await this.store.transaction(async () => {
      const previous = await this.#idempotente(actor, chave, assinatura)
      if (previous) return await this.store.getReserva(previous.agendamento_id)
      const clienteId = actor.perfil === 'CLIENTE' ? actor.id : inteiro(data.clienteId, 'Cliente')
      if (actor.perfil === 'CLIENTE' && data.clienteId !== undefined) exigir(data.clienteId === actor.id, 'Não é possível reservar para outro cliente.', 403)
      if (actor.perfil === 'BARBEIRO') exigir(data.barbeiroId === actor.id, 'Você só pode reservar em sua agenda.', 403)
      const cliente = await this.store.getUsuario(clienteId)
      exigir(cliente?.perfil === 'CLIENTE', 'Selecione um cliente cadastrado.')
      const servicos = await this.resolverServicos(data.servicoIds)
      const barbeiro = await this.carregarBarbeiro(data.barbeiroId)
      const agendamento = new Agendamento({ cliente: this.usuarios.usuario(cliente), barbeiro, dataHora: data.dataHora, servicos, relogio: this.clock })
      await agendamento.confirmar()
      this.revisar(agendamento, data.revisao)
      const result = await this.store.sql
        .prepare(
          'INSERT INTO agendamentos(cliente_id,barbeiro_id,disponibilidade_id,data_hora,status,observacao,data_criacao,data_atualizacao,valor_centavos,duracao,itens) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          agendamento.clienteId,
          agendamento.barbeiroId,
          agendamento.disponibilidadeId,
          agendamento.dataHora,
          agendamento.status,
          this.store.encode(agendamento.observacao),
          agendamento.dataCriacao,
          agendamento.dataAtualizacao,
          agendamento.valorCentavos,
          agendamento.duracaoTotalMinutos,
          JSON.stringify(agendamento.servicos),
        )
      const id = Number(result.lastInsertRowid)
      await this.#registrarOperacao(actor, chave, id, assinatura)
      return await this.store.getReserva(id)
    })
  }

  // Unidade de trabalho para operações sobre uma reserva existente (UC05, UC09,
  // UC12): carrega o agendamento com seu Barbeiro, entrega-o ao usuário que
  // envia a mensagem de negócio e grava o resultado na mesma transação.
  async emTransacaoDoAgendamento(actor, id, operacao, { exclusivoBarbeiro = false, chave = null, assinatura, revisao } = {}) {
    if (exclusivoBarbeiro) this.profissional(actor)
    const assinaturaTexto = assinatura === undefined ? undefined : JSON.stringify(assinatura)
    return await this.store.transaction(async () => {
      const previous = await this.#idempotente(actor, chave, assinaturaTexto)
      if (previous) return this.acessivel(actor, await this.store.getReserva(previous.agendamento_id))
      const atual = this.acessivel(actor, await this.store.getReserva(id))
      const barbeiro = await this.carregarBarbeiro(atual.barbeiroId)
      const agendamento = await this.store.getReserva(id, { barbeiro, relogio: this.clock })
      await operacao(agendamento, { resolverServicos: (ids) => this.resolverServicos(ids) })
      this.revisar(agendamento, revisao)
      await this.salvar(agendamento)
      await this.#registrarOperacao(actor, chave, id, assinaturaTexto)
      return await this.store.getReserva(id)
    })
  }

  async salvar(agendamento) {
    await this.store.sql
      .prepare('UPDATE agendamentos SET data_hora=?,disponibilidade_id=?,status=?,observacao=?,data_atualizacao=?,valor_centavos=?,duracao=?,itens=? WHERE id=?')
      .run(
        agendamento.dataHora,
        agendamento.disponibilidadeId,
        agendamento.status,
        this.store.encode(agendamento.observacao),
        agendamento.dataAtualizacao,
        agendamento.valorCentavos,
        agendamento.duracaoTotalMinutos,
        JSON.stringify(agendamento.servicos),
        agendamento.id,
      )
  }

  // UC11 / RN10.
  async salvarJanela(actor, data, id) {
    this.profissional(actor)
    return await this.store.transaction(async () => {
      if (id) {
        const original = this.store.janela(await this.store.sql.prepare('SELECT * FROM disponibilidades WHERE id=?').get(id))
        exigir(original, 'Janela não encontrada.', 404)
        exigir(original.barbeiroId === actor.id, 'Esta janela pertence a outro barbeiro.', 403)
      }
      const { id: _ignorado, ...campos } = data
      const janela = new Disponibilidade({ ...campos, id: id ?? null, barbeiroId: actor.id })
      exigir(!(await this.store.janelas(actor.id)).some((item) => janela.sobrepoe(item)), 'Essa janela se sobrepõe a outra janela ativa.', 409)
      if (id) {
        const afetadas = (await this.store.reservas(actor.id)).filter(
          (item) =>
            item.disponibilidadeId === id &&
            item.status === 'PENDENTE' &&
            item.dataHora > this.clock() &&
            !janela.possuiDisponibilidade(item.dataHora, item.duracaoTotalMinutos),
        )
        exigir(
          !afetadas.length,
          'Trate as reservas futuras antes de alterar esta janela: ' +
            afetadas
              .slice(0, 10)
              .map((item) => `#${item.id} (${item.dataHora.slice(0, 10)} às ${item.dataHora.slice(11, 16)})`)
              .join(', ') +
            (afetadas.length > 10 ? ` e outras ${afetadas.length - 10}.` : '.'),
          409,
        )
        await this.store.sql
          .prepare('UPDATE disponibilidades SET dia=?,inicio=?,fim=?,intervalo=?,ativo=? WHERE id=?')
          .run(janela.diaSemana, janela.horaInicio, janela.horaFim, janela.intervaloMinutos, Number(janela.ativo), id)
        return janela
      }
      const novoId = Number(
        (
          await this.store.sql
            .prepare('INSERT INTO disponibilidades(barbeiro_id,dia,inicio,fim,intervalo,ativo) VALUES(?,?,?,?,?,?)')
            .run(actor.id, janela.diaSemana, janela.horaInicio, janela.horaFim, janela.intervaloMinutos, Number(janela.ativo))
        ).lastInsertRowid,
      )
      return this.store.janela({ id: novoId, barbeiro_id: actor.id, dia: janela.diaSemana, inicio: janela.horaInicio, fim: janela.horaFim, intervalo: janela.intervaloMinutos, ativo: janela.ativo })
    })
  }
}

