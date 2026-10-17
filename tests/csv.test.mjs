import test from 'node:test'
import assert from 'node:assert/strict'
import { criarCSV } from '../src/services/csv.js'

test('CSV preserva acentos e escapa células e fórmulas', () => {
  const result = criarCSV([['Cliente', 'Serviço'], ['=1+1', 'Hidratação; "capilar"'], ['Ana\nSouza', 65]])
  assert.ok(result.startsWith('\ufeff'))
  assert.ok(result.includes('"\'=1+1"'))
  assert.ok(result.includes('"Hidratação; ""capilar"""'))
})
