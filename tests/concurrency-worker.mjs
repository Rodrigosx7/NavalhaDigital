import { createSqliteRepository } from '../server/repository.mjs'
import { AgendaService } from '../server/booking.mjs'

const [databasePath, keyPath, clienteId, barbeiroId, servicoId] = process.argv.slice(2)
const store = await createSqliteRepository(databasePath, keyPath)
const agenda = new AgendaService(store, () => '2026-10-23T07:45:00')
console.log('READY')
process.stdin.once('data', async () => {
  try {
    await agenda.criar(await store.getUsuario(Number(clienteId)), {
      barbeiroId: Number(barbeiroId),
      servicoIds: [Number(servicoId)],
      dataHora: '2026-10-23T10:00',
    })
    console.log(JSON.stringify({ status: 201 }))
  } catch (error) {
    console.log(JSON.stringify({ status: error.status ?? 500 }))
  } finally {
    await store.close()
  }
})
