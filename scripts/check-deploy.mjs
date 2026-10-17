const input = process.argv[2]
if (!input) throw new Error('Uso: npm run deploy:check -- https://seu-dominio.vercel.app')
const origin = new URL(input)
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Publicação exige HTTPS.')
for (const [path, kind] of [
  ['/', 'html'],
  ['/entrar', 'html'],
  ['/barbeiro/semana', 'html'],
  ['/api/health', 'health'],
  ['/api/catalogo', 'json'],
  ['/api/agendamentos', 'protected'],
]) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000), redirect: 'error' })
  if (kind === 'protected') {
    if (response.status !== 401) throw new Error(path + ': esperado acesso autenticado (401).')
    await response.json()
  } else {
    if (response.status !== 200) throw new Error(path + ': HTTP ' + response.status)
    if (kind === 'html') {
      const html = await response.text()
      if (!response.headers.get('content-type')?.includes('text/html') || !html.includes('id="root"'))
        throw new Error(path + ': página React não encontrada.')
    } else {
      const data = await response.json()
      if (kind === 'health' && data.ok !== true) throw new Error('API não confirmou funcionamento.')
      if (kind === 'json' && (!Array.isArray(data.servicos) || !Array.isArray(data.barbeiros))) throw new Error('Catálogo inválido.')
    }
  }
  console.log('OK ' + path)
}
console.log(
  'Verificação pública concluída. Cadastro, login, concorrência, backups e restauração devem ser validados separadamente na instalação real.',
)
