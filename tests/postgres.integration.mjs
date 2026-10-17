import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createApplication } from '../server/app.mjs'
import { createPool, createPostgresRepository } from '../server/postgres.mjs'
import { initializeDatabase } from '../server/migration.mjs'
import { hashToken } from '../server/security.mjs'
import { snapshot, importSnapshot } from '../server/transfer.mjs'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

test('PostgreSQL nativo: API, domínio documental, duas instâncias e dois processos', { timeout: 120000 }, async (t) => {
  const config = {
    connectionString: process.env.NAVALHA_TEST_POSTGRES_URL,
    key: Buffer.from(process.env.NAVALHA_TEST_PG_KEY ?? '', 'base64'),
    allowLocal: true,
  }
  assert.equal(new URL(config.connectionString).hostname, '127.0.0.1')
  const pool = createPool(config.connectionString, config)
  t.after(() => pool.end())
  // Supabase projects may already have this extension installed in another schema.
  await pool.query('CREATE EXTENSION btree_gist WITH SCHEMA public')
  assert.equal((await initializeDatabase(pool, config.key)).criado, true)
  assert.equal((await initializeDatabase(pool, config.key)).criado, false)
  const store = createPostgresRepository(config),
    otherStore = createPostgresRepository(config)
  let now = '2026-10-23T07:45:00'
  const apps = [store, otherStore].map((store) => createApplication({ store, clock: () => now, secureCookies: true }))
  await Promise.all(apps.map((app) => app.ready))
  for (const app of apps) await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    for (const app of apps) {
      await new Promise((resolve) => app.server.close(resolve))
      await app.close()
    }
  })
  await store.sql
    .prepare('INSERT INTO convites(email_indice,segredo_hash,expira) VALUES(?,?,?)')
    .run(store.emailIndex('barbeiro@example.com'), hashToken('codigo-unico-testes'), Date.now() + 600000)
  function client() {
    let cookie, csrf
    return async (path, method = 'GET', body, headers = {}, index = 0) => {
      const response = await fetch(`http://127.0.0.1:${apps[index].server.address().port}/api` + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { cookie } : {}),
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      const result = await response.json()
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]
      if (result.csrfToken) csrf = result.csrfToken
      return { status: response.status, ...result, cookie: response.headers.get('set-cookie') }
    }
  }
  const customer = client(),
    barber = client(),
    outsider = client()
  const register = (request, email, perfil = 'CLIENTE') =>
    request('/auth/cadastro', 'POST', {
      nome: 'Pessoa de teste',
      email,
      perfil,
      telefone: '38999990000',
      senha: 'Teste-seguro-2026!',
      registroProfissional: 'BARB-001',
      codigoAutorizacao: 'codigo-unico-testes',
    })
  const a = await register(customer, 'cliente@example.com')
  const b = await register(barber, 'barbeiro@example.com', 'BARBEIRO')
  assert.equal(a.status, 201)
  assert.equal(b.status, 201)
  assert.ok(b.cookie.includes('HttpOnly') && b.cookie.includes('Secure'))
  assert.equal((await register(outsider, 'duplicado@example.com', 'BARBEIRO')).status, 403)
  assert.equal((await register(outsider, 'cliente@example.com')).status, 409)
  assert.equal((await customer('/auth/sessao', 'GET', undefined, {}, 1)).usuario.id, a.usuario.id)
  const encrypted = (await pool.query('SELECT dados FROM navalha.usuarios')).rows.map((r) => r.dados).join('')
  assert.equal(encrypted.includes('cliente@example.com'), false)
  const window = await barber('/disponibilidades', 'POST', {
    diaSemana: 'SEXTA',
    horaInicio: '08:00',
    horaFim: '18:00',
    intervaloMinutos: 10,
    ativo: true,
  })
  assert.equal(window.status, 201)
  const proposal = (time, ids = [1, 2]) => ({ barbeiroId: b.usuario.id, dataHora: '2026-10-23T' + time, servicoIds: ids })
  const first = await customer('/agendamentos', 'POST', proposal('09:00'), { 'Idempotency-Key': 'postgres-confirmacao-001' })
  assert.equal(first.status, 201)
  assert.deepEqual([first.agendamento.valorTotal, first.agendamento.duracaoTotalMinutos], [65, 50])
  assert.equal(
    (await customer('/agendamentos', 'POST', proposal('09:00'), { 'Idempotency-Key': 'postgres-confirmacao-001' }, 1)).agendamento.id,
    first.agendamento.id,
  )
  assert.equal((await customer('/agendamentos', 'POST', proposal('09:40', [1]))).status, 409)
  assert.equal((await customer('/agendamentos', 'POST', proposal('10:00', [1, 1]))).status, 422)
  const updated = await barber(`/agendamentos/${first.agendamento.id}`, 'PUT', { dataHora: '2026-10-23T10:00', servicoIds: [1] })
  assert.equal(updated.status, 200)
  assert.equal(updated.agendamento.id, first.agendamento.id)
  assert.deepEqual(
    [updated.agendamento.valorTotal, updated.agendamento.duracaoTotalMinutos, updated.agendamento.status],
    [40, 30, 'PENDENTE'],
  )
  await register(outsider, 'outro@example.com')
  assert.equal((await outsider(`/agendamentos/${first.agendamento.id}`)).status, 403)
  assert.equal(
    (await customer(`/agendamentos/${first.agendamento.id}`, 'PUT', { dataHora: '2026-10-23T11:00', servicoIds: [1] })).status,
    403,
  )

  await t.test('dois processos: um intervalo ocupado uma vez; mesma chave reproduz a mesma reserva', async () => {
    async function compete(time, sameKey = false) {
      function start() {
        const child = spawn(process.execPath, ['tests/postgres-worker.mjs'], { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] })
        let output = '',
          stderr = ''
        child.stderr.on('data', (chunk) => {
          stderr += chunk
        })
        const ready = new Promise((resolve) =>
          child.stdout.on('data', (chunk) => {
            output += chunk
            if (output.includes('READY')) resolve()
          }),
        )
        const done = new Promise((resolve, reject) => {
          child.on('error', reject)
          child.on('close', (code) => {
            if (code !== 0) reject(new Error(stderr))
            else resolve(JSON.parse(output.trim().split('\n').at(-1)))
          })
        })
        return { child, ready, done }
      }
      const workers = [start(), start()]
      await Promise.all(workers.map((w) => w.ready))
      workers.forEach((w) =>
        w.child.stdin.end(
          JSON.stringify({ clienteId: a.usuario.id, ...proposal(time, [1]), chave: sameKey ? 'chave-compartilhada-postgres' : undefined }),
        ),
      )
      return Promise.all(workers.map((w) => w.done))
    }
    assert.deepEqual((await compete('12:00')).map((x) => x.status).sort(), [201, 409])
    const repeated = await compete('13:00', true)
    assert.deepEqual(
      repeated.map((x) => x.status),
      [201, 201],
    )
    assert.equal(repeated[0].id, repeated[1].id)
  })

  await t.test('constraint no banco também impede sobreposição sem passar pela API', async () => {
    const row = await store.sql.prepare('SELECT * FROM agendamentos WHERE id=?').get(first.agendamento.id)
    await assert.rejects(
      store.sql
        .prepare(
          'INSERT INTO agendamentos(cliente_id,barbeiro_id,disponibilidade_id,data_hora,status,observacao,data_criacao,data_atualizacao,valor_centavos,duracao,itens) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          row.cliente_id,
          row.barbeiro_id,
          row.disponibilidade_id,
          row.data_hora,
          row.status,
          row.observacao,
          row.data_criacao,
          row.data_atualizacao,
          row.valor_centavos,
          row.duracao,
          row.itens,
        ),
      (e) => e.code === '23P01',
    )
  })

  await t.test('rollback de UC09 mantém snapshot; cancelamento libera horário e mantém motivo', async () => {
    await pool.query(
      "CREATE FUNCTION navalha.falha_teste() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha intencional'; END $$; CREATE TRIGGER falha_teste BEFORE UPDATE ON navalha.agendamentos FOR EACH ROW EXECUTE FUNCTION navalha.falha_teste()",
    )
    assert.equal(
      (await barber(`/agendamentos/${first.agendamento.id}`, 'PUT', { dataHora: '2026-10-23T11:00', servicoIds: [2, 3] })).status,
      500,
    )
    assert.deepEqual((await customer(`/agendamentos/${first.agendamento.id}`)).agendamento, updated.agendamento)
    await pool.query('DROP TRIGGER falha_teste ON navalha.agendamentos; DROP FUNCTION navalha.falha_teste()')
    assert.equal(
      (await customer(`/agendamentos/${first.agendamento.id}/cancelar`, 'POST', { motivo: 'Não poderei comparecer' })).status,
      200,
    )
    assert.equal((await customer(`/agendamentos/${first.agendamento.id}`)).agendamento.observacao, 'Não poderei comparecer')
    assert.equal((await customer('/agendamentos', 'POST', proposal('10:00', [2, 3]))).status, 201)
  })

  await t.test('histórico, finalização e relatório documental', async () => {
    const historical = await customer('/agendamentos', 'POST', proposal('14:00', [1, 2]))
    await barber('/servicos/1', 'PUT', { preco: 99 })
    assert.equal((await customer(`/agendamentos/${historical.agendamento.id}`)).agendamento.valorTotal, 65)
    assert.equal((await barber(`/agendamentos/${historical.agendamento.id}/status`, 'POST', { status: 'CONCLUIDO' })).status, 422)
    now = '2026-10-23T18:00:00'
    assert.equal((await barber(`/agendamentos/${historical.agendamento.id}/status`, 'POST', { status: 'CONCLUIDO' })).status, 200)
    const report = await barber('/relatorios?inicio=2026-10-23&fim=2026-10-23')
    assert.deepEqual([report.quantidade, report.valorTotal], [1, 65])
    assert.equal((await barber(`/agendamentos/${historical.agendamento.id}/status`, 'POST', { status: 'PENDENTE' })).status, 422)
  })

  await t.test('limite de login compartilhado entre instâncias e sessões revogadas', async () => {
    const key = store.emailIndex('limite@example.com') + ':/auth/login'
    for (let i = 0; i < 20; i++) assert.equal(await (i % 2 ? store : otherStore).admitirAutenticacao(key), true)
    assert.equal(await otherStore.admitirAutenticacao(key), false)
    assert.equal((await customer('/auth/sair', 'POST', {})).status, 200)
    assert.equal((await customer('/agendamentos', 'GET', undefined, {}, 1)).status, 401)
  })

  await t.test('credencial de execução opera com RLS e não pode alterar o schema ou a chave', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'navalha-runtime-test-'))
    const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/provision-user.mjs', import.meta.url))], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DATABASE_URL: config.connectionString,
        DATABASE_MIGRATION_URL: config.connectionString,
        NAVALHA_ENCRYPTION_KEY: config.key.toString('base64'),
        NAVALHA_ALLOW_LOCAL_POSTGRES: '1',
        APP_ORIGIN: 'https://teste.example.com',
      },
    })
    let stderr = ''
    child.stderr.on('data', (v) => {
      stderr += v
    })
    const code = await new Promise((resolve, reject) => {
      child.on('error', reject)
      child.on('close', resolve)
    })
    assert.equal(code, 0, stderr)
    const encoded = readFileSync(join(cwd, '.secrets/vercel.env'), 'utf8')
    const url = encoded
      .split('\n')
      .find((x) => x.startsWith('DATABASE_URL='))
      .slice('DATABASE_URL='.length)
    const restricted = createPostgresRepository({ ...config, connectionString: url })
    try {
      await restricted.ready()
      assert.equal((await restricted.getUsuario(a.usuario.id)).email, 'cliente@example.com')
      await restricted.sql
        .prepare('INSERT INTO tentativas(chave,quantidade,expira) VALUES(?,?,?)')
        .run('restricted-test', 1, Date.now() + 60000)
      await assert.rejects(restricted.sql.query('CREATE TABLE navalha.forbidden(id integer)'), (e) => e.code === '42501')
      await assert.rejects(
        restricted.sql.prepare('UPDATE configuracao SET valor=? WHERE chave=?').run('bad', 'key_fingerprint'),
        (e) => e.code === '42501',
      )
      const restrictedApp = createApplication({ store: restricted, clock: () => now })
      await restrictedApp.ready
      // Exercise Vercel's pre-parsed body shape through the actual API handler.
      let status, body
      const response = {
        setHeader() {},
        writeHead(v) {
          status = v
        },
        end(v) {
          body = JSON.parse(v)
        },
      }
      await restrictedApp.handler(
        {
          url: '/api/auth/login',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: { email: 'cliente@example.com', senha: 'Teste-seguro-2026!' },
        },
        response,
      )
      assert.equal(status, 200)
      assert.equal(body.usuario.id, a.usuario.id)
    } finally {
      await restricted.close()
    }
  })
})
