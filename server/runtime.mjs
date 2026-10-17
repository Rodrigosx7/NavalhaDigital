import { createApplication } from './app.mjs'
import { readRuntimeConfig } from './config.mjs'
import { createPostgresRepository } from './postgres.mjs'

export async function loadApplication(env = process.env, options = {}) {
  const config = readRuntimeConfig(env, options)
  const store = config.backend === 'postgres' ? createPostgresRepository(config) : undefined
  let authorizedInvitations
  if (config.backend === 'sqlite') {
    const { existsSync, readFileSync } = await import('node:fs')
    if (existsSync('.secrets/profissionais.json'))
      authorizedInvitations = JSON.parse(readFileSync('.secrets/profissionais.json', 'utf8')).convites ?? []
  }
  const app = createApplication({ ...config, store, ...(authorizedInvitations ? { authorizedInvitations } : {}) })
  try {
    await app.ready
    return app
  } catch (error) {
    if (store) await store.close()
    throw error
  }
}
