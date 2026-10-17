import { Barbeiro, Cliente, ErroDominio, Servico, centavos, exigir, inteiro, texto, validarData } from './domain.mjs'
import { hashSenha, verificarSenha, hashToken } from './security.mjs'

export function emailValido(email) {
  const value = texto(email, 'E-mail', 5, 254).toLowerCase()
  exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'E-mail inválido.')
  return value
}

// As classes de domínio expõem os comandos UML; este serviço cuida do I/O.
// O vínculo é privado em Usuario e nunca integra o JSON das contas/sessões.
export class UsuariosService {
  constructor(store, agenda, clock) { this.store = store; this.agenda = agenda; this.clock = clock }
  usuario(data) {
    if (!data) return null
    exigir(['CLIENTE', 'BARBEIRO'].includes(data.perfil), 'Perfil inválido.')
    return data.perfil === 'BARBEIRO' ? new Barbeiro(data, this) : new Cliente(data, this)
  }
  dadosConta(data) {
    const account = {
      nome: texto(data.nome, 'Nome', 3, 100), email: emailValido(data.email), telefone: texto(data.telefone, 'Telefone', 10, 22),
      ...(data.dataNascimento ? { dataNascimento: validarData(data.dataNascimento) } : {}),
      endereco: texto(data.endereco ?? '', 'Endereço', 0, 300), registroProfissional: texto(data.registroProfissional ?? '', 'Registro profissional', 0, 100), bio: texto(data.bio ?? '', 'Biografia', 0, 1000),
    }
    const digitos = (account.telefone.match(/\d/g) ?? []).length
    exigir(digitos >= 10 && digitos <= 11, 'Telefone deve ter 10 ou 11 dígitos.')
    if (account.dataNascimento) exigir(account.dataNascimento <= this.clock().slice(0, 10), 'Data de nascimento futura inválida.')
    return account
  }
  async cadastrar(actor, data) {
    exigir(typeof data.senha === 'string' && data.senha.length >= 10 && data.senha.length <= 128, 'A senha deve ter entre 10 e 128 caracteres.')
    const perfil = actor.perfil, account = this.dadosConta(data)
    const invitationHash = typeof data.codigoAutorizacao === 'string' ? hashToken(data.codigoAutorizacao.trim()) : ''
    const invitationValid = () => this.store.sql.prepare('SELECT * FROM convites WHERE email_indice=? AND segredo_hash=? AND utilizado=0 AND expira>?').get(this.store.emailIndex(account.email), invitationHash, Date.now())
    if (perfil === 'BARBEIRO') {
      exigir(await invitationValid(), 'Cadastro profissional exige um código de autorização válido, entregue pela barbearia.', 403)
      texto(account.registroProfissional, 'Registro profissional', 2, 100)
    }
    const passwordHash = await hashSenha(data.senha)
    try {
      return await this.store.transaction(async () => {
        if (perfil === 'BARBEIRO') exigir(await invitationValid(), 'Código de autorização expirou ou já foi utilizado.', 403)
        const id = Number((await this.store.sql.prepare('INSERT INTO usuarios(perfil,email_indice,dados,senha_hash,data_cadastro) VALUES(?,?,?,?,?)').run(perfil, this.store.emailIndex(account.email), this.store.encode(account), passwordHash, this.clock())).lastInsertRowid)
        if (perfil === 'BARBEIRO') await this.store.sql.prepare('UPDATE convites SET utilizado=1 WHERE segredo_hash=?').run(invitationHash)
        return id
      })
    } catch (error) { this.erroUnico(error) }
  }
  async autenticar(actor, email, senha) {
    const row = await this.store.sql.prepare('SELECT * FROM usuarios WHERE id=? AND email_indice=?').get(actor.id, this.store.emailIndex(emailValido(email)))
    return Boolean(row && await verificarSenha(senha, row.senha_hash))
  }
  async atualizarDados(actor, data) {
    exigir(!Object.hasOwn(data, 'perfil') && !Object.hasOwn(data, 'senha'), 'Esta operação atualiza apenas os dados cadastrais.')
    const account = this.dadosConta({ ...actor, ...data })
    if (actor.perfil === 'BARBEIRO') {
      exigir(account.email === actor.email, 'A alteração do e-mail profissional exige nova autorização fora do sistema.')
      texto(account.registroProfissional, 'Registro profissional', 2, 100)
    }
    try {
      await this.store.sql.prepare('UPDATE usuarios SET dados=?,email_indice=? WHERE id=?').run(this.store.encode(account), this.store.emailIndex(account.email), actor.id)
    } catch (error) { this.erroUnico(error) }
    return await this.store.getUsuario(actor.id)
  }
  erroUnico(error) {
    if (error.code === '23505' || String(error.message).includes('UNIQUE')) throw new ErroDominio('Este e-mail já está cadastrado.', 409)
    throw error
  }
  async consultarDisponibilidades(actor, barbeiroId) {
    inteiro(barbeiroId, 'Barbeiro')
    exigir((await this.store.getUsuario(barbeiroId))?.perfil === 'BARBEIRO', 'Barbeiro não encontrado.')
    return (await this.store.janelas(barbeiroId)).filter(item => item.ativo)
  }
  async consultarAgenda(actor) {
    this.agenda.profissional(actor)
    return await this.store.reservas(actor.id)
  }
  agendar(actor, data, chave) { return this.agenda.criar(actor, data, chave) }
  cancelarAgendamento(actor, id, motivo) { return this.agenda.cancelar(actor, id, motivo) }
  cadastrarHorarios(actor, data, id) { return this.agenda.salvarJanela(actor, data, id) }
  alterarAgendamento(actor, id, data, chave) { return this.agenda.reagendar(actor, id, data, chave) }
  alterarStatus(actor, id, status) { return this.agenda.alterarStatus(actor, id, status) }
  async cadastrarServicos(actor, data, id) {
    this.agenda.profissional(actor)
    return await this.store.transaction(async () => {
      const current = id ? (await this.store.servicos()).find(item => item.id === id) : null
      if (id) exigir(current, 'Serviço não encontrado.', 404)
      const service = new Servico({ ...current, ...data })
      if (id) await this.store.sql.prepare('UPDATE servicos SET nome=?,descricao=?,categoria=?,preco_centavos=?,duracao=?,ativo=? WHERE id=?').run(service.nome, service.descricao, service.categoria, centavos(service.preco), service.duracaoMinutos, Number(service.ativo), id)
      else id = Number((await this.store.sql.prepare('INSERT INTO servicos(nome,descricao,categoria,preco_centavos,duracao,ativo) VALUES(?,?,?,?,?,?)').run(service.nome, service.descricao, service.categoria, centavos(service.preco), service.duracaoMinutos, Number(service.ativo))).lastInsertRowid)
      return { ...service, id }
    })
  }
  async gerarRelatorio(actor, inicio, fim) {
    this.agenda.profissional(actor)
    validarData(inicio); validarData(fim)
    exigir(inicio <= fim, 'O início do período não pode ser posterior ao fim.')
    return (await actor.consultarAgenda()).filter(item => item.status === 'CONCLUIDO' && item.dataHora.slice(0, 10) >= inicio && item.dataHora.slice(0, 10) <= fim)
  }
}
