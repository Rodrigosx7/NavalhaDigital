import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { PostgresDatabase, createPostgresRepository, keyFingerprint } from '../server/postgres.mjs'
import { createSqliteRepository } from '../server/repository.mjs'
import { snapshot, importSnapshot } from '../server/transfer.mjs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function pgFixture(key = randomBytes(32)) {
  const pg = new PGlite({ extensions: { btree_gist } })
  await pg.exec(readFileSync(new URL('../supabase/migrations/0001_navalha.sql', import.meta.url), 'utf8'))
  await pg.query("INSERT INTO navalha.configuracao(chave,valor) VALUES('key_fingerprint',$1)", [keyFingerprint(key)])
  const execute = async (sql, params) => {
    const result = await pg.query(sql, params)
    return {
      rows: result.rows.map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 19) : v])),
      ),
      rowCount: result.affectedRows,
    }
  }
  // PGlite is PostgreSQL in WASM; it runs one connection. Network/concurrent-instance tests
  // additionally require TEST_DATABASE_URL and are never inferred from this fixture.
  const pool = {
    query: execute,
    async connect() {
      return { query: execute, release() {} }
    },
    async end() {
      await pg.close()
    },
  }
  const database = new PostgresDatabase(pool, { advisoryLock: false })
  const store = createPostgresRepository({ database, key })
  await store.ready()
  return { store, pg, pool }
}

test('schema PostgreSQL e chave fixa: semente, rollback e identificação de chave incorreta', async (t) => {
  const { store, pool } = await pgFixture()
  t.after(() => store.close())
  assert.deepEqual(
    (await store.servicos()).map((x) => x.preco),
    [40, 25, 20],
  )
  await assert.rejects(
    store.transaction(async () => {
      await store.sql.prepare('UPDATE servicos SET preco_centavos=? WHERE id=?').run(9000, 1)
      throw new Error('falha')
    }),
    /falha/,
  )
  assert.equal((await store.servicos())[0].preco, 40)
  const wrong = createPostgresRepository({ database: new PostgresDatabase(pool, { advisoryLock: false }), key: randomBytes(32) })
  await assert.rejects(wrong.ready(), /chave/i)
})

test('transferência SQLite→Postgres preserva IDs e cifras; recusa chave errada, destino ocupado e escrita parcial', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'navalha-transfer-'))
  const source = await createSqliteRepository(join(directory, 'source.sqlite'), join(directory, 'key'))
  const { store, pg } = await pgFixture(source.key)
  t.after(async () => {
    await source.close()
    await store.close()
  })
  const user = {
    nome: 'Cliente original',
    email: 'original@example.com',
    telefone: '38999990000',
    endereco: '',
    bio: '',
    registroProfissional: '',
  }
  await source.sql
    .prepare('INSERT INTO usuarios(id,perfil,email_indice,dados,senha_hash,data_cadastro) VALUES(?,?,?,?,?,?)')
    .run(41, 'CLIENTE', source.emailIndex(user.email), source.encode(user), 'scrypt-preservado', '2026-10-16T09:00:00')
  const data = await snapshot(source)
  await assert.rejects(importSnapshot(store, { ...data, chave: 'errada' }), /chave/)
  const invalid = structuredClone(data)
  invalid.tabelas.servicos = invalid.tabelas.servicos.slice(0, 1)
  invalid.tabelas.disponibilidades.push({ id: 1, barbeiro_id: 9999, dia: 'SEXTA', inicio: '08:00', fim: '18:00', intervalo: 10, ativo: 1 })
  await assert.rejects(importSnapshot(store, invalid), (e) => e.code === '23503')
  assert.equal((await store.sql.prepare('SELECT count(*) AS total FROM usuarios').get()).total, 0)
  assert.deepEqual(
    (await store.servicos()).map((x) => x.preco),
    [40, 25, 20],
  )
  const postFailure = await store.sql.prepare('INSERT INTO servicos(nome,descricao,categoria,preco_centavos,duracao,ativo) VALUES(?,?,?,?,?,?)').run('Teste','', 'OUTRO',100,10,1)
  assert.equal(postFailure.lastInsertRowid,4)
  await store.sql.prepare('DELETE FROM servicos WHERE id=?').run(postFailure.lastInsertRowid)
  assert.deepEqual(await importSnapshot(store, data), { usuarios: 1, servicos: 3, disponibilidades: 0, agendamentos: 0 })
  assert.equal((await store.getUsuario(41)).nome, user.nome)
  assert.equal((await store.sql.prepare('SELECT * FROM usuarios WHERE id=?').get(41)).dados, data.tabelas.usuarios[0].dados)
  const next = await store.sql
    .prepare('INSERT INTO usuarios(perfil,email_indice,dados,senha_hash,data_cadastro) VALUES(?,?,?,?,?)')
    .run(
      'CLIENTE',
      store.emailIndex('novo@example.com'),
      store.encode({ ...user, email: 'novo@example.com' }),
      'hash',
      '2026-10-16T09:00:00',
    )
  assert.equal(next.lastInsertRowid, 42)
  await assert.rejects(importSnapshot(store, data), /Destino/)
  assert.equal((await source.getUsuario(41)).nome, user.nome)
  assert.equal((await store.sql.prepare('SELECT count(*) AS total FROM sessoes').get()).total, 0)
})

test('schema privado não concede acesso público e habilita RLS em todas as tabelas', async (t) => {
  const { store, pg } = await pgFixture()
  t.after(() => store.close())
  const rows = (
    await pg.query(
      "SELECT relname,relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='navalha' AND c.relkind='r'",
    )
  ).rows
  assert.ok(rows.length >= 9)
  assert.ok(rows.every((x) => x.relrowsecurity))
  await pg.exec('CREATE ROLE teste_publico; SET ROLE teste_publico')
  await assert.rejects(pg.query('SELECT * FROM navalha.usuarios'), /permission denied/)
  await pg.exec('RESET ROLE')
})
