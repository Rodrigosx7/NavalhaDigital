import test from 'node:test'
import assert from 'node:assert/strict'
import { ConfirmacaoReserva } from '../src/services/confirmation.js'

test('resposta perdida preserva payload e chave até recuperar confirmação', async () => {
  const calls = [], attempt = new ConfirmacaoReserva(async (path, options) => { calls.push({ path, ...options }); if (calls.length === 1) throw new TypeError('Rede caiu depois de gravar'); return { agendamento: { id: 401 } } }, () => 'chave-original')
  const proposta = { path: '/agendamentos', method: 'POST', body: { dataHora: '2026-10-23T09:00', servicoIds: [201, 202] } }
  await assert.rejects(attempt.enviar(proposta))
  assert.equal(attempt.pendente, true)
  proposta.body.dataHora = '2026-10-23T11:00'
  const result = await attempt.enviar(proposta)
  assert.equal(result.agendamento.id, 401)
  assert.equal(attempt.pendente, false)
  assert.deepEqual(calls[0], calls[1])
  assert.equal(calls[1].body.dataHora, '2026-10-23T09:00')
})

test('uma rejeição definitiva permite nova proposta com nova chave', async () => {
  let count = 0
  const calls = [], attempt = new ConfirmacaoReserva(async (path, options) => { calls.push(options); if (calls.length === 1) { const error = new Error('Conflito'); error.status = 409; throw error } return { agendamento: { id: 402 } } }, () => 'chave-' + ++count)
  await assert.rejects(attempt.enviar({ path: '/agendamentos', method: 'POST', body: { dataHora: '2026-10-23T09:00' } }))
  assert.equal(attempt.pendente, false)
  await attempt.enviar({ path: '/agendamentos', method: 'POST', body: { dataHora: '2026-10-23T11:00' } })
  assert.notEqual(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key'])
})

test('edição encerra na inelegibilidade e permite revisão apenas das escolhas rejeitadas', async () => {
  for (const [error, esperado] of [
    [{ status: 422, codigo: 'RESERVA_INELEGIVEL' }, 'ENCERRAR'],
    [{ status: 403, codigo: 'RESERVA_SEM_ACESSO' }, 'ENCERRAR'],
    [{ status: 404, codigo: 'RESERVA_NAO_ENCONTRADA' }, 'ENCERRAR'],
    [{ status: 409 }, 'REVISAR'],
    [{ status: 422 }, 'REVISAR'],
    [{ status: 500 }, 'VERIFICAR'],
    [new TypeError('Sem conexão'), 'VERIFICAR'],
  ]) {
    const tentativa = new ConfirmacaoReserva(async () => { throw error })
    await assert.rejects(tentativa.enviar({ path: '/agendamentos/401', method: 'PUT', body: {} }))
    assert.equal(tentativa.acaoAposErro(error, true), esperado)
  }
})
