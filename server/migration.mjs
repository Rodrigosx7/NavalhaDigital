import { readFileSync } from 'node:fs'
import { keyFingerprint } from './postgres.mjs'

export async function initializeDatabase(pool, key) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(1300000422)')
    const exists = (await client.query("SELECT to_regclass('navalha.configuracao') AS tabela")).rows[0].tabela
    if (exists) {
      const config = (await client.query('SELECT * FROM navalha.configuracao')).rows
      if (config.find((x) => x.chave === 'schema_version')?.valor !== '1') throw new Error('Versão do schema incompatível.')
      if (config.find((x) => x.chave === 'key_fingerprint')?.valor !== keyFingerprint(key))
        throw new Error('A chave configurada não corresponde ao banco existente.')
    } else {
      await client.query(readFileSync(new URL('../supabase/migrations/0001_navalha.sql', import.meta.url), 'utf8'))
      await client.query("INSERT INTO navalha.configuracao(chave,valor) VALUES('key_fingerprint',$1)", [keyFingerprint(key)])
    }
    await client.query('COMMIT')
    return { criado: !exists }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
