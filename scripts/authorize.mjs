import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { carregarChave, indiceEmail, token, hashToken } from '../server/security.mjs'
import { readRuntimeConfig } from '../server/config.mjs'
import { createPostgresRepository } from '../server/postgres.mjs'

const args = process.argv.slice(2)
const email = args
  .find((value) => !value.startsWith('--'))
  ?.trim()
  .toLowerCase()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Uso: npm run autorizar -- email@dominio.com [--revogar]')
if (process.env.DATABASE_URL) {
  const store = createPostgresRepository(readRuntimeConfig())
  try {
    await store.ready()
    const codigo = token(),
      index = store.emailIndex(email)
    await store.transaction(async () => {
      await store.sql.prepare('DELETE FROM convites WHERE email_indice=? AND utilizado=0').run(index)
      if (!args.includes('--revogar'))
        await store.sql
          .prepare('INSERT INTO convites(email_indice,segredo_hash,expira) VALUES(?,?,?)')
          .run(index, hashToken(codigo), Date.now() + 86400000)
    })
    console.log('Autorização PostgreSQL atualizada; não exige reiniciar a API e não altera contas existentes.')
    if (!args.includes('--revogar'))
      console.log('Código pessoal de uso único, válido por 24h; entregue ao profissional verificado: ' + codigo)
  } finally {
    await store.close()
  }
} else {
  const key = carregarChave(
    resolve(process.env.NAVALHA_KEY_FILE ?? '.secrets/navalha.key'),
    existsSync(resolve(process.env.NAVALHA_DATABASE ?? '.data/navalha.sqlite')),
  )
  const path = resolve('.secrets/profissionais.json')
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { convites: [] }
  const indexed = indiceEmail(email, key)
  const codigo = token()
  const convites = (existing.convites ?? []).filter((value) => value.emailIndice !== indexed && value.expira > Date.now())
  if (!args.includes('--revogar')) convites.push({ emailIndice: indexed, segredoHash: hashToken(codigo), expira: Date.now() + 86_400_000 })
  mkdirSync(resolve('.secrets'), { recursive: true })
  writeFileSync(path, JSON.stringify({ convites }, null, 2), { mode: 0o600 })
  console.log('Autorização atualizada. Reinicie a API. Não altera contas existentes.')
  if (!args.includes('--revogar'))
    console.log('Código de uso único, válido por 24h. Entregue ao profissional verificado fora do sistema: ' + codigo)
}
