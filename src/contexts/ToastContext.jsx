import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Toaster } from '../components/ui/Toaster'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const seq = useRef(0)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // toast({ message, tone: 'success'|'error'|'info', action: { label, onClick }, duration })
  const toast = useCallback((t) => {
    const id = ++seq.current
    const duration = t.duration ?? (t.tone === 'error' ? 8000 : 4500)
    setToasts((list) => [...list.slice(-3), { tone: 'info', ...t, id }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
