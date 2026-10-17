import { createContext, useContext, useEffect, useState } from 'react'
import { api, setCsrf } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null), [carregando, setCarregando] = useState(true), [erro, setErro] = useState('')
  useEffect(() => {
    let ativo = true
    api('/auth/sessao').then(result => { if (ativo) setUsuario(result.usuario) }).catch(error => { if (ativo) setErro(error.message) }).finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [])
  async function autenticar(path, dados) { const result = await api(path, { method: 'POST', body: dados }); setUsuario(result.usuario); setErro(''); return result.usuario }
  async function sair() { await api('/auth/sair', { method: 'POST', body: {} }); setCsrf(null); setUsuario(null) }
  async function atualizar(dados) { const result = await api('/conta', { method: 'PUT', body: dados }); setUsuario(result.usuario); return result.usuario }
  return <AuthContext.Provider value={{ usuario, carregando, erro, entrar: dados => autenticar('/auth/login', dados), cadastrar: dados => autenticar('/auth/cadastro', dados), sair, atualizar }}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
