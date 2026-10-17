import pg from 'pg'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHmac } from 'node:crypto'
import { Repository } from './repository.mjs'

export function keyFingerprint(key) {
  return createHmac('sha256', key).update('navalha:key-check:v1').digest('hex')
}
const tables = /\b(usuarios|sessoes|convites|servicos|disponibilidades|agendamentos|operacoes|tentativas|configuracao)\b/g

// These statements are authored by this application. Parameters always go separately.
export function postgresSql(input, returning = false) {
  let count = 0
  let sql = input.replace(/'(?:''|[^'])*'|\?/g, (match) => (match === '?' ? '$' + ++count : match))
  sql = sql.replace(tables, 'navalha.$1')
  const ignore = /^INSERT OR IGNORE /i.test(sql)
  if (ignore) sql = sql.replace(/^INSERT OR IGNORE /i, 'INSERT ') + ' ON CONFLICT DO NOTHING'
  if (returning && /^INSERT INTO navalha\.(usuarios|servicos|disponibilidades|agendamentos)\b/i.test(sql)) sql += ' RETURNING id'
  return sql
}

export function createPool(connectionString, { max = 3, ca, allowLocal = false } = {}) {
  const parsed = new URL(connectionString)
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('DATABASE_URL deve ser uma conexão PostgreSQL.')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  // pg lets URI query parameters override client options, including `ssl=0`.
  // Use only URI credentials/host/database; TLS and pool options are fixed here.
  parsed.search = ''
  const pool = new pg.Pool({
    connectionString: parsed.toString(),
    max,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
    ssl: local && allowLocal ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    types: {
      getTypeParser(oid, format) {
        if (oid === 1114) return (value) => value.replace(' ', 'T')
        if (oid === 20)
          return (value) => {
            const number = Number(value)
            if (!Number.isSafeInteger(number)) throw new Error('Inteiro fora do intervalo seguro.')
            return number
          }
        return pg.types.getTypeParser(oid, format)
      },
    },
  })
  pool.on('error', (error) => console.error('Conexão PostgreSQL interrompida:', error.code ?? error.name))
  return pool
}

export class PostgresDatabase {
  constructor(pool, { advisoryLock = true } = {}) {
    this.pool = pool
    this.context = new AsyncLocalStorage()
    this.advisoryLock = advisoryLock
  }
  async query(sql, args = []) {
    return (this.context.getStore() ?? this.pool).query(sql, args)
  }
  prepare(input) {
    const read = async (args) => this.query(postgresSql(input), args)
    return {
      get: async (...args) => (await read(args)).rows[0],
      all: async (...args) => (await read(args)).rows,
      run: async (...args) =>
        this.transaction(async () => {
          const result = await this.query(postgresSql(input, true), args)
          return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id }
        }),
    }
  }
  async transaction(operation) {
    if (this.context.getStore()) return operation()
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL statement_timeout='10000'")
      await client.query("SET LOCAL lock_timeout='8000'")
      if (this.advisoryLock) await client.query('SELECT pg_advisory_xact_lock(1300000421)')
      const result = await this.context.run(client, operation)
      await client.query('COMMIT')
      return result
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {}
      throw error
    } finally {
      client.release()
    }
  }
  async close() {
    await this.pool.end()
  }
}

export function createPostgresRepository({ connectionString, key, database, ca, allowLocal = false }) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Chave fixa de 32 bytes obrigatória para PostgreSQL.')
  const sql = database ?? new PostgresDatabase(createPool(connectionString, { ca, allowLocal }))
  const store = new Repository(sql, key, { postgres: true })
  store.ready = async () => {
    const rows = await sql.prepare('SELECT * FROM configuracao').all()
    if (rows.find((row) => row.chave === 'schema_version')?.valor !== '1')
      throw new Error('Execute a migração do banco antes de iniciar a aplicação.')
    if (rows.find((row) => row.chave === 'key_fingerprint')?.valor !== keyFingerprint(key))
      throw new Error('Chave diferente da chave original do banco. Restaure a chave correta.')
  }
  return store
}
