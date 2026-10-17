import { loadApplication } from './runtime.mjs'

const app = await loadApplication()
const port = Number(process.env.API_PORT ?? 5180)
app.server.on('error', error => { console.error(`Não foi possível iniciar a API na porta ${port}: ${error.code}`); process.exit(1) })
app.server.listen(port, '127.0.0.1', () => { console.log(`API Navalha Digital: http://127.0.0.1:${port}/api/health`); process.send?.('ready') })
function encerrar() { app.server.close(async () => { await app.close(); process.exit(0) }) }
process.on('SIGINT', encerrar)
process.on('SIGTERM', encerrar)
