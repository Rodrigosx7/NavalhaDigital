import test from 'node:test'
import assert from 'node:assert/strict'
import config from '../vite.config.js'

test('servidor de desenvolvimento bloqueia banco, chaves e backups', () => {
  assert.ok(config.server.fs?.deny.includes('**/.data/**'))
  assert.ok(config.server.fs?.deny.includes('**/.secrets/**'))
  assert.equal(config.server.host, '127.0.0.1')
})
