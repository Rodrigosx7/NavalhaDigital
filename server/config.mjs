import { resolve } from 'node:path'

export function readRuntimeConfig(env = process.env, { cloud = env.VERCEL === '1' } = {}) {
  const production = cloud || env.NODE_ENV === 'production'
  const connectionString = env.DATABASE_URL?.trim()
  if (cloud && !connectionString) throw new Error('DATABASE_URL não configurada. Vercel exige PostgreSQL.')
  const origin = env.APP_ORIGIN?.trim() || (!production ? 'http://127.0.0.1:5174' : '')
  let url
  try {
    url = new URL(origin)
  } catch {
    throw new Error('APP_ORIGIN deve identificar o domínio do site.')
  }
  if (url.origin !== origin || url.username || url.password || (production && url.protocol !== 'https:'))
    throw new Error('APP_ORIGIN deve ser uma origem HTTPS sem caminho ou barra final.')
  if (production && !connectionString) throw new Error('Produção exige PostgreSQL. SQLite é apenas o modo local.')
  const backend = connectionString ? 'postgres' : 'sqlite'
  let key
  if (backend === 'postgres') {
    try {
      const parsed = new URL(connectionString)
      if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.password)
        throw new Error()
    } catch {
      throw new Error('DATABASE_URL deve ser a conexão PostgreSQL privada completa.')
    }
    const encoded = env.NAVALHA_ENCRYPTION_KEY?.trim()
    key = Buffer.from(encoded ?? '', 'base64')
    if (key.length !== 32 || key.toString('base64') !== encoded)
      throw new Error('NAVALHA_ENCRYPTION_KEY deve conter a chave original de 32 bytes em base64.')
  }
  return {
    backend,
    connectionString,
    key,
    ca: env.NAVALHA_DATABASE_CA?.replaceAll('\\n', '\n'),
    allowLocal: !production && env.NAVALHA_ALLOW_LOCAL_POSTGRES === '1',
    secureCookies: production,
    origins: production
      ? [origin]
      : [...new Set([origin, 'http://127.0.0.1:5174', 'http://localhost:5174', 'http://127.0.0.1:5180', 'http://localhost:5180'])],
    databasePath: resolve(env.NAVALHA_DATABASE ?? '.data/navalha.sqlite'),
    keyPath: resolve(env.NAVALHA_KEY_FILE ?? '.secrets/navalha.key'),
  }
}
