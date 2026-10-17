import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createApplication } from '../server/app.mjs'

const directory = mkdtempSync(join(tmpdir(), 'navalha-load-'))
const app = createApplication({ databasePath: join(directory, 'load.sqlite'), keyPath: join(directory, 'load.key'), authorizedInvitations: [{ email: 'profissional@example.com', codigo: 'convite-apenas-cenario-carga' }], clock: () => '2026-10-23T07:45:00', testMode: true })
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${app.server.address().port}/api`
async function cadastrar(email, perfil = 'CLIENTE') {
  const response = await fetch(base + '/auth/cadastro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'Usuário de carga', email, perfil, senha: 'Carga-local-segura-2026!', telefone: '38999990000', registroProfissional: 'LOAD-01', codigoAutorizacao: perfil === 'BARBEIRO' ? 'convite-apenas-cenario-carga' : '' }) })
  const data = await response.json()
  if (response.status !== 201) throw new Error('Setup de carga: ' + JSON.stringify(data))
  return { data, headers: { 'Content-Type': 'application/json', cookie: response.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': data.csrfToken } }
}
async function medir(url, options) {
  const start = performance.now()
  try { const response = await fetch(base + url, options); await response.json(); return { ms: performance.now() - start, status: response.status } }
  catch (error) { return { ms: performance.now() - start, status: 0, error: error.cause?.code || error.name } }
}
try {
  const profissional = await cadastrar('profissional@example.com', 'BARBEIRO')
  const created = await fetch(base + '/servicos', { method: 'POST', headers: profissional.headers, body: JSON.stringify({ nome: 'Serviço de carga', descricao: '', categoria: 'OUTRO', preco: 10, duracaoMinutos: 5, ativo: true }) })
  const { servico } = await created.json()
  const windowResult = await fetch(base + '/disponibilidades', { method: 'POST', headers: profissional.headers, body: JSON.stringify({ diaSemana: 'SEXTA', horaInicio: '08:00', horaFim: '18:00', intervaloMinutos: 10, ativo: true }) })
  if (windowResult.status !== 201 || !servico) throw new Error('Setup de catálogo/janela falhou')
  const usuarios = []
  for (let index = 0; index < 50; index++) usuarios.push(await cadastrar(`carga${index}@example.com`))
  console.log('Preparação concluída: 50 usuários autenticados. Medindo consultas e confirmações…')
  const consultas = []
  for (let round = 0; round < 3; round++) consultas.push(...await Promise.all(usuarios.map(user => medir(`/horarios?barbeiroId=${profissional.data.usuario.id}&servicoIds=${servico.id}&data=2026-10-23`, { headers: user.headers }))))
  const confirmacoes = await Promise.all(usuarios.map((user, index) => {
    const minuto = 8 * 60 + index * 10
    const dataHora = `2026-10-23T${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`
    return medir('/agendamentos', { method: 'POST', headers: user.headers, body: JSON.stringify({ barbeiroId: profissional.data.usuario.id, servicoIds: [servico.id], dataHora, revisao: { valorTotal: 10, duracaoTotalMinutos: 5 } }) })
  }))
  function resumo(results) { const sorted = results.map(item => item.ms).sort((first, second) => first - second); return { requisicoes: results.length, erros: results.filter(item => item.status === 0 || item.status >= 400).length, p95Ms: Math.round(sorted[Math.ceil(sorted.length * .95) - 1]), maxMs: Math.round(sorted.at(-1)), falhas: results.filter(item => item.error).map(item => item.error) } }
  const report = { data: new Date().toISOString(), ambiente: { node: process.version, plataforma: process.platform, rede: 'loopback HTTP', usuariosAutenticadosDistintos: 50, concorrencia: 50, banco: 'SQLite temporário', servicosPorReserva: 1, gradeMinutos: 10, janela: '08:00–18:00', nota: 'Cadastro e autenticação são preparação; mede consulta e confirmação autenticadas. Rate limit de login desabilitado somente no fixture.' }, consultas: resumo(consultas), confirmacoes: resumo(confirmacoes) }
  report.metaAtendidaNesteCenario = report.consultas.erros === 0 && report.confirmacoes.erros === 0 && report.consultas.p95Ms <= 2000 && report.confirmacoes.p95Ms <= 2000
  mkdirSync('docs/compatibilidade', { recursive: true })
  writeFileSync('docs/compatibilidade/carga-local.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.metaAtendidaNesteCenario) process.exitCode = 1
} finally { await new Promise(resolve => app.server.close(resolve)); app.close() }
