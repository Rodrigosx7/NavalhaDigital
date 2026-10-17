let csrfToken = null

export function setCsrf(value) { csrfToken = value }

export async function api(path, { method = 'GET', body, signal, headers = {} } = {}) {
  try {
    const response = await fetch('/api' + path, { method, signal, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const result = await response.json()
    if (!response.ok) { const error = new Error(result.erro || 'Não foi possível concluir a operação.'); error.status = response.status; throw error }
    if (Object.hasOwn(result, 'csrfToken')) setCsrf(result.csrfToken)
    return result
  } catch (error) {
    if (error.name === 'AbortError' || error.status) throw error
    throw new Error('Não foi possível conectar ao sistema. Verifique a conexão e tente novamente.')
  }
}
