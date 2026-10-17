import { DatabaseSync, backup } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { carregarChave, cifrar, decifrar, indiceEmail } from './security.mjs'

export class Store {
  constructor(databasePath, keyPath) {
    this.key = carregarChave(keyPath, existsSync(databasePath))
    mkdirSync(dirname(databasePath), { recursive: true })
    this.db = new DatabaseSync(databasePath)
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS usuarios(id INTEGER PRIMARY KEY, perfil TEXT NOT NULL CHECK(perfil IN ('CLIENTE','BARBEIRO')), email_indice TEXT NOT NULL UNIQUE, dados TEXT NOT NULL, senha_hash TEXT NOT NULL, data_cadastro TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessoes(token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id), csrf TEXT NOT NULL, expira INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS convites(email_indice TEXT NOT NULL, segredo_hash TEXT PRIMARY KEY, expira INTEGER NOT NULL, utilizado INTEGER NOT NULL DEFAULT 0 CHECK(utilizado IN (0,1)));
      CREATE TABLE IF NOT EXISTS servicos(id INTEGER PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL, categoria TEXT NOT NULL CHECK(categoria IN ('CORTE','BARBA','TRATAMENTO','OUTRO')), preco_centavos INTEGER NOT NULL CHECK(preco_centavos>=0), duracao INTEGER NOT NULL CHECK(duracao>0), ativo INTEGER NOT NULL CHECK(ativo IN (0,1)));
      CREATE TABLE IF NOT EXISTS disponibilidades(id INTEGER PRIMARY KEY, barbeiro_id INTEGER NOT NULL REFERENCES usuarios(id), dia TEXT NOT NULL, inicio TEXT NOT NULL, fim TEXT NOT NULL, intervalo INTEGER NOT NULL CHECK(intervalo>0), ativo INTEGER NOT NULL CHECK(ativo IN (0,1)));
      CREATE TABLE IF NOT EXISTS agendamentos(id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES usuarios(id), barbeiro_id INTEGER NOT NULL REFERENCES usuarios(id), disponibilidade_id INTEGER NOT NULL REFERENCES disponibilidades(id), data_hora TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('PENDENTE','CONCLUIDO','NAO_COMPARECEU','CANCELADO')), observacao TEXT NOT NULL, data_criacao TEXT NOT NULL, data_atualizacao TEXT NOT NULL, valor_centavos INTEGER NOT NULL CHECK(valor_centavos>=0), duracao INTEGER NOT NULL CHECK(duracao>0), itens TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS reservas_barbeiro_data ON agendamentos(barbeiro_id,data_hora);
      CREATE INDEX IF NOT EXISTS reservas_cliente ON agendamentos(cliente_id,data_hora);
      CREATE INDEX IF NOT EXISTS janelas_barbeiro ON disponibilidades(barbeiro_id,dia);
      CREATE TABLE IF NOT EXISTS operacoes(chave TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id), agendamento_id INTEGER NOT NULL REFERENCES agendamentos(id), assinatura TEXT NOT NULL);
      PRAGMA user_version=1;`)
    if (!this.db.prepare('SELECT count(*) AS total FROM servicos').get().total) {
      this.transaction(() => {
        const insert = this.db.prepare('INSERT INTO servicos(nome,descricao,categoria,preco_centavos,duracao,ativo) VALUES(?,?,?,?,?,1)')
        insert.run('Corte', 'Corte tradicional', 'CORTE', 4000, 30)
        insert.run('Barba', 'Aparar e finalizar barba', 'BARBA', 2500, 20)
        insert.run('Hidratação', 'Tratamento capilar', 'TRATAMENTO', 2000, 15)
      })
    }
  }
  transaction(operation) {
    this.db.exec('BEGIN IMMEDIATE')
    try { const result = operation(); this.db.exec('COMMIT'); return result } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  encode(data) { return cifrar(data, this.key) }
  decode(data) { return decifrar(data, this.key) }
  emailIndex(email) { return indiceEmail(email, this.key) }
  usuario(row) { return row ? { ...this.decode(row.dados), id: row.id, perfil: row.perfil, dataCadastro: row.data_cadastro } : null }
  getUsuario(id) { return this.usuario(this.db.prepare('SELECT * FROM usuarios WHERE id=?').get(id)) }
  servico(row) { return row ? { id: row.id, nome: row.nome, descricao: row.descricao, categoria: row.categoria, preco: row.preco_centavos / 100, duracaoMinutos: row.duracao, ativo: Boolean(row.ativo) } : null }
  servicos() { return this.db.prepare('SELECT * FROM servicos ORDER BY id').all().map(row => this.servico(row)) }
  janela(row) { return row ? { id: row.id, barbeiroId: row.barbeiro_id, diaSemana: row.dia, horaInicio: row.inicio, horaFim: row.fim, intervaloMinutos: row.intervalo, ativo: Boolean(row.ativo) } : null }
  janelas(barbeiroId) { return this.db.prepare('SELECT * FROM disponibilidades WHERE barbeiro_id=? ORDER BY dia,inicio').all(barbeiroId).map(row => this.janela(row)) }
  reserva(row) {
    if (!row) return null
    const cliente = this.getUsuario(row.cliente_id), barbeiro = this.getUsuario(row.barbeiro_id)
    return { id: row.id, clienteId: row.cliente_id, barbeiroId: row.barbeiro_id, disponibilidadeId: row.disponibilidade_id, cliente: { id: cliente.id, nome: cliente.nome }, barbeiro: { id: barbeiro.id, nome: barbeiro.nome }, dataHora: row.data_hora, status: row.status, observacao: this.decode(row.observacao), dataCriacao: row.data_criacao, dataAtualizacao: row.data_atualizacao, valorTotal: row.valor_centavos / 100, duracaoTotalMinutos: row.duracao, servicos: JSON.parse(row.itens) }
  }
  getReserva(id) { return this.reserva(this.db.prepare('SELECT * FROM agendamentos WHERE id=?').get(id)) }
  reservas(barbeiroId) { return this.db.prepare('SELECT * FROM agendamentos WHERE barbeiro_id=? ORDER BY data_hora').all(barbeiroId).map(row => this.reserva(row)) }
  async backup(path) {
    mkdirSync(dirname(path), { recursive: true })
    const temporary = path + '.sqlite-tmp'
    try { await backup(this.db, temporary); writeFileSync(path, this.encode({ formato: 'navalha-backup-1', database: readFileSync(temporary).toString('base64') }), { flag: 'wx', mode: 0o600 }) } finally { if (existsSync(temporary)) unlinkSync(temporary) }
  }
  close() { this.db.close() }
}
