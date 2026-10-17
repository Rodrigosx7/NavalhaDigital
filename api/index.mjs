import { loadApplication } from '../server/runtime.mjs'

export function createVercelHandler({ load = () => loadApplication(process.env, { cloud: true }) } = {}) {
  let initialization
  return async (request, response) => {
    try {
      const url = new URL(request.url, 'https://navalha.invalid')
      if (url.searchParams.has('__route')) {
        const route = url.searchParams.get('__route')
        if (!/^[A-Za-z0-9/_-]*$/.test(route)) throw new Error('Rota inválida')
        url.pathname = '/api/' + route
        url.searchParams.delete('__route')
        request.url = url.pathname + url.search
      }
      initialization ??= load().catch((error) => {
        initialization = undefined
        throw error
      })
      const app = await initialization
      return await app.handler(request, response)
    } catch (error) {
      console.error('API indisponível:', error.code ?? error.name)
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      response.writeHead(503)
      response.end(JSON.stringify({ erro: 'Sistema temporariamente indisponível. Tente novamente em instantes.' }))
    }
  }
}

export default createVercelHandler()
