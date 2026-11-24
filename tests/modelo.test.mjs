import test from 'node:test'
import assert from 'node:assert/strict'
import { Agendamento, Barbeiro, Cliente, Disponibilidade, FabricaUsuarios, Servico, Usuario } from '../server/domain.mjs'

const corte = new Servico({ id: 201, nome: 'Corte', descricao: 'Corte tradicional', categoria: 'CORTE', preco: 40, duracaoMinutos: 30 })
const barba = new Servico({ id: 202, nome: 'Barba', descricao: 'Aparar e finalizar barba', categoria: 'BARBA', preco: 25, duracaoMinutos: 20 })
const dadosJanela = { id: 301, barbeiroId: 101, diaSemana: 'SEXTA', horaInicio: '08:00', horaFim: '18:00', intervaloMinutos: 10, ativo: true }
const relogio = () => '2026-10-23T07:45:00'

// Barbeiro de teste: registra as mensagens recebidas, como as linhas de vida da Entrega 2.
function cenario(agenda = []) {
  const mensagens = []
  const d1 = new Disponibilidade(dadosJanela)
  const original = d1.possuiDisponibilidade.bind(d1)
  d1.possuiDisponibilidade = (...args) => { mensagens.push(['d1', 'possuiDisponibilidade', ...args]); return original(...args) }
  const b1 = new Barbeiro({ id: 101, nome: 'Diego Rocha', disponibilidades: [d1] }, {
    consultarAgenda: async () => { mensagens.push(['b1', 'consultarAgenda']); return agenda },
  })
  const a1 = new Agendamento({ id: 401, cliente: { id: 1, nome: 'Ana Souza' }, barbeiro: b1, disponibilidade: d1, dataHora: '2026-10-23T10:00:00', status: 'PENDENTE', servicos: [corte], valorTotal: 40, duracaoTotalMinutos: 30, dataCriacao: '2026-10-22T14:00:00', dataAtualizacao: '2026-10-22T14:00:00', relogio })
  return { a1, b1, d1, mensagens }
}

test('reagendar segue a sequência da Entrega 2: a1 → d1.possuiDisponibilidade e a1 → b1.consultarAgenda', async () => {
  const { a1, mensagens } = cenario()
  await a1.reagendar('2026-10-23T09:00', [corte, barba])
  assert.deepEqual(mensagens, [['d1', 'possuiDisponibilidade', '2026-10-23T09:00:00', 50], ['b1', 'consultarAgenda']])
  assert.equal(a1.id, 401)
  assert.equal(a1.status, 'PENDENTE')
  assert.equal(a1.valorTotal, 65)
  assert.equal(a1.duracaoTotalMinutos, 50)
  assert.equal(a1.dataAtualizacao, '2026-10-23T07:45:00')
})

test('reagendar rejeita conflito sem modificar a reserva e ignora a própria reserva e canceladas', async () => {
  const ocupada = { id: 402, status: 'PENDENTE', dataHora: '2026-10-23T09:30:00', duracaoTotalMinutos: 30 }
  const cancelada = { id: 403, status: 'CANCELADO', dataHora: '2026-10-23T11:00:00', duracaoTotalMinutos: 30 }
  const { a1 } = cenario([ocupada, cancelada, { id: 401, status: 'PENDENTE', dataHora: '2026-10-23T10:00:00', duracaoTotalMinutos: 30 }])
  const antes = JSON.stringify(a1)
  await assert.rejects(a1.reagendar('2026-10-23T09:00', [corte, barba]), (error) => error.status === 409)
  assert.equal(JSON.stringify(a1), antes)
  await a1.reagendar('2026-10-23T11:00', [corte])
  assert.equal(a1.dataHora, '2026-10-23T11:00:00')
})

test('estado só muda pelos métodos de negócio; atributos são privados', () => {
  const { a1 } = cenario()
  assert.deepEqual(Object.keys(a1), [])
  assert.throws(() => { a1.status = 'CONCLUIDO' }, TypeError)
  assert.equal(a1.status, 'PENDENTE')
  assert.throws(() => a1.concluir(), /término previsto/)
  assert.throws(() => a1.cancelar('x'), /Motivo/)
  a1.cancelar('Imprevisto')
  assert.equal(a1.status, 'CANCELADO')
  assert.throws(() => a1.registrarNaoComparecimento(), /estado final/)
})

test('Usuario é abstrata, a fábrica escolhe a subclasse e o JSON não expõe a senha', async () => {
  assert.throws(() => new Usuario({}), /abstrato/)
  const fabrica = new FabricaUsuarios({})
  assert.ok(fabrica.criar({ perfil: 'CLIENTE', nome: 'Ana' }) instanceof Cliente)
  assert.ok(fabrica.criar({ perfil: 'BARBEIRO', nome: 'Diego' }) instanceof Barbeiro)
  assert.throws(() => fabrica.criar({ perfil: 'ADMIN' }), /Perfil inválido/)
  const cliente = fabrica.criar({ perfil: 'CLIENTE', email: 'ana@example.com', senhaHash: 'scrypt$segredo' })
  assert.equal(JSON.stringify(cliente).includes('scrypt'), false)
  assert.equal(await cliente.autenticar('outra@example.com', 'qualquer-senha'), false)
})

test('Servico desativa e preserva dados; Disponibilidade detecta janelas sobrepostas', () => {
  const servico = new Servico(corte.toJSON())
  servico.desativar()
  assert.equal(servico.ativo, false)
  assert.equal(servico.preco, 40)
  const janela = new Disponibilidade(dadosJanela)
  assert.equal(janela.sobrepoe(new Disponibilidade({ ...dadosJanela, id: 302, horaInicio: '17:00', horaFim: '19:00' })), true)
  assert.equal(janela.sobrepoe(new Disponibilidade({ ...dadosJanela, id: 303, diaSemana: 'SABADO' })), false)
})
