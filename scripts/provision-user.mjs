import { mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { readRuntimeConfig } from '../server/config.mjs'
import { createPool } from '../server/postgres.mjs'

// Operator-only command. Creates/rotates the runtime login and saves credentials privately.
const config = readRuntimeConfig({ ...process.env, DATABASE_URL: process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL })
if (config.backend !== 'postgres') throw new Error('Configure a conexão owner em DATABASE_MIGRATION_URL.')
const pool = createPool(config.connectionString, config)
const password = randomBytes(32).toString('hex')
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('SELECT pg_advisory_xact_lock(1300000422)')
  const existing = (await client.query("SELECT 1 FROM pg_roles WHERE rolname='navalha_app'")).rows.length > 0
  if (existing && !process.argv.includes('--rotacionar')) throw new Error('Usuário de execução já existe. Para rotacionar a senha intencionalmente, use --rotacionar e atualize a Vercel depois.')
  await client.query(
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='navalha_app') THEN CREATE ROLE navalha_app; END IF; END $$",
  )
  // The only interpolated value is a locally generated 64-character hex string.
  await client.query(`ALTER ROLE navalha_app WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`)
  await client.query('GRANT USAGE ON SCHEMA navalha TO navalha_app')
  await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA navalha TO navalha_app')
  await client.query('REVOKE INSERT,UPDATE,DELETE ON navalha.configuracao FROM navalha_app')
  await client.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA navalha TO navalha_app')
  await client.query(`DO $$ DECLARE t text; BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='navalha' LOOP
      EXECUTE format('DROP POLICY IF EXISTS backend ON navalha.%I',t);
      EXECUTE format('CREATE POLICY backend ON navalha.%I TO navalha_app USING (true) WITH CHECK (true)',t);
    END LOOP;
  END $$`)
  const runtime = new URL(process.env.DATABASE_URL || config.connectionString)
  const username = decodeURIComponent(runtime.username)
  runtime.username = 'navalha_app' + (username.includes('.') ? '.' + username.split('.').slice(1).join('.') : '')
  runtime.password = password
  mkdirSync('.secrets', { recursive: true })
  const output = existing ? '.secrets/vercel-rotacao-' + Date.now() + '.env' : '.secrets/vercel.env'
  writeFileSync(
    output,
    `DATABASE_URL=${runtime.toString()}\nNAVALHA_ENCRYPTION_KEY=${config.key.toString('base64')}\nAPP_ORIGIN=${config.origins[0]}\n`,
    { mode: 0o600, flag: 'wx' },
  )
  await client.query('COMMIT')
  console.log(
    'Usuário de execução configurado. Variáveis salvas em ' + output + ' sem exibir segredos. Use o Transaction pooler em DATABASE_URL antes deste comando; guarde a conexão owner somente localmente.',
  )
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
