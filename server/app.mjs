import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { createSqliteRepository } from './repository.mjs'
import { AgendaService } from './booking.mjs'
import { ErroDominio, Servico, agoraLocal, centavos, exigir, inteiro, texto, validarData } from './domain.mjs'
import { hashSenha, verificarSenha, token, hashToken } from './security.mjs'

export function createApplication(options = {}) {
  let store, agenda
  const clock = options.clock ?? agoraLocal
  const ready = (async () => {
    store =
      options.store ??
      (await createSqliteRepository(
        options.databasePath ?? resolve('.data/navalha.sqlite'),
        options.keyPath ?? resolve('.secrets/navalha.key'),
      ))
    await store.ready?.()
    agenda = new AgendaService(store, clock)
    if (!store.postgres && options.authorizedInvitations)
      await store.transaction(async () => {
        await store.sql.prepare('DELETE FROM convites WHERE utilizado=0').run()
        for (const invitation of options.authorizedInvitations ?? []) {
          const emailIndex = invitation.emailIndice ?? store.emailIndex(invitation.email.trim().toLowerCase())
          const secretHash = invitation.segredoHash ?? hashToken(invitation.codigo)
          const expires = invitation.expira ?? Date.now() + 86_400_000
          await store.sql
            .prepare('INSERT OR IGNORE INTO convites(email_indice,segredo_hash,expira) VALUES(?,?,?)')
            .run(emailIndex, secretHash, expires)
        }
      })
  })()
  ready.catch(() => {})
  const origins = new Set(
    options.origins ?? ['http://127.0.0.1:5174', 'http://localhost:5174', 'http://127.0.0.1:5180', 'http://localhost:5180'],
  )
  let authActive = 0
  const emailValido = (email) => {
    const value = texto(email, 'E-mail', 5, 254).toLowerCase()
    exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'E-mail inválido.')
    return value
  }
  const dadosConta = (data) => ({
    nome: texto(data.nome, 'Nome', 3, 100),
    email: emailValido(data.email),
    telefone: texto(data.telefone, 'Telefone', 10, 22),
    ...(data.dataNascimento ? { dataNascimento: validarData(data.dataNascimento) } : {}),
    endereco: texto(data.endereco ?? '', 'Endereço', 0, 300),
    registroProfissional: texto(data.registroProfissional ?? '', 'Registro profissional', 0, 100),
    bio: texto(data.bio ?? '', 'Biografia', 0, 1000),
  })
  const validarConta = (data) => {
    exigir(
      (data.telefone.match(/\d/g) ?? []).length >= 10 && (data.telefone.match(/\d/g) ?? []).length <= 11,
      'Telefone deve ter 10 ou 11 dígitos.',
    )
    if (data.dataNascimento) exigir(data.dataNascimento <= clock().slice(0, 10), 'Data de nascimento futura inválida.')
  }
  const safeUser = (usuario) => {
    if (!usuario) return null
    const { senhaHash, ...safe } = usuario
    return safe
  }
  const sessionFor = async (usuarioId, response) => {
    await store.sql.prepare('DELETE FROM sessoes WHERE expira<?').run(Date.now())
    const sessionToken = token(),
      csrf = token()
    await store.sql
      .prepare('INSERT INTO sessoes(token_hash,usuario_id,csrf,expira) VALUES(?,?,?,?)')
      .run(hashToken(sessionToken), usuarioId, csrf, Date.now() + 8 * 60 * 60 * 1000)
    response.setHeader(
      'Set-Cookie',
      `navalha_session=${sessionToken}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${options.secureCookies ? '; Secure' : ''}`,
    )
    return { usuario: safeUser(await store.getUsuario(usuarioId)), csrfToken: csrf }
  }
  const handler = async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    const send = (status, data) => {
      response.writeHead(status)
      response.end(JSON.stringify(data))
    }
    try {
      await ready
      const url = new URL(request.url, 'http://127.0.0.1')
      const path = url.pathname.replace(/^\/api/, '')
      exigir(url.pathname.startsWith('/api/'), 'Rota não encontrada.', 404)
      const method = request.method
      const writing = !['GET', 'HEAD'].includes(method)
      if (writing) {
        exigir(!request.headers.origin || origins.has(request.headers.origin), 'Origem não autorizada.', 403)
        exigir(request.headers['sec-fetch-site'] !== 'cross-site', 'Solicitação externa rejeitada.', 403)
        exigir(request.headers['content-type']?.split(';')[0] === 'application/json', 'Envie dados JSON.', 415)
      }
      let data = {}
      if (writing) {
        if (request.body !== undefined) {
          const content =
            typeof request.body === 'object' && !Buffer.isBuffer(request.body) ? JSON.stringify(request.body) : String(request.body)
          exigir(Buffer.byteLength(content) <= 65536, 'Dados excedem o tamanho permitido.', 413)
          try {
            data = JSON.parse(content)
          } catch {
            throw new ErroDominio('JSON inválido.', 400)
          }
        } else {
          const chunks = []
          let size = 0
          for await (const chunk of request) {
            const buffer = Buffer.from(chunk)
            size += buffer.length
            exigir(size <= 65536, 'Dados excedem o tamanho permitido.', 413)
            chunks.push(buffer)
          }
          try {
            data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          } catch {
            throw new ErroDominio('JSON inválido.', 400)
          }
        }
        exigir(data && typeof data === 'object' && !Array.isArray(data), 'Dados inválidos.', 400)
      }
      const rawToken = request.headers.cookie
        ?.split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith('navalha_session='))
        ?.slice('navalha_session='.length)
      const session =
        rawToken && /^[a-f0-9]{64}$/.test(rawToken)
          ? await store.sql.prepare('SELECT * FROM sessoes WHERE token_hash=? AND expira>?').get(hashToken(rawToken), Date.now())
          : null
      const actor = session ? safeUser(await store.getUsuario(session.usuario_id)) : null
      const requireActor = () => {
        exigir(actor, 'Entre na sua conta para continuar.', 401)
        if (writing) exigir(request.headers['x-csrf-token'] === session.csrf, 'Sessão de confirmação inválida. Atualize a página.', 403)
        return actor
      }
      if (method === 'GET' && path === '/health') {
        await store.sql.prepare('SELECT 1 AS ok').get()
        return send(200, { ok: true, versao: '2.1', fusoHorario: 'America/Sao_Paulo', agora: clock() })
      }
      if (method === 'GET' && path === '/auth/sessao') return send(200, { usuario: actor, csrfToken: session?.csrf ?? null })
      if (method === 'GET' && path === '/catalogo') {
        const barbeiros = (await store.sql.prepare("SELECT * FROM usuarios WHERE perfil='BARBEIRO' ORDER BY id").all()).map((row) => {
          const user = store.usuario(row)
          return { id: user.id, nome: user.nome, bio: user.bio, registroProfissional: user.registroProfissional }
        })
        return send(200, {
          servicos: (await store.servicos()).filter((item) => item.ativo),
          barbeiros,
          agora: clock(),
          fusoHorario: 'America/Sao_Paulo',
        })
      }
      if (method === 'POST' && ['/auth/login', '/auth/cadastro'].includes(path)) {
        exigir(
          typeof data.senha === 'string' && data.senha.length >= 10 && data.senha.length <= 128,
          'A senha deve ter entre 10 e 128 caracteres.',
        )
        const email = emailValido(data.email)
        const attemptKey = store.emailIndex(email) + ':' + path
        if (!options.testMode) exigir(authActive < 4, 'Muitas tentativas. Aguarde alguns minutos.', 429)
        authActive++
        try {
          if (!options.testMode)
            exigir(await store.admitirAutenticacao(attemptKey), 'Muitas tentativas. Aguarde alguns minutos.', 429)
          if (path === '/auth/login') {
            const row = await store.sql.prepare('SELECT * FROM usuarios WHERE email_indice=?').get(store.emailIndex(email))
            exigir(row && (await verificarSenha(data.senha, row.senha_hash)), 'E-mail ou senha incorretos.', 401)
            await store.limparAutenticacao(attemptKey)
            if (rawToken) await store.sql.prepare('DELETE FROM sessoes WHERE token_hash=?').run(hashToken(rawToken))
            return send(200, await sessionFor(row.id, response))
          }
          const perfil = data.perfil ?? 'CLIENTE'
          exigir(['CLIENTE', 'BARBEIRO'].includes(perfil), 'Perfil inválido.')
          const invitationHash = typeof data.codigoAutorizacao === 'string' ? hashToken(data.codigoAutorizacao.trim()) : ''
          const invitationValid = async () =>
            await store.sql
              .prepare('SELECT * FROM convites WHERE email_indice=? AND segredo_hash=? AND utilizado=0 AND expira>?')
              .get(store.emailIndex(email), invitationHash, Date.now())
          if (perfil === 'BARBEIRO')
            exigir(await invitationValid(), 'Cadastro profissional exige um código de autorização válido, entregue pela barbearia.', 403)
          const account = dadosConta(data)
          validarConta(account)
          if (perfil === 'BARBEIRO') texto(account.registroProfissional, 'Registro profissional', 2, 100)
          const passwordHash = await hashSenha(data.senha)
          let id
          try {
            id = await store.transaction(async () => {
              if (perfil === 'BARBEIRO') exigir(await invitationValid(), 'Código de autorização expirou ou já foi utilizado.', 403)
              const createdId = Number(
                (
                  await store.sql
                    .prepare('INSERT INTO usuarios(perfil,email_indice,dados,senha_hash,data_cadastro) VALUES(?,?,?,?,?)')
                    .run(perfil, store.emailIndex(email), store.encode(account), passwordHash, clock())
                ).lastInsertRowid,
              )
              if (perfil === 'BARBEIRO') await store.sql.prepare('UPDATE convites SET utilizado=1 WHERE segredo_hash=?').run(invitationHash)
              return createdId
            })
          } catch (error) {
            if (error.code === '23505' || String(error.message).includes('UNIQUE'))
              throw new ErroDominio('Este e-mail já está cadastrado.', 409)
            throw error
          }
          await store.limparAutenticacao(attemptKey)
          return send(201, await sessionFor(id, response))
        } finally {
          authActive--
        }
      }
      requireActor()
      if (method === 'POST' && path === '/auth/sair') {
        await store.sql.prepare('DELETE FROM sessoes WHERE token_hash=?').run(hashToken(rawToken))
        response.setHeader('Set-Cookie', 'navalha_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0')
        return send(200, { ok: true })
      }
      if (method === 'PUT' && path === '/conta') {
        exigir(!Object.hasOwn(data, 'perfil') && !Object.hasOwn(data, 'senha'), 'Esta operação atualiza apenas os dados cadastrais.')
        const account = dadosConta({ ...actor, ...data })
        validarConta(account)
        if (actor.perfil === 'BARBEIRO') {
          exigir(account.email === actor.email, 'A alteração do e-mail profissional exige nova autorização fora do sistema.')
          texto(account.registroProfissional, 'Registro profissional', 2, 100)
        }
        try {
          await store.sql
            .prepare('UPDATE usuarios SET dados=?,email_indice=? WHERE id=?')
            .run(store.encode(account), store.emailIndex(account.email), actor.id)
        } catch (error) {
          if (error.code === '23505' || String(error.message).includes('UNIQUE'))
            throw new ErroDominio('Este e-mail já está cadastrado.', 409)
          throw error
        }
        return send(200, { usuario: await store.getUsuario(actor.id) })
      }
      if (method === 'GET' && path === '/clientes') {
        agenda.profissional(actor)
        const clientes = (await store.sql.prepare("SELECT * FROM usuarios WHERE perfil='CLIENTE' ORDER BY id").all()).map((row) => {
          const user = store.usuario(row)
          return { id: user.id, nome: user.nome, email: user.email }
        })
        return send(200, { clientes })
      }
      if (path === '/servicos' && method === 'GET') {
        agenda.profissional(actor)
        return send(200, { servicos: await store.servicos() })
      }
      const serviceMatch = path.match(/^\/servicos\/(\d+)$/)
      if ((path === '/servicos' && method === 'POST') || (serviceMatch && method === 'PUT')) {
        agenda.profissional(actor)
        const savedService = await store.transaction(async () => {
          const id = serviceMatch ? Number(serviceMatch[1]) : null
          const current = id ? (await store.servicos()).find((item) => item.id === id) : null
          if (id) exigir(current, 'Serviço não encontrado.', 404)
          const service = new Servico({ ...current, ...data })
          if (id)
            await store.sql
              .prepare('UPDATE servicos SET nome=?,descricao=?,categoria=?,preco_centavos=?,duracao=?,ativo=? WHERE id=?')
              .run(
                service.nome,
                service.descricao,
                service.categoria,
                centavos(service.preco),
                service.duracaoMinutos,
                Number(service.ativo),
                id,
              )
          else
            service.id = Number(
              (
                await store.sql
                  .prepare('INSERT INTO servicos(nome,descricao,categoria,preco_centavos,duracao,ativo) VALUES(?,?,?,?,?,?)')
                  .run(
                    service.nome,
                    service.descricao,
                    service.categoria,
                    centavos(service.preco),
                    service.duracaoMinutos,
                    Number(service.ativo),
                  )
              ).lastInsertRowid,
            )
          return { ...service, id: id ?? service.id }
        })
        return send(serviceMatch ? 200 : 201, { servico: savedService })
      }
      if (method === 'GET' && path === '/disponibilidades') {
        agenda.profissional(actor)
        return send(200, { disponibilidades: await store.janelas(actor.id) })
      }
      const windowMatch = path.match(/^\/disponibilidades\/(\d+)$/)
      if ((method === 'POST' && path === '/disponibilidades') || (method === 'PUT' && windowMatch))
        return send(windowMatch ? 200 : 201, {
          disponibilidade: await agenda.salvarJanela(actor, data, windowMatch ? Number(windowMatch[1]) : null),
        })
      if (method === 'GET' && path === '/horarios') {
        const barbeiroId = inteiro(Number(url.searchParams.get('barbeiroId')), 'Barbeiro')
        const ids = (url.searchParams.get('servicoIds') ?? '').split(',').filter(Boolean).map(Number)
        const excluirId = url.searchParams.has('excluirId') ? inteiro(Number(url.searchParams.get('excluirId')), 'Agendamento') : null
        return send(200, {
          horarios: await agenda.horarios(actor, url.searchParams.get('data'), barbeiroId, ids, excluirId),
          agora: clock(),
        })
      }
      if (path === '/agendamentos' && method === 'POST')
        return send(201, { agendamento: await agenda.criar(actor, data, request.headers['idempotency-key'] ?? null) })
      if (path === '/agendamentos' && method === 'GET') {
        const column = actor.perfil === 'CLIENTE' ? 'cliente_id' : 'barbeiro_id'
        const rows = await store.sql.prepare(`SELECT * FROM agendamentos WHERE ${column}=? ORDER BY data_hora`).all(actor.id)
        return send(200, { agendamentos: await store.mapReservas(rows), agora: clock() })
      }
      const bookingMatch = path.match(/^\/agendamentos\/(\d+)(?:\/(cancelar|status))?$/)
      if (bookingMatch) {
        const id = inteiro(Number(bookingMatch[1]), 'Agendamento'),
          action = bookingMatch[2]
        if (method === 'GET' && !action)
          return send(200, { agendamento: agenda.acessivel(actor, await store.getReserva(id)), agora: clock() })
        if (method === 'PUT' && !action)
          return send(200, { agendamento: await agenda.reagendar(actor, id, data, request.headers['idempotency-key'] ?? null) })
        if (method === 'POST' && action === 'cancelar') return send(200, { agendamento: await agenda.cancelar(actor, id, data.motivo) })
        if (method === 'POST' && action === 'status') return send(200, { agendamento: await agenda.alterarStatus(actor, id, data.status) })
      }
      if (method === 'GET' && path === '/relatorios') {
        agenda.profissional(actor)
        const inicio = validarData(url.searchParams.get('inicio')),
          fim = validarData(url.searchParams.get('fim'))
        exigir(inicio <= fim, 'O início do período não pode ser posterior ao fim.')
        const agendamentos = (await store.reservas(actor.id)).filter(
          (item) => item.status === 'CONCLUIDO' && item.dataHora.slice(0, 10) >= inicio && item.dataHora.slice(0, 10) <= fim,
        )
        return send(200, {
          agendamentos,
          quantidade: agendamentos.length,
          valorTotal: agendamentos.reduce((total, item) => total + Math.round(item.valorTotal * 100), 0) / 100,
          inicio,
          fim,
        })
      }
      throw new ErroDominio('Rota não encontrada.', 404)
    } catch (error) {
      const status =
        error.status ?? (['23P01', '40001', '40P01', '55P03'].includes(error.code) || String(error.message).includes('locked') ? 409 : 500)
      if (status === 500 && !options.testMode) console.error('Falha interna:', error.code ?? error.name)
      send(status, {
        erro:
          status === 500
            ? 'Não foi possível gravar ou consultar os dados. Suas escolhas podem ser revisadas e reenviadas.'
            : status === 409 && !error.status
              ? 'O horário ou os dados foram alterados. Atualize e revise suas escolhas.'
              : error.message,
      })
    }
  }
  const server = createServer(handler)
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  return {
    server,
    ready,
    handler,
    get store() {
      return store
    },
    get agenda() {
      return agenda
    },
    close: async () => {
      await ready
      await store.close()
    },
  }
}
