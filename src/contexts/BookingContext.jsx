import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../services/api.js'

const BookingContext = createContext(null)

export function BookingProvider({ children }) {
  const [catalogo, setCatalogo] = useState({ servicos: [], barbeiros: [], agora: '', fusoHorario: 'America/Sao_Paulo' })
  const [carregando, setCarregando] = useState(true), [erro, setErro] = useState('')
  const atualizarCatalogo = useCallback(async () => {
    try { const result = await api('/catalogo'); setCatalogo(result); setErro(''); return result }
    catch (error) { setErro(error.message); throw error }
    finally { setCarregando(false) }
  }, [])
  useEffect(() => { atualizarCatalogo().catch(() => {}) }, [atualizarCatalogo])
  return <BookingContext.Provider value={{ ...catalogo, carregando, erro, atualizarCatalogo }}>{children}</BookingContext.Provider>
}

export function useBooking() { return useContext(BookingContext) }
