import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { carregarChave } from '../server/security.mjs'

const keyPath = resolve(process.env.NAVALHA_KEY_FILE ?? '.secrets/navalha.key')
const databaseExists = existsSync(resolve(process.env.NAVALHA_DATABASE ?? '.data/navalha.sqlite'))
const key = carregarChave(keyPath, databaseExists)
mkdirSync('.secrets', { recursive: true })
writeFileSync('.secrets/chave-vercel.env', 'NAVALHA_ENCRYPTION_KEY=' + key.toString('base64') + '\n', { mode: 0o600, flag: 'wx' })
console.log(
  'Chave preparada em .secrets/chave-vercel.env, sem exibi-la no terminal. Guarde uma cópia protegida separada. Não envie esse arquivo pelo chat ou Git.',
)
