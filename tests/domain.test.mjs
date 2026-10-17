import test from 'node:test'
import assert from 'node:assert/strict'
import { Agendamento, Disponibilidade, Servico, sobrepoe, validarData, validarDataHora } from '../server/domain.mjs'

const janela = new Disponibilidade({ id: 301, barbeiroId: 101, diaSemana: 'SEXTA', horaInicio: '08:00', horaFim: '18:00', intervaloMinutos: 10, ativo: true })

test('grade pertence à janela e duração não precisa ser múltipla do intervalo', () => {
  assert.equal(janela.possuiDisponibilidade('2026-10-23T09:00', 50), true)
  assert.equal(janela.possuiDisponibilidade('2026-10-23T11:00', 35), true)
  for (const [inicio, duracao] of [['2026-10-23T09:05', 50], ['2026-10-23T17:30', 40], ['2026-10-23T18:00', 10], ['2026-10-24T09:00', 50]]) {
    assert.equal(janela.possuiDisponibilidade(inicio, duracao), false)
  }
})

test('reservas consecutivas não conflitam, mas sobreposição parcial conflita', () => {
  assert.equal(sobrepoe('09:00', 50, '09:50', 30), false)
  assert.equal(sobrepoe('09:00', 50, '09:40', 30), true)
})

test('soma monetária exata e duração do exemplo Corte + Barba', () => {
  const servicos = [new Servico({ id: 201, nome: 'Corte', descricao: 'Corte tradicional', categoria: 'CORTE', preco: 40, duracaoMinutos: 30, ativo: true }), new Servico({ id: 202, nome: 'Barba', descricao: 'Barba', categoria: 'BARBA', preco: 25, duracaoMinutos: 20, ativo: true })]
  const reserva = new Agendamento({ servicos })
  assert.equal(reserva.calcularValorTotal(), 65)
  assert.equal(reserva.calcularDuracaoTotal(), 50)
  assert.equal(new Servico({ nome: 'Cortesia', descricao: '', categoria: 'OUTRO', preco: 0, duracaoMinutos: 5 }).preco, 0)
  assert.throws(() => new Servico({ nome: 'Inválido', preco: -1, categoria: 'CORTE', duracaoMinutos: 30 }))
})

test('data inexistente e horário inválido são rejeitados', () => {
  for (const data of ['2026-02-30T09:00', '2026-10-23T25:00', 'bad', '2026-10-23T09:00Z']) assert.throws(() => validarDataHora(data))
})

test('nascimento anterior a 2000 é permitido, sem restrição etária inventada', () => {
  assert.equal(validarData('1991-05-14'), '1991-05-14')
})
