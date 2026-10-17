import { readRuntimeConfig } from '../server/config.mjs'
import { createPool, createPostgresRepository } from '../server/postgres.mjs'
import { initializeDatabase } from '../server/migration.mjs'

const action = process.argv[2] ?? 'verificar'
const config = readRuntimeConfig({
  ...process.env,
  DATABASE_URL: action === 'migrar' ? process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL : process.env.DATABASE_URL,
})
if (config.backend !== 'postgres') throw new Error('Configure a conexão PostgreSQL e a chave privada em .env.local.')
if (action === 'migrar') {
  const pool = createPool(config.connectionString, config)
  try {
    const result = await initializeDatabase(pool, config.key)
    console.log(
      result.criado
        ? 'Schema criado e chave vinculada. Nenhuma conta ou janela foi inventada.'
        : 'Schema e chave já conferidos. Nenhum dado foi alterado.',
    )
  } finally {
    await pool.end()
  }
} else if (action === 'verificar') {
  const store = createPostgresRepository(config)
  try {
    await store.ready()
    console.log('Conexão, schema e chave conferidos. Serviços cadastrados: ' + (await store.servicos()).length)
  } finally {
    await store.close()
  }
} else throw new Error('Uso: npm run db:migrate ou npm run db:check')
