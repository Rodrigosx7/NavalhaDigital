import test from 'node:test'
import assert from 'node:assert/strict'
import { fimAtendimento } from '../src/services/reservation.js'

test('resumo informa o término das reservas de 50 e 35 minutos do documento', () => {
  assert.equal(fimAtendimento({ dataHora: '2026-10-23T09:00:00', duracaoTotalMinutos: 50 }), '09:50')
  assert.equal(fimAtendimento({ dataHora: '2026-10-23T11:00:00', duracaoTotalMinutos: 35 }), '11:35')
})
