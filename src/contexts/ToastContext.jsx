import { createContext, useContext, useCallback, useState, useRef } from 'react'
import './ToastContext.css'

const ToastContext = createContext(null)

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'i',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message, type = 'info', duration = 3500) => {
      counterRef.current += 1
      const id = counterRef.current
      setToasts((prev) => [...prev, { id, message, type }])
      window.setTimeout(() => remove(id), duration)
      return id
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={{ show, remove }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} role="status">
            <span className="toast__icon" aria-hidden="true">{ICONS[t.type] || '•'}</span>
            <span className="toast__message">{t.message}</span>
            <button
              className="toast__close"
              onClick={() => remove(t.id)}
              aria-label="Fechar notificação"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}
