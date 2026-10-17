import EmbeddedPostgres from 'embedded-postgres'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'

// This runner creates its own disposable, loopback-only database. It never accepts
// a production URL and never runs against a user's existing database.
const probe = createServer()
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
const port = probe.address().port
await new Promise((resolve) => probe.close(resolve))
const directory = mkdtempSync(join(tmpdir(), 'navalha-pg-test-'))
const password = randomBytes(24).toString('hex')
const logs = []
const database = new EmbeddedPostgres({
  databaseDir: join(directory, 'cluster'),
  user: 'postgres',
  password,
  port,
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: (value) => logs.push(String(value)),
  onError: (value) => logs.push(String(value)),
})
let exitCode = 1
try {
  console.log('Iniciando PostgreSQL nativo temporário em loopback…')
  await database.initialise()
  await database.start()
  const child = spawn(process.execPath, ['--test', 'tests/postgres.integration.mjs'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NAVALHA_TEST_POSTGRES_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`,
      NAVALHA_TEST_PG_KEY: randomBytes(32).toString('base64'),
    },
  })
  exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
} catch (error) {
  console.error('Teste PostgreSQL não pôde completar:', error.code ?? error.message)
  console.error(logs.slice(-6).join('\n'))
} finally {
  await database.stop().catch(() => {})
  mkdirSync('docs/compatibilidade', { recursive: true })
  writeFileSync(
    'docs/compatibilidade/postgres-local.json',
    JSON.stringify(
      {
        data: new Date().toISOString(),
        node: process.version,
        plataforma: process.platform,
        ambiente: 'PostgreSQL nativo temporário em loopback; não é Supabase remoto nem deploy Vercel',
        resultado: exitCode === 0 ? 'passou' : 'falhou',
      },
      null,
      2,
    ),
  )
  process.exitCode = exitCode
}
// Embedded Postgres' Windows exit hook can retain pipe handles after the server
// has stopped. The runner owns this temporary server and has awaited its stop.
process.exit(exitCode)
