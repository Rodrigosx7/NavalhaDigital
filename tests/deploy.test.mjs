import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { readRuntimeConfig } from '../server/config.mjs'
import { createVercelHandler } from '../api/index.mjs'
import { createPool } from '../server/postgres.mjs'
import { createApplication } from '../server/app.mjs'

const environment = () => ({
  DATABASE_URL: 'postgresql://user:example@pooler.supabase.com:6543/postgres',
  NAVALHA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  APP_ORIGIN: 'https://navalha.example.com',
})

test('parâmetros da URI não podem desabilitar TLS ou validação do certificado', async () => {
  for (const suffix of ['?ssl=0','?ssl=no-verify','?sslmode=disable','?sslmode=require&uselibpqcompat=true']) {
    const pool=createPool('postgresql://user:example@pooler.supabase.com:6543/postgres'+suffix)
    try {const client=new pool.Client(pool.options);assert.equal(client.connectionParameters.ssl?.rejectUnauthorized,true)}
    finally {await pool.end()}
  }
})

test('limite de quatro autenticações reserva vaga antes da espera no banco', async () => {
  let release, admitted=0
  const barrier=new Promise(resolve=>{release=resolve})
  const store={postgres:true,emailIndex:value=>value,admitirAutenticacao:async()=>{admitted++;await barrier;return true},sql:{prepare:()=>({get:async()=>null})},close:async()=>{}}
  const app=createApplication({store})
  await app.ready
  const pending=Array.from({length:12},(_,i)=>{
    let status
    const response={setHeader(){},writeHead(v){status=v},end(){}}
    return app.handler({url:'/api/auth/login',method:'POST',headers:{'content-type':'application/json'},body:{email:`pessoa${i}@example.com`,senha:'Teste-seguro-2026!'}},response).then(()=>status)
  })
  await new Promise(resolve=>setImmediate(resolve))
  const observed=admitted
  release()
  const results=await Promise.all(pending)
  assert.equal(observed,4)
  assert.equal(results.filter(status=>status===429).length,8)
  await app.close()
})
test('nuvem exige PostgreSQL, origem HTTPS e chave fixa válida; recusa SQLite e SSL inseguro', () => {
  const config = readRuntimeConfig(environment(), { cloud: true })
  assert.equal(config.backend, 'postgres')
  assert.equal(config.secureCookies, true)
  for (const field of ['DATABASE_URL', 'APP_ORIGIN', 'NAVALHA_ENCRYPTION_KEY']) {
    const env = environment()
    delete env[field]
    assert.throws(() => readRuntimeConfig(env, { cloud: true }))
  }
  assert.throws(() => readRuntimeConfig({ ...environment(), APP_ORIGIN: 'http://example.com' }, { cloud: true }))
  assert.throws(() => readRuntimeConfig({ ...environment(), NAVALHA_ENCRYPTION_KEY: 'invalid' }, { cloud: true }))
})

test('handler Vercel reutiliza inicialização, conserva query e aceita body já interpretado', async () => {
  let count = 0,
    received
  const handler = createVercelHandler({
    load: async () => {
      count++
      return {
        handler: async (req) => {
          received = { url: req.url, body: req.body }
        },
      }
    },
  })
  const req = { url: '/api/index?__route=horarios&data=2026-10-23', body: { teste: true } }
  await handler({ ...req }, {})
  await handler({ ...req }, {})
  assert.equal(count, 1)
  assert.equal(received.url, '/api/horarios?data=2026-10-23')
  assert.deepEqual(received.body, { teste: true })
})

test('falha de inicialização não vaza credenciais e permite tentar novamente', async () => {
  let count = 0,
    output,
    status
  const handler = createVercelHandler({
    load: async () => {
      count++
      throw new Error('postgres://secret-password')
    },
  })
  const response = {
    setHeader() {},
    writeHead(value) {
      status = value
    },
    end(value) {
      output = value
    },
  }
  await handler({ url: '/api/index?__route=health' }, response)
  await handler({ url: '/api/index?__route=health' }, response)
  assert.equal(status, 503)
  assert.equal(count, 2)
  assert.equal(output.includes('secret-password'), false)
})

test('Vercel mantém API antes do fallback SPA e exclui arquivos privados do upload', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)))
  assert.equal(config.outputDirectory, 'dist')
  assert.equal(config.rewrites[0].source, '/api/:path*')
  assert.ok(config.rewrites[0].destination.startsWith('/api/index'))
  assert.equal(config.rewrites.at(-1).destination, '/index.html')
  const ignore = readFileSync(new URL('../.vercelignore', import.meta.url), 'utf8')
  for (const path of ['.data', '.secrets', 'docs', 'graphify-out']) assert.ok(ignore.includes(path))
})
