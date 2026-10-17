export class ConfirmacaoReserva {
  constructor(transport, gerarChave = () => crypto.randomUUID()) {
    this.transport = transport
    this.gerarChave = gerarChave
    this.tentativa = null
  }
  get pendente() { return this.tentativa !== null }
  acaoAposErro(error, editando) {
    if (this.pendente) return 'VERIFICAR'
    if (editando && ['RESERVA_INELEGIVEL', 'RESERVA_SEM_ACESSO', 'RESERVA_NAO_ENCONTRADA'].includes(error.codigo)) return 'ENCERRAR'
    if (error.status === 409 || error.status === 422) return 'REVISAR'
    return 'INFORMAR'
  }
  async enviar(proposta) {
    if (!this.tentativa) this.tentativa = { ...structuredClone(proposta), chave: this.gerarChave() }
    const { path, method, body, chave } = this.tentativa
    try {
      const result = await this.transport(path, { method, body, headers: { 'Idempotency-Key': chave } })
      this.tentativa = null
      return result
    } catch (error) {
      if (error.status >= 400 && error.status < 500) this.tentativa = null
      throw error
    }
  }
}
