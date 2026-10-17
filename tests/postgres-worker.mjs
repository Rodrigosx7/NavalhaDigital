import { createPostgresRepository } from '../server/postgres.mjs'
import { AgendaService } from '../server/booking.mjs'

const store = createPostgresRepository({
  connectionString: process.env.NAVALHA_TEST_POSTGRES_URL,
  key: Buffer.from(process.env.NAVALHA_TEST_PG_KEY, 'base64'),
  allowLocal: true,
})
await store.ready()
const agenda = new AgendaService(store, () => '2026-10-23T07:45:00')
console.log('READY')
process.stdin.once('data', async (value) => {
  const { clienteId, barbeiroId, servicoIds, dataHora, chave } = JSON.parse(value)
  try {
    const result = await agenda.criar(await store.getUsuario(clienteId), { barbeiroId, servicoIds, dataHora }, chave)
    console.log(JSON.stringify({ status: 201, id: result.id }))
  } catch (error) {
    console.log(JSON.stringify({ status: error.status ?? (error.code === '23P01' ? 409 : 500) }))
  } finally {
    await store.close()
  }
})
