export class ConfirmacaoReserva {
  constructor(transport, gerarChave = () => crypto.randomUUID()) {
    this.transport = transport
    this.gerarChave = gerarChave
    this.tentativa = null
  }
  get pendente() { return this.tentativa !== null }
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
