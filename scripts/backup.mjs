import { resolve } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'
import { Store } from '../server/store.mjs'
import { carregarChave, decifrar } from '../server/security.mjs'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const [action = 'criar', source, target] = process.argv.slice(2)
const databasePath = resolve(process.env.NAVALHA_DATABASE ?? '.data/navalha.sqlite')
const keyPath = resolve(process.env.NAVALHA_KEY_FILE ?? '.secrets/navalha.key')
if (action === 'restaurar') {
  if (!source || !target) throw new Error('Uso: npm run backup -- restaurar arquivo.enc novo-banco.sqlite')
  const destination = resolve(target)
  if (existsSync(destination)) throw new Error('A restauração exige um arquivo novo; não sobrescreve bancos existentes.')
  const data = decifrar(readFileSync(resolve(source), 'utf8'), carregarChave(keyPath, true))
  if (data.formato !== 'navalha-backup-1') throw new Error('Formato de backup inválido.')
  const database = Buffer.from(data.database, 'base64')
  if (database.subarray(0, 15).toString() !== 'SQLite format 3') throw new Error('Conteúdo SQLite inválido.')
  writeFileSync(destination, database, { flag: 'wx', mode: 0o600 })
  const restored = new DatabaseSync(destination)
  try { restored.exec('DELETE FROM sessoes') } finally { restored.close() }
  console.log('Cópia restaurada em novo arquivo, com sessões invalidadas. Faça login novamente. Mantenha a chave original e valide os dados antes de usá-la.')
} else {
  if (action !== 'criar' || !existsSync(databasePath)) throw new Error('Uso: npm run backup -- criar [arquivo.enc]. É necessário um banco existente.')
  const store = new Store(databasePath, keyPath)
  try { const output = resolve(source ?? '.data/backups/navalha-' + Date.now() + '.enc'); await store.backup(output); console.log('Backup cifrado criado: ' + output) } finally { store.close() }
}
