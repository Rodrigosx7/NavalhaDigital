import { AsyncLocalStorage } from 'node:async_hooks'
import { cifrar, decifrar, indiceEmail } from './security.mjs'

// Every SQLite operation joins the same queue, including reads outside a transaction.
// Async callbacks must never expose an uncommitted write to another HTTP request.
class SqliteDatabase {
  constructor(raw) {
    this.raw = raw
    this.context = new AsyncLocalStorage()
    this.tail = Promise.resolve()
  }
  exclusive(operation) {
    const next = this.tail.then(operation)
    this.tail = next.catch(() => {})
    return next
  }
  execute(operation) {
    return this.context.getStore() ? Promise.resolve().then(operation) : this.exclusive(operation)
  }
  prepare(sql) {
    const statement = this.raw.db.prepare(sql)
    return Object.fromEntries(['get', 'all', 'run'].map((method) => [method, (...args) => this.execute(() => statement[method](...args))]))
  }
  transaction(operation) {
    if (this.context.getStore()) return operation()
    return this.exclusive(() =>
      this.context.run(true, async () => {
        this.raw.db.exec('BEGIN IMMEDIATE')
        try {
          const result = await operation()
          this.raw.db.exec('COMMIT')
          return result
        } catch (error) {
          this.raw.db.exec('ROLLBACK')
          throw error
        }
      }),
    )
  }
  async close() {
    await this.tail
    this.raw.close()
  }
}

export class Repository {
  constructor(sql, key, { raw, postgres = false } = {}) {
    this.sql = sql
    this.key = key
    this.db = raw?.db
    this.raw = raw
    this.postgres = postgres
  }
  transaction(operation) {
    return this.sql.transaction(operation)
  }
  encode(value) {
    return cifrar(value, this.key)
  }
  decode(value) {
    return decifrar(value, this.key)
  }
  emailIndex(email) {
    return indiceEmail(email, this.key)
  }
  usuario(row) {
    return row ? { ...this.decode(row.dados), id: row.id, perfil: row.perfil, dataCadastro: row.data_cadastro } : null
  }
  async getUsuario(id) {
    return this.usuario(await this.sql.prepare('SELECT * FROM usuarios WHERE id=?').get(id))
  }
  servico(row) {
    return row
      ? {
          id: row.id,
          nome: row.nome,
          descricao: row.descricao,
          categoria: row.categoria,
          preco: row.preco_centavos / 100,
          duracaoMinutos: row.duracao,
          ativo: Boolean(row.ativo),
        }
      : null
  }
  async servicos() {
    return (await this.sql.prepare('SELECT * FROM servicos ORDER BY id').all()).map((row) => this.servico(row))
  }
  janela(row) {
    return row
      ? {
          id: row.id,
          barbeiroId: row.barbeiro_id,
          diaSemana: row.dia,
          horaInicio: row.inicio,
          horaFim: row.fim,
          intervaloMinutos: row.intervalo,
          ativo: Boolean(row.ativo),
        }
      : null
  }
  async janelas(id) {
    return (await this.sql.prepare('SELECT * FROM disponibilidades WHERE barbeiro_id=? ORDER BY dia,inicio').all(id)).map((row) =>
      this.janela(row),
    )
  }
  async mapReservas(rows) {
    if (!rows.length) return []
    const ids = [...new Set(rows.flatMap((row) => [row.cliente_id, row.barbeiro_id]))]
    const users = new Map(
      (await this.sql.prepare(`SELECT * FROM usuarios WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)).map((row) => [
        row.id,
        this.usuario(row),
      ]),
    )
    return rows.map((row) => ({
      id: row.id,
      clienteId: row.cliente_id,
      barbeiroId: row.barbeiro_id,
      disponibilidadeId: row.disponibilidade_id,
      cliente: { id: row.cliente_id, nome: users.get(row.cliente_id).nome },
      barbeiro: { id: row.barbeiro_id, nome: users.get(row.barbeiro_id).nome },
      dataHora: row.data_hora,
      status: row.status,
      observacao: this.decode(row.observacao),
      dataCriacao: row.data_criacao,
      dataAtualizacao: row.data_atualizacao,
      valorTotal: row.valor_centavos / 100,
      duracaoTotalMinutos: row.duracao,
      servicos: JSON.parse(row.itens),
    }))
  }
  async getReserva(id) {
    const row = await this.sql.prepare('SELECT * FROM agendamentos WHERE id=?').get(id)
    return row ? (await this.mapReservas([row]))[0] : null
  }
  async reservas(id) {
    return this.mapReservas(await this.sql.prepare('SELECT * FROM agendamentos WHERE barbeiro_id=? ORDER BY data_hora').all(id))
  }
  async admitirAutenticacao(chave) {
    return this.transaction(async () => {
      const now = Date.now()
      await this.sql.prepare('DELETE FROM tentativas WHERE expira<?').run(now)
      const existing = await this.sql.prepare('SELECT * FROM tentativas WHERE chave=?').get(chave)
      if (existing && existing.quantidade >= 20) return false
      if (existing) await this.sql.prepare('UPDATE tentativas SET quantidade=quantidade+1 WHERE chave=?').run(chave)
      else await this.sql.prepare('INSERT INTO tentativas(chave,quantidade,expira) VALUES(?,?,?)').run(chave, 1, now + 600000)
      return true
    })
  }
  async limparAutenticacao(chave) {
    await this.sql.prepare('DELETE FROM tentativas WHERE chave=?').run(chave)
  }
  async backup(path) {
    if (!this.raw) throw new Error('Backup PostgreSQL exige pg_dump ou backup do Supabase; consulte docs/deploy.md.')
    return this.raw.backup(path)
  }
  async close() {
    return this.sql.close()
  }
}

export function wrapSqliteStore(raw) {
  raw.db.exec('CREATE TABLE IF NOT EXISTS tentativas(chave TEXT PRIMARY KEY, quantidade INTEGER NOT NULL, expira INTEGER NOT NULL)')
  return new Repository(new SqliteDatabase(raw), raw.key, { raw })
}

export async function createSqliteRepository(databasePath, keyPath) {
  const { Store } = await import('./store.mjs')
  return wrapSqliteStore(new Store(databasePath, keyPath))
}
