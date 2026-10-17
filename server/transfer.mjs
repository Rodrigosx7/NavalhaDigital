import { keyFingerprint } from './postgres.mjs'

export const transferable = {
  usuarios: ['id', 'perfil', 'email_indice', 'dados', 'senha_hash', 'data_cadastro'],
  servicos: ['id', 'nome', 'descricao', 'categoria', 'preco_centavos', 'duracao', 'ativo'],
  disponibilidades: ['id', 'barbeiro_id', 'dia', 'inicio', 'fim', 'intervalo', 'ativo'],
  agendamentos: [
    'id',
    'cliente_id',
    'barbeiro_id',
    'disponibilidade_id',
    'data_hora',
    'status',
    'observacao',
    'data_criacao',
    'data_atualizacao',
    'valor_centavos',
    'duracao',
    'itens',
  ],
}

export async function snapshot(store) {
  return store.transaction(async () => {
    const tabelas = {}
    for (const [table, columns] of Object.entries(transferable))
      tabelas[table] = await store.sql.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY id`).all()
    return { formato: 'navalha-transferencia-1', criadoEm: new Date().toISOString(), chave: keyFingerprint(store.key), tabelas }
  })
}

export async function importSnapshot(store, data) {
  if (!store.postgres) throw new Error('A importação exige destino PostgreSQL.')
  if (data.formato !== 'navalha-transferencia-1' || data.chave !== keyFingerprint(store.key))
    throw new Error('Formato ou chave da origem incompatível. Use a mesma chave original.')
  for (const table of Object.keys(transferable)) if (!Array.isArray(data.tabelas?.[table])) throw new Error('Transferência incompleta.')
  // Authenticate every encrypted field before touching the destination.
  for (const row of data.tabelas.usuarios) {
    const user = store.decode(row.dados)
    if (store.emailIndex(user.email) !== row.email_indice) throw new Error('E-mail cifrado incompatível com o índice da origem.')
  }
  for (const row of data.tabelas.agendamentos) store.decode(row.observacao)
  return store.transaction(async () => {
    for (const table of ['usuarios', 'disponibilidades', 'agendamentos', 'sessoes', 'convites', 'operacoes', 'tentativas']) {
      if (Number((await store.sql.prepare(`SELECT count(*) AS total FROM ${table}`).get()).total))
        throw new Error('Destino já contém dados. A importação exige um banco novo e não sobrescreve cadastros.')
    }
    const services = await store.servicos()
    const seed =
      services.length === 3 &&
      services.every(
        (s, i) =>
          s.id === i + 1 &&
          s.nome === ['Corte', 'Barba', 'Hidratação'][i] &&
          s.descricao === ['Corte tradicional', 'Aparar e finalizar barba', 'Tratamento capilar'][i] &&
          s.categoria === ['CORTE', 'BARBA', 'TRATAMENTO'][i] &&
          s.preco === [40, 25, 20][i] &&
          s.duracaoMinutos === [30, 20, 15][i] &&
          s.ativo,
      )
    if (services.length && !seed) throw new Error('Catálogo de destino já foi alterado. Importação recusada.')
    await store.sql.prepare('DELETE FROM servicos').run()
    const contagens = {}
    for (const [table, columns] of Object.entries(transferable)) {
      for (const row of data.tabelas[table]) {
        if (columns.some((column) => !Object.hasOwn(row, column))) throw new Error('Linha incompleta na transferência.')
        await store.sql
          .prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`)
          .run(...columns.map((column) => row[column]))
      }
      contagens[table] = data.tabelas[table].length
      // Identity RESTART is transactional; setval() survives a rollback and can
      // make an otherwise rejected import break future inserts into the seed.
      const last = (await store.sql.query(`SELECT COALESCE(max(id),0) AS ultimo FROM navalha.${table}`)).rows[0].ultimo
      await store.sql.query(`ALTER TABLE navalha.${table} ALTER COLUMN id RESTART WITH ${Number(last) + 1}`)
    }
    return contagens
  })
}
