import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApplication } from '../server/app.mjs'
import { decifrar } from '../server/security.mjs'
import { spawn, spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

async function ambiente(context, extra = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'navalha-test-'))
  let momento = '2026-10-23T07:45:00'
  const app = createApplication({ databasePath: join(directory, 'test.sqlite'), keyPath: join(directory, 'test.key'), authorizedBarbers: ['diego@example.com', 'eduardo@example.com'], authorizedInvitations: [{ email: 'diego@example.com', codigo: 'autorizacao-diego-apenas-testes' }, { email: 'eduardo@example.com', codigo: 'autorizacao-eduardo-apenas-testes' }], clock: () => momento, testMode: true, ...extra })
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
  context.after(async () => { await new Promise(resolve => app.server.close(resolve)); app.close() })
  const base = `http://127.0.0.1:${app.server.address().port}/api`
  function sessao() {
    let cookie = '', csrf = ''
    return async (path, method = 'GET', body, extra = {}) => {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) })
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]
      const result = await response.json()
      if (result.csrfToken) csrf = result.csrfToken
      return { status: response.status, ...result }
    }
  }
  const cliente = sessao(), barbeiro = sessao(), outro = sessao()
  const registrar = (request, nome, email, perfil = 'CLIENTE') => request('/auth/cadastro', 'POST', { nome, email, telefone: '38999990000', senha: 'Teste-seguro-2026!', perfil, registroProfissional: 'BARB-001', bio: 'Profissional autorizado', codigoAutorizacao: email === 'diego@example.com' ? 'autorizacao-diego-apenas-testes' : email === 'eduardo@example.com' ? 'autorizacao-eduardo-apenas-testes' : '' })
  const clienteResult = await registrar(cliente, 'Ana Souza', 'ana@example.com')
  const barbeiroResult = await registrar(barbeiro, 'Diego Rocha', 'diego@example.com', 'BARBEIRO')
  assert.equal(clienteResult.status, 201)
  assert.equal(barbeiroResult.status, 201)
  const profissional = barbeiroResult.usuario
  const catalogo = await cliente('/catalogo')
  const [corte, barba] = catalogo.servicos
  const janela = await barbeiro('/disponibilidades', 'POST', { diaSemana: 'SEXTA', horaInicio: '08:00', horaFim: '18:00', intervaloMinutos: 10, ativo: true })
  assert.equal(janela.status, 201)
  const criar = (dataHora = '2026-10-23T10:00', ids = [corte.id]) => cliente('/agendamentos', 'POST', { barbeiroId: profissional.id, servicoIds: ids, dataHora })
  return { app, directory, sessao, registrar, cliente, barbeiro, outro, profissional, corte, barba, janela: janela.disponibilidade, criar, agora: value => { momento = value } }
}

test('cadastro único, autorização profissional e dados pessoais protegidos', async context => {
  const env = await ambiente(context)
  assert.equal((await env.registrar(env.outro, 'Duplicado', 'ANA@example.com')).status, 409)
  assert.equal((await env.registrar(env.outro, 'Intruso', 'intruso@example.com', 'BARBEIRO')).status, 403)
  const raw = readFileSync(join(env.directory, 'test.sqlite')).toString('utf8')
  assert.equal(raw.includes('Ana Souza'), false)
  assert.equal(raw.includes('ana@example.com'), false)
  assert.equal(raw.includes('Teste-seguro-2026!'), false)
  assert.equal((await env.sessao()('/agendamentos')).status, 401)
  assert.equal((await env.cliente('/clientes')).status, 403)
})

test('múltiplos serviços sem descontos e valores históricos imutáveis', async context => {
  const env = await ambiente(context)
  const result = await env.criar('2026-10-23T10:00', [env.corte.id, env.barba.id])
  assert.equal(result.status, 201)
  assert.equal(result.agendamento.status, 'PENDENTE')
  assert.equal(result.agendamento.valorTotal, 65)
  assert.equal(result.agendamento.duracaoTotalMinutos, 50)
  assert.equal((await env.criar('2026-10-23T12:00', [env.corte.id, env.corte.id])).status, 422)
  assert.equal((await env.cliente('/agendamentos', 'POST', { barbeiroId: env.profissional.id, servicoIds: [env.corte.id], dataHora: '2026-10-23T12:00', cupom: 'VOLTA10' })).status, 422)
  await env.barbeiro(`/servicos/${env.corte.id}`, 'PUT', { ...env.corte, preco: 100, duracaoMinutos: 60 })
  const saved = await env.cliente(`/agendamentos/${result.agendamento.id}`)
  assert.equal(saved.agendamento.valorTotal, 65)
  assert.equal(saved.agendamento.duracaoTotalMinutos, 50)
})

test('UC09 mantém ID e PENDENTE, recalcula e conserva original em rejeição', async context => {
  const env = await ambiente(context)
  const original = (await env.criar()).agendamento
  const changed = await env.barbeiro(`/agendamentos/${original.id}`, 'PUT', { dataHora: '2026-10-23T09:00', servicoIds: [env.corte.id, env.barba.id] })
  assert.equal(changed.status, 200)
  assert.equal(changed.agendamento.id, original.id)
  assert.equal(changed.agendamento.valorTotal, 65)
  assert.equal(changed.agendamento.duracaoTotalMinutos, 50)
  assert.equal(changed.agendamento.status, 'PENDENTE')
  assert.equal(changed.agendamento.dataAtualizacao, '2026-10-23T07:45:00')
  assert.equal((await env.criar('2026-10-23T09:40')).status, 409)
  assert.equal((await env.criar('2026-10-23T09:50')).status, 201)
  const rejected = await env.barbeiro(`/agendamentos/${original.id}`, 'PUT', { dataHora: '2026-10-23T09:30', servicoIds: [env.corte.id] })
  assert.equal(rejected.status, 409)
  assert.deepEqual((await env.cliente(`/agendamentos/${original.id}`)).agendamento, changed.agendamento)
  assert.equal((await env.cliente(`/agendamentos/${original.id}`, 'PUT', { dataHora: '2026-10-23T11:00', servicoIds: [env.corte.id] })).status, 403)
})

test('cancelamento sem antecedência adicional, com motivo e sem reabrir estado final', async context => {
  const env = await ambiente(context)
  const original = (await env.criar('2026-10-23T08:00')).agendamento
  assert.equal((await env.cliente(`/agendamentos/${original.id}/cancelar`, 'POST', { motivo: 'Imprevisto' })).status, 200)
  const cancelled = (await env.cliente(`/agendamentos/${original.id}`)).agendamento
  assert.equal(cancelled.status, 'CANCELADO')
  assert.equal(cancelled.observacao, 'Imprevisto')
  assert.equal((await env.barbeiro(`/agendamentos/${original.id}/status`, 'POST', { status: 'CONCLUIDO' })).status, 422)
  const next = (await env.criar('2026-10-23T08:00')).agendamento
  env.agora('2026-10-23T08:00:00')
  assert.equal((await env.cliente(`/agendamentos/${next.id}/cancelar`, 'POST', { motivo: 'Tarde' })).status, 422)
})

test('conclusão e falta apenas após o término pelo profissional; relatório só concluídos', async context => {
  const env = await ambiente(context)
  const first = (await env.criar('2026-10-23T09:00')).agendamento
  const second = (await env.criar('2026-10-23T10:00')).agendamento
  assert.equal((await env.barbeiro(`/agendamentos/${first.id}/status`, 'POST', { status: 'CONCLUIDO' })).status, 422)
  env.agora('2026-10-23T11:00:00')
  assert.equal((await env.cliente(`/agendamentos/${first.id}/status`, 'POST', { status: 'CONCLUIDO' })).status, 403)
  assert.equal((await env.barbeiro(`/agendamentos/${first.id}/status`, 'POST', { status: 'CONCLUIDO' })).status, 200)
  assert.equal((await env.barbeiro(`/agendamentos/${second.id}/status`, 'POST', { status: 'NAO_COMPARECEU' })).status, 200)
  assert.equal((await env.barbeiro(`/agendamentos/${first.id}/status`, 'POST', { status: 'PENDENTE' })).status, 422)
  const report = await env.barbeiro('/relatorios?inicio=2026-10-23&fim=2026-10-23')
  assert.equal(report.agendamentos.length, 1)
  assert.equal(report.valorTotal, 40)
  assert.equal((await env.barbeiro('/relatorios?inicio=2026-10-24&fim=2026-10-23')).status, 422)
})

test('janelas e serviços usados são desativados sem apagar histórico', async context => {
  const env = await ambiente(context)
  const reserva = (await env.criar()).agendamento
  const rejection = await env.barbeiro(`/disponibilidades/${env.janela.id}`, 'PUT', { ...env.janela, ativo: false })
  assert.equal(rejection.status, 409)
  assert.ok(rejection.erro.includes('#' + reserva.id))
  assert.equal((await env.barbeiro('/disponibilidades', 'POST', { diaSemana: 'SEXTA', horaInicio: '09:00', horaFim: '11:00', intervaloMinutos: 10, ativo: true })).status, 409)
  assert.equal((await env.barbeiro(`/servicos/${env.corte.id}`, 'PUT', { ...env.corte, ativo: false })).status, 200)
  assert.equal((await env.criar('2026-10-23T13:00')).status, 422)
  assert.equal((await env.cliente('/agendamentos')).agendamentos.length, 1)
})

test('confirmação exige nova revisão quando preço ou duração mudam', async context => {
  const env = await ambiente(context)
  await env.barbeiro(`/servicos/${env.corte.id}`, 'PUT', { ...env.corte, preco: 75 })
  const response = await env.cliente('/agendamentos', 'POST', { barbeiroId: env.profissional.id, servicoIds: [env.corte.id], dataHora: '2026-10-23T10:00', revisao: { valorTotal: 40, duracaoTotalMinutos: 30 } })
  assert.equal(response.status, 409)
  assert.equal((await env.cliente('/agendamentos')).agendamentos.length, 0)
})

test('acesso cruzado por cliente e barbeiro é negado em leitura e escrita', async context => {
  const env = await ambiente(context)
  const original = (await env.criar()).agendamento
  await env.registrar(env.outro, 'Bruno Lima', 'bruno@example.com')
  assert.equal((await env.outro(`/agendamentos/${original.id}`)).status, 403)
  assert.equal((await env.outro(`/agendamentos/${original.id}/cancelar`, 'POST', { motivo: 'Outro cliente' })).status, 403)
  const outroProfissional = env.sessao()
  await env.registrar(outroProfissional, 'Eduardo Silva', 'eduardo@example.com', 'BARBEIRO')
  assert.equal((await outroProfissional(`/agendamentos/${original.id}`, 'PUT', { dataHora: '2026-10-23T11:00', servicoIds: [env.corte.id] })).status, 403)
  assert.equal((await outroProfissional(`/disponibilidades/${env.janela.id}`, 'PUT', { ...env.janela, ativo: false })).status, 403)
  assert.deepEqual((await outroProfissional('/agendamentos')).agendamentos, [])
})

test('falha real de escrita desfaz a alteração e a criação integralmente', async context => {
  const env = await ambiente(context)
  const original = (await env.criar()).agendamento
  env.app.store.db.exec("CREATE TRIGGER falhar_edicao BEFORE UPDATE ON agendamentos BEGIN SELECT RAISE(FAIL,'falha simulada'); END")
  assert.equal((await env.barbeiro(`/agendamentos/${original.id}`, 'PUT', { dataHora: '2026-10-23T09:00', servicoIds: [env.corte.id, env.barba.id] })).status, 500)
  assert.deepEqual((await env.cliente(`/agendamentos/${original.id}`)).agendamento, original)
  env.app.store.db.exec("CREATE TRIGGER falhar_criacao AFTER INSERT ON agendamentos BEGIN SELECT RAISE(FAIL,'falha simulada'); END")
  assert.equal((await env.criar('2026-10-23T12:00')).status, 500)
  assert.equal((await env.cliente('/agendamentos')).agendamentos.length, 1)
})

test('idempotência, logout, origem externa e CSRF', async context => {
  const env = await ambiente(context)
  const payload = { barbeiroId: env.profissional.id, servicoIds: [env.corte.id], dataHora: '2026-10-23T10:00' }
  const headers = { 'Idempotency-Key': 'confirmacao-teste-unica-2026' }
  const first = await env.cliente('/agendamentos', 'POST', payload, headers)
  const second = await env.cliente('/agendamentos', 'POST', payload, headers)
  assert.equal(first.agendamento.id, second.agendamento.id)
  assert.equal((await env.cliente('/agendamentos', 'POST', payload, { origin: 'https://intruso.invalid' })).status, 403)
  assert.equal((await env.cliente(`/agendamentos/${first.agendamento.id}/cancelar`, 'POST', { motivo: 'Teste' }, { 'X-CSRF-Token': 'invalido' })).status, 403)
  assert.equal((await env.cliente('/auth/sair', 'POST', {})).status, 200)
  assert.equal((await env.cliente('/agendamentos')).status, 401)
  assert.equal((await env.cliente('/auth/login', 'POST', { email: 'ana@example.com', senha: 'Teste-seguro-2026!' })).status, 200)
})

test('backup cifrado pode ser autenticado e recuperado', async context => {
  const env = await ambiente(context)
  await env.criar()
  const path = join(env.directory, 'backup.enc')
  await env.app.store.backup(path)
  const encoded = readFileSync(path, 'utf8')
  assert.equal(encoded.includes('Ana Souza'), false)
  const backup = decifrar(encoded, env.app.store.key)
  assert.equal(Buffer.from(backup.database, 'base64').subarray(0, 15).toString(), 'SQLite format 3')
  assert.throws(() => decifrar(encoded.slice(0, -6) + 'aaaaaa', env.app.store.key))
})

test('dois processos concorrentes reservando o mesmo intervalo aceitam somente um', async context => {
  const env = await ambiente(context)
  const usuario = (await env.cliente('/auth/sessao')).usuario
  const start = () => {
    const child = spawn(process.execPath, ['tests/concurrency-worker.mjs', join(env.directory, 'test.sqlite'), join(env.directory, 'test.key'), String(usuario.id), String(env.profissional.id), String(env.corte.id)], { stdio: ['pipe', 'pipe', 'pipe'] })
    let text = ''
    const ready = new Promise(resolve => child.stdout.on('data', value => { text += value; if (text.includes('READY')) resolve() }))
    const result = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => { if (code !== 0) return reject(new Error('Worker falhou: ' + text)); resolve(JSON.parse(text.trim().split('\n').at(-1)).status) }) })
    return { child, ready, result }
  }
  const workers = [start(), start()]
  await Promise.all(workers.map(worker => worker.ready))
  workers.forEach(worker => worker.child.stdin.end('go'))
  assert.deepEqual((await Promise.all(workers.map(worker => worker.result))).sort(), [201, 409])
  assert.equal((await env.cliente('/agendamentos')).agendamentos.length, 1)
})

test('snapshot da Entrega 2 mantém as três reservas e seus serviços compartilhados', async context => {
  const env = await ambiente(context)
  const corte = env.corte, barba = env.barba
  const hidratacao = (await env.cliente('/catalogo')).servicos[2]
  const segundo = env.outro
  const bruno = await env.registrar(segundo, 'Bruno Lima', 'bruno@example.com')
  const terceira = env.sessao(), terceiroBarbeiro = env.sessao()
  const carla = await env.registrar(terceira, 'Carla Alves', 'carla@example.com')
  const eduardo = env.sessao()
  const eduardoUser = await env.registrar(eduardo, 'Eduardo Silva', 'eduardo@example.com', 'BARBEIRO')
  for (const profissional of [eduardo]) await profissional('/disponibilidades', 'POST', { diaSemana: 'SEXTA', horaInicio: '08:00', horaFim: '18:00', intervaloMinutos: 10, ativo: true })
  const original = (await env.criar()).agendamento
  const a1 = await env.barbeiro(`/agendamentos/${original.id}`, 'PUT', { dataHora: '2026-10-23T09:00', servicoIds: [corte.id, barba.id] })
  const a2 = await segundo('/agendamentos', 'POST', { barbeiroId: eduardoUser.usuario.id, servicoIds: [corte.id], dataHora: '2026-10-23T10:00' })
  const thirdUser = env.app.store.db.prepare("INSERT INTO usuarios(perfil,email_indice,dados,senha_hash,data_cadastro) VALUES('BARBEIRO',?,?,?,?)").run(env.app.store.emailIndex('felipe@example.com'), env.app.store.encode({ nome: 'Felipe Costa', email: 'felipe@example.com', telefone: '38999990000', registroProfissional: 'BARB-003', bio: '' }), 'fixture-sem-senha', '2026-10-20T08:00:00')
  const felipe = await env.app.store.getUsuario(Number(thirdUser.lastInsertRowid))
  await env.app.agenda.salvarJanela(felipe, { diaSemana: 'SEXTA', horaInicio: '08:00', horaFim: '18:00', intervaloMinutos: 10, ativo: true })
  const a3 = await env.app.agenda.criar(await env.app.store.getUsuario(carla.usuario.id), { barbeiroId: felipe.id, servicoIds: [barba.id, hidratacao.id], dataHora: '2026-10-23T11:00' })
  assert.deepEqual([a1.agendamento.valorTotal, a1.agendamento.duracaoTotalMinutos], [65, 50])
  assert.deepEqual([a2.agendamento.valorTotal, a2.agendamento.duracaoTotalMinutos], [40, 30])
  assert.deepEqual([a3.valorTotal, a3.duracaoTotalMinutos], [45, 35])
  assert.equal(a1.agendamento.servicos[0].id, a2.agendamento.servicos[0].id)
  assert.equal(a1.agendamento.servicos[1].id, a3.servicos[0].id)
  assert.equal(bruno.usuario.id, a2.agendamento.clienteId)
  assert.equal((await terceiroBarbeiro('/auth/sessao')).usuario, null)
})

test('consulta de horários lê a ocupação uma única vez, independentemente da grade', async context => {
  const env = await ambiente(context)
  let consultas = 0
  const original = env.app.store.reservas.bind(env.app.store)
  env.app.store.reservas = (...args) => { consultas++; return original(...args) }
  const result = await env.cliente(`/horarios?barbeiroId=${env.profissional.id}&servicoIds=${env.corte.id}&data=2026-10-23`)
  assert.equal(result.status, 200)
  assert.ok(result.horarios.length > 0)
  assert.equal(consultas, 1)
})

test('autorização profissional exige segredo de uso único, não só conhecimento do e-mail', async context => {
  const env = await ambiente(context)
  const payload = { nome: 'Eduardo Silva', email: 'eduardo@example.com', telefone: '38999990000', senha: 'Teste-seguro-2026!', perfil: 'BARBEIRO', registroProfissional: 'BARB-002' }
  assert.equal((await env.outro('/auth/cadastro', 'POST', payload)).status, 403)
  assert.equal((await env.outro('/auth/cadastro', 'POST', { ...payload, codigoAutorizacao: 'codigo-incorreto' })).status, 403)
  assert.equal((await env.registrar(env.outro, 'Eduardo Silva', payload.email, 'BARBEIRO')).status, 201)
  assert.equal((await env.registrar(env.sessao(), 'Eduardo Silva', payload.email, 'BARBEIRO')).status, 403)
})

test('tentativas de outra conta não bloqueiam todos os clientes do proxy local', async context => {
  const env = await ambiente(context, { testMode: false })
  for (let attempt = 0; attempt < 22; attempt++) await env.outro('/auth/login', 'POST', { email: 'spam@example.com', senha: 'Senha-incorreta-2026!' })
  assert.equal((await env.cliente('/auth/login', 'POST', { email: 'ana@example.com', senha: 'Teste-seguro-2026!' })).status, 200)
})

test('repetir edição com a mesma chave recupera confirmação mesmo após o início', async context => {
  const env = await ambiente(context)
  const original = (await env.criar()).agendamento
  const body = { dataHora: '2026-10-23T09:00', servicoIds: [env.corte.id, env.barba.id] }, headers = { 'Idempotency-Key': 'reagendamento-resposta-perdida' }
  const first = await env.barbeiro(`/agendamentos/${original.id}`, 'PUT', body, headers)
  assert.equal(first.status, 200)
  env.agora('2026-10-23T10:00:00')
  const second = await env.barbeiro(`/agendamentos/${original.id}`, 'PUT', body, headers)
  assert.equal(second.status, 200)
  assert.deepEqual(second.agendamento, first.agendamento)
})

test('restauração não reativa sessões revogadas depois do backup', async context => {
  const env = await ambiente(context)
  const backup = join(env.directory, 'restore.enc'), target = join(env.directory, 'restore.sqlite')
  await env.app.store.backup(backup)
  await env.cliente('/auth/sair', 'POST', {})
  const result = spawnSync(process.execPath, ['scripts/backup.mjs', 'restaurar', backup, target], { env: { ...process.env, NAVALHA_KEY_FILE: join(env.directory, 'test.key') }, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const restored = new DatabaseSync(target)
  try { assert.equal(restored.prepare('SELECT count(*) AS total FROM sessoes').get().total, 0) } finally { restored.close() }
})
