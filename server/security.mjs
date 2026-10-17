import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { promisify } from 'node:util'

const derive = promisify(scrypt)

export function carregarChave(path, databaseExists = false) {
  if (!existsSync(path)) {
    if (databaseExists) throw new Error('Chave ausente para banco existente. Restaure a chave original; não é possível recriá-la.')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, randomBytes(32), { flag: 'wx', mode: 0o600 })
  }
  const key = readFileSync(path)
  if (key.length !== 32) throw new Error('Chave de criptografia inválida.')
  return key
}

export function cifrar(value, key) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64')
}

export function decifrar(value, key) {
  const data = Buffer.from(value, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12))
  decipher.setAuthTag(data.subarray(12, 28))
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'))
}

export function indiceEmail(email, key) { return createHmac('sha256', key).update('email:' + email).digest('hex') }
export function token() { return randomBytes(32).toString('hex') }
export function hashToken(value) { return createHash('sha256').update(value).digest('hex') }

export async function hashSenha(senha) {
  const salt = randomBytes(16)
  const result = await derive(senha, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 })
  return `scrypt$32768$8$3$${salt.toString('hex')}$${result.toString('hex')}`
}

export async function verificarSenha(senha, stored) {
  try {
    const [algorithm, cost, block, parallel, salt, expected] = stored.split('$')
    if (algorithm !== 'scrypt' || cost !== '32768' || block !== '8' || parallel !== '3') return false
    const actual = await derive(senha, Buffer.from(salt, 'hex'), 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 })
    const digest = Buffer.from(expected, 'hex')
    return digest.length === actual.length && timingSafeEqual(digest, actual)
  } catch { return false }
}
