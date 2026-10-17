import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { readRuntimeConfig } from '../server/config.mjs'
import { createPostgresRepository, keyFingerprint } from '../server/postgres.mjs'
import { carregarChave } from '../server/security.mjs'
import { transferable, importSnapshot } from '../server/transfer.mjs'

const source = resolve(process.argv[2] ?? process.env.NAVALHA_DATABASE ?? '.data/navalha.sqlite')
if (!existsSync(source)) throw new Error('Banco SQLite de origem não encontrado. Nenhum arquivo foi criado.')
const config = readRuntimeConfig({ ...process.env, DATABASE_URL: process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL })
if (config.backend !== 'postgres') throw new Error('Configure PostgreSQL antes de importar.')
const originalKey = carregarChave(resolve(process.env.NAVALHA_KEY_FILE ?? '.secrets/navalha.key'), true)
if (!originalKey.equals(config.key)) throw new Error('A chave PostgreSQL deve ser a mesma chave do SQLite original.')
const sourceDb = new DatabaseSync(source, { readOnly: true })
const store = createPostgresRepository(config)
try {
  await store.ready()
  const tabelas = {}
  sourceDb.exec('BEGIN')
  try {
    for (const [table, columns] of Object.entries(transferable))
      tabelas[table] = sourceDb.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY id`).all()
  } finally {
    sourceDb.exec('ROLLBACK')
  }
  const contagens = await importSnapshot(store, { formato: 'navalha-transferencia-1', chave: keyFingerprint(originalKey), tabelas })
  console.log(
    'Importação concluída e confirmada: ' +
      JSON.stringify(contagens) +
      '. IDs e históricos preservados; sessões e convites não foram importados. Faça login novamente.',
  )
} finally {
  sourceDb.close()
  await store.close()
}
