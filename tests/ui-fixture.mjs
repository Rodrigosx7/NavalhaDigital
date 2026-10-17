// Ensaio manual isolado: nenhuma variável de produção ou banco existente é lido.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { createServer } from 'vite'
import { createApplication } from '../server/app.mjs'

const directory = mkdtempSync(join(tmpdir(), 'navalha-ui-'))
const origin = 'http://127.0.0.2:5187'
const app = createApplication({ databasePath: join(directory, 'test.sqlite'), keyPath: join(directory, 'test.key'), clock: () => '2026-10-23T07:45:00', origins: [origin], testMode: true, authorizedInvitations: [{ email: 'barbeiro-ui@example.com', codigo: 'convite-apenas-ensaio-ui' }] })
await app.ready
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
const target = `http://127.0.0.1:${app.server.address().port}`
function session() {
  let cookie, csrf
  return async (path, method = 'GET', body) => {
    const res = await fetch(target + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const data = await res.json()
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0]
    if (data.csrfToken) csrf = data.csrfToken
    if (!res.ok) throw new Error(data.erro)
    return data
  }
}
const barber = session(), customer = session()
const common = { telefone: '38999990000', senha: 'Ensaio-local-2026!' }
const b = await barber('/auth/cadastro', 'POST', { ...common, nome: 'Barbeiro de ensaio', email: 'barbeiro-ui@example.com', perfil: 'BARBEIRO', registroProfissional: 'Ensaio local', codigoAutorizacao: 'convite-apenas-ensaio-ui' })
await customer('/auth/cadastro', 'POST', { ...common, nome: 'Cliente de ensaio', email: 'cliente-ui@example.com' })
await barber('/disponibilidades', 'POST', { diaSemana: 'SEXTA', horaInicio: '08:00', horaFim: '18:00', intervaloMinutos: 10, ativo: true })
const originals = []
for (const hour of ['09', '10', '11', '12', '13']) originals.push((await customer('/agendamentos', 'POST', { barbeiroId: b.usuario.id, servicoIds: [1], dataHora: `2026-10-23T${hour}:00` })).agendamento)
const vite = await createServer({ server: { host: '127.0.0.2', port: 5187, strictPort: true, proxy: { '/api': target } } })
await vite.listen()
console.log(JSON.stringify({ pronto: true, origin, reservas: originals.map(x => ({ id: x.id, hora: x.dataHora.slice(11,16) })) }))
const input = createInterface({ input: process.stdin })
for await (const line of input) {
  try {
    const [action, value] = line.trim().split(' ')
    if (action === 'cancelar') await customer(`/agendamentos/${Number(value)}/cancelar`, 'POST', { motivo: 'Cancelado em outra sessão de ensaio' })
    if (action === 'preco') await barber('/servicos/1', 'PUT', { preco: Number(value) })
    if (action === 'falhar') app.store.db.exec("CREATE TRIGGER falhar_ui BEFORE UPDATE ON agendamentos BEGIN SELECT RAISE(FAIL,'ensaio de rollback'); END")
    if (action === 'recuperar') app.store.db.exec('DROP TRIGGER falhar_ui')
    if (action === 'conferir') {
      const atual = await app.store.getReserva(Number(value))
      console.log(JSON.stringify({ atual, originalPreservado: JSON.stringify(atual) === JSON.stringify(originals.find(x => x.id === atual.id)) }))
    }
    if (action === 'sair') break
    console.log('Comando concluído: ' + action)
  } catch (error) { console.log('Erro no ensaio: ' + error.message) }
}
await vite.close()
await new Promise(resolve => app.server.close(resolve))
await app.close()
