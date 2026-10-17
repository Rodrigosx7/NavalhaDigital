import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteRepository } from '../server/repository.mjs'

test('transação assíncrona impede leitura externa de gravação parcial e desfaz falhas', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'navalha-async-'))
  const store = await createSqliteRepository(join(dir, 'db.sqlite'), join(dir, 'key'))
  t.after(() => store.close())
  let entered, release
  const started = new Promise((resolve) => {
    entered = resolve
  })
  const barrier = new Promise((resolve) => {
    release = resolve
  })
  const failure = store.transaction(async () => {
    await store.sql.prepare('UPDATE servicos SET preco_centavos=? WHERE id=?').run(9900, 1)
    entered()
    await barrier
    throw new Error('rollback deliberado')
  })
  await started
  let completed = false
  const outside = store.servicos().then((rows) => {
    completed = true
    return rows
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(completed, false)
  release()
  await assert.rejects(failure, /rollback deliberado/)
  assert.equal((await outside)[0].preco, 40)
})
