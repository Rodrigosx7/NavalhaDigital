import {
  Agendamento,
  Disponibilidade,
  exigir,
  inteiro,
  horario,
  minutos,
  sobrepoe,
  texto,
  validarData,
  validarDataHora,
} from './domain.mjs'

export class AgendaService {
  constructor(store, clock) {
    this.store = store
    this.clock = clock
  }
  profissional(actor) {
    exigir(actor.perfil === 'BARBEIRO', 'Operação exclusiva do barbeiro.', 403)
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
  elegivel(reserva) {
    exigir(reserva.status === 'PENDENTE' && reserva.dataHora > this.clock(), 'A operação exige uma reserva pendente que ainda não começou.', 422, 'RESERVA_INELEGIVEL')
  }
  revisar(proposta, revisao) {
    if (revisao !== undefined)
      exigir(
        revisao &&
          typeof revisao === 'object' &&
          revisao.valorTotal === proposta.valorTotal &&
          revisao.duracaoTotalMinutos === proposta.duracaoTotalMinutos,
        'Os valores ou a duração foram atualizados. Revise o novo resumo antes de confirmar.',
        409,
      )
  }
  async selecionados(ids) {
    exigir(
      Array.isArray(ids) && ids.length > 0 && ids.length <= 30 && new Set(ids).size === ids.length,
      'Selecione um ou mais serviços, sem repetir.',
    )
    const catalogo = await this.store.servicos()
    return ids.map((id) => {
      inteiro(id, 'Serviço')
      const servico = catalogo.find((item) => item.id === id)
      exigir(servico?.ativo, 'Um serviço foi desativado ou não existe. Revise as escolhas.')
      return servico
    })
  }
  async verificar(barbeiroId, inicio, servicos, excluirId = null) {
    inteiro(barbeiroId, 'Barbeiro')
    exigir((await this.store.getUsuario(barbeiroId))?.perfil === 'BARBEIRO', 'Barbeiro não encontrado.')
    const duracao = new Agendamento({ servicos }).calcularDuracaoTotal()
    const janela = (await this.store.janelas(barbeiroId)).find((item) => new Disponibilidade(item).possuiDisponibilidade(inicio, duracao))
    exigir(janela, 'O atendimento não cabe em uma janela ativa ou o início está fora da grade.', 409)
    const conflito = (await this.store.reservas(barbeiroId)).some(
      (reserva) =>
        reserva.id !== excluirId &&
        reserva.status !== 'CANCELADO' &&
        reserva.dataHora.slice(0, 10) === inicio.slice(0, 10) &&
        sobrepoe(inicio.slice(11, 16), duracao, reserva.dataHora.slice(11, 16), reserva.duracaoTotalMinutos),
    )
    exigir(!conflito, 'Horário não está mais disponível. Revise suas escolhas.', 409)
    return janela
  }
  async horarios(actor, data, barbeiroId, ids, excluirId) {
    validarData(data)
    if (excluirId) {
      this.profissional(actor)
      this.acessivel(actor, await this.store.getReserva(excluirId))
      exigir((await this.store.getReserva(excluirId)).barbeiroId === barbeiroId, 'Barbeiro incompatível.', 403)
    }
    const servicos = await this.selecionados(ids)
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
        if (inicio <= this.clock() || !new Disponibilidade(janela).possuiDisponibilidade(inicio, duracao)) continue
        if (reservas.some((item) => sobrepoe(inicio.slice(11, 16), duracao, item.dataHora.slice(11, 16), item.duracaoTotalMinutos)))
          continue
        slots.set(inicio, { dataHora: inicio, hora: horario(minuto), fim: horario(minuto + duracao), disponibilidadeId: janela.id })
      }
    }
    return [...slots.values()].sort((first, second) => first.dataHora.localeCompare(second.dataHora))
  }
  async criar(actor, data, chave = null) {
    exigir(
      !['cupom', 'couponCode', 'finalPrice', 'valorTotal', 'duracaoTotalMinutos', 'status', 'desconto', 'taxa'].some((key) =>
        Object.hasOwn(data, key),
      ),
      'Valores, estado, descontos e taxas não podem ser informados na criação.',
    )
    const assinatura = JSON.stringify({
      barbeiroId: data.barbeiroId,
      clienteId: data.clienteId,
      servicoIds: data.servicoIds,
      dataHora: data.dataHora,
    })
    return await this.store.transaction(async () => {
      if (chave) {
        texto(chave, 'Identificador de confirmação', 16, 100)
        const previous = await this.store.sql.prepare('SELECT * FROM operacoes WHERE chave=?').get(chave)
        if (previous) {
          exigir(previous.usuario_id === actor.id && previous.assinatura === assinatura, 'Confirmação já usada em outra operação.', 409)
          return await this.store.getReserva(previous.agendamento_id)
        }
      }
      const clienteId = actor.perfil === 'CLIENTE' ? actor.id : inteiro(data.clienteId, 'Cliente')
      if (actor.perfil === 'CLIENTE' && data.clienteId !== undefined)
        exigir(data.clienteId === actor.id, 'Não é possível reservar para outro cliente.', 403)
      if (actor.perfil === 'BARBEIRO') exigir(data.barbeiroId === actor.id, 'Você só pode reservar em sua agenda.', 403)
      exigir((await this.store.getUsuario(clienteId))?.perfil === 'CLIENTE', 'Selecione um cliente cadastrado.')
      const inicio = validarDataHora(data.dataHora)
      exigir(inicio > this.clock(), 'Escolha um início futuro.')
      const servicos = await this.selecionados(data.servicoIds)
      const janela = await this.verificar(data.barbeiroId, inicio, servicos)
      const reserva = new Agendamento({ servicos })
      reserva.confirmar()
      this.revisar(reserva, data.revisao)
      const now = this.clock()
      const result = await this.store.sql
        .prepare(
          'INSERT INTO agendamentos(cliente_id,barbeiro_id,disponibilidade_id,data_hora,status,observacao,data_criacao,data_atualizacao,valor_centavos,duracao,itens) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          clienteId,
          data.barbeiroId,
          janela.id,
          inicio,
          reserva.status,
          this.store.encode(''),
          now,
          now,
          Math.round(reserva.valorTotal * 100),
          reserva.duracaoTotalMinutos,
          JSON.stringify(servicos),
        )
      const id = Number(result.lastInsertRowid)
      if (chave)
        await this.store.sql
          .prepare('INSERT INTO operacoes(chave,usuario_id,agendamento_id,assinatura) VALUES(?,?,?,?)')
          .run(chave, actor.id, id, assinatura)
      return await this.store.getReserva(id)
    })
  }
  async reagendar(actor, id, data, chave = null) {
    this.profissional(actor)
    exigir(
      !['clienteId', 'barbeiroId', 'status', 'valorTotal', 'cupom', 'desconto', 'taxa'].some((key) => Object.hasOwn(data, key)),
      'A edição só altera serviços, data e horário.',
    )
    return await this.store.transaction(async () => {
      const assinatura = JSON.stringify({
        tipo: 'reagendar',
        id,
        dataHora: data.dataHora,
        servicoIds: data.servicoIds,
        revisao: data.revisao,
      })
      if (chave) {
        texto(chave, 'Identificador de confirmação', 16, 100)
        const previous = await this.store.sql.prepare('SELECT * FROM operacoes WHERE chave=?').get(chave)
        if (previous) {
          exigir(previous.usuario_id === actor.id && previous.assinatura === assinatura, 'Confirmação já usada em outra operação.', 409)
          return this.acessivel(actor, await this.store.getReserva(previous.agendamento_id))
        }
      }
      const original = this.acessivel(actor, await this.store.getReserva(id))
      this.elegivel(original)
      const inicio = validarDataHora(data.dataHora)
      exigir(inicio > this.clock(), 'Escolha um início futuro.')
      const servicos = await this.selecionados(data.servicoIds)
      const janela = await this.verificar(actor.id, inicio, servicos, id)
      const candidate = new Agendamento({ ...original })
      candidate.reagendar(inicio, servicos)
      this.revisar(candidate, data.revisao)
      await this.store.sql
        .prepare(
          'UPDATE agendamentos SET data_hora=?,disponibilidade_id=?,valor_centavos=?,duracao=?,itens=?,data_atualizacao=? WHERE id=?',
        )
        .run(
          inicio,
          janela.id,
          Math.round(candidate.valorTotal * 100),
          candidate.duracaoTotalMinutos,
          JSON.stringify(servicos),
          this.clock(),
          id,
        )
      if (chave)
        await this.store.sql
          .prepare('INSERT INTO operacoes(chave,usuario_id,agendamento_id,assinatura) VALUES(?,?,?,?)')
          .run(chave, actor.id, id, assinatura)
      return await this.store.getReserva(id)
    })
  }
  async cancelar(actor, id, motivo) {
    return await this.store.transaction(async () => {
      const reserva = new Agendamento(this.acessivel(actor, await this.store.getReserva(id)))
      this.elegivel(reserva)
      reserva.cancelar(motivo)
      await this.store.sql
        .prepare('UPDATE agendamentos SET status=?,observacao=?,data_atualizacao=? WHERE id=?')
        .run(reserva.status, this.store.encode(reserva.observacao), this.clock(), id)
      return await this.store.getReserva(id)
    })
  }
  async alterarStatus(actor, id, status) {
    this.profissional(actor)
    return await this.store.transaction(async () => {
      const reserva = this.acessivel(actor, await this.store.getReserva(id))
      exigir(reserva.status === 'PENDENTE', 'Um estado final não pode ser alterado.')
      exigir(['PENDENTE', 'CONCLUIDO', 'NAO_COMPARECEU'].includes(status), 'Situação inválida. Use a operação própria para cancelar.')
      if (status !== 'PENDENTE') {
        const fim = minutos(reserva.dataHora.slice(11, 16)) + reserva.duracaoTotalMinutos
        exigir(`${reserva.dataHora.slice(0, 10)}T${horario(fim)}:00` <= this.clock(), 'Aguarde o término previsto do atendimento.')
      }
      await this.store.sql.prepare('UPDATE agendamentos SET status=?,data_atualizacao=? WHERE id=?').run(status, this.clock(), id)
      return await this.store.getReserva(id)
    })
  }
  async salvarJanela(actor, data, id) {
    this.profissional(actor)
    return await this.store.transaction(async () => {
      if (id) {
        const original = this.store.janela(await this.store.sql.prepare('SELECT * FROM disponibilidades WHERE id=?').get(id))
        exigir(original, 'Janela não encontrada.', 404)
        exigir(original.barbeiroId === actor.id, 'Esta janela pertence a outro barbeiro.', 403)
      }
      const janela = new Disponibilidade({ ...data, barbeiroId: actor.id })
      if (janela.ativo)
        exigir(
          !(await this.store.janelas(actor.id)).some(
            (item) =>
              item.id !== id &&
              item.ativo &&
              item.diaSemana === janela.diaSemana &&
              minutos(item.horaInicio) < minutos(janela.horaFim) &&
              minutos(janela.horaInicio) < minutos(item.horaFim),
          ),
          'Essa janela se sobrepõe a outra janela ativa.',
          409,
        )
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
      }
      if (id)
        await this.store.sql
          .prepare('UPDATE disponibilidades SET dia=?,inicio=?,fim=?,intervalo=?,ativo=? WHERE id=?')
          .run(janela.diaSemana, janela.horaInicio, janela.horaFim, janela.intervaloMinutos, Number(janela.ativo), id)
      else
        id = Number(
          (
            await this.store.sql
              .prepare('INSERT INTO disponibilidades(barbeiro_id,dia,inicio,fim,intervalo,ativo) VALUES(?,?,?,?,?,?)')
              .run(actor.id, janela.diaSemana, janela.horaInicio, janela.horaFim, janela.intervaloMinutos, Number(janela.ativo))
          ).lastInsertRowid,
        )
      return { ...janela, id, barbeiroId: actor.id }
    })
  }
}
