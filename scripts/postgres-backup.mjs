import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { readRuntimeConfig } from '../server/config.mjs'
import { createPostgresRepository } from '../server/postgres.mjs'
import { snapshot, importSnapshot } from '../server/transfer.mjs'

const [action = 'criar', filename] = process.argv.slice(2)
const config = readRuntimeConfig({
  ...process.env,
  DATABASE_URL: action === 'restaurar' ? process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL : process.env.DATABASE_URL,
})
if (config.backend !== 'postgres') throw new Error('Configure PostgreSQL para o backup de produção.')
const store = createPostgresRepository(config)
try {
  await store.ready()
  if (action === 'criar') {
    const path = resolve(filename ?? '.data/backups/postgres-' + Date.now() + '.enc')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, store.encode(await snapshot(store)), { flag: 'wx', mode: 0o600 })
    console.log('Backup lógico cifrado criado: ' + path)
  } else if (action === 'restaurar' && filename) {
    console.log(
      'Restauração confirmada em destino novo: ' +
        JSON.stringify(await importSnapshot(store, store.decode(readFileSync(resolve(filename), 'utf8')))) +
        '. Sessões antigas não foram reativadas.',
    )
  } else throw new Error('Uso: npm run db:backup -- criar [arquivo.enc] ou restaurar arquivo.enc')
} finally {
  await store.close()
}
