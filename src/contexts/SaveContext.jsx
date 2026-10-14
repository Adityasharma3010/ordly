import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const SaveContext = createContext(null)

/**
 * Every write goes through one serial queue so operations land in the order
 * the user performed them (an item is always inserted before it is edited).
 * Failed operations are kept and can be retried; nothing reports "Saved"
 * unless the server confirmed it.
 */
export function SaveProvider({ children }) {
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState(0)
  const [savedAt, setSavedAt] = useState(null)
  const pendingRef = useRef(0)
  const failedRef = useRef(new Map())
  const queueRef = useRef(Promise.resolve())
  const seq = useRef(0)

  const exec = useCallback((fn, key = `op:${++seq.current}`) => {
    pendingRef.current += 1
    setPending(pendingRef.current)
    const task = queueRef.current.then(async () => {
      try {
        await fn()
        failedRef.current.delete(key)
        setSavedAt(Date.now())
        return true
      } catch (error) {
        console.error('[save failed]', error)
        failedRef.current.set(key, { fn, error })
        return false
      } finally {
        pendingRef.current -= 1
        setPending(pendingRef.current)
        setFailed(failedRef.current.size)
      }
    })
    queueRef.current = task
    return task
  }, [])

  const retry = useCallback(() => {
    const entries = [...failedRef.current.entries()]
    failedRef.current = new Map()
    setFailed(0)
    return Promise.all(entries.map(([key, { fn }]) => exec(fn, key)))
  }, [exec])

  const isBusy = useCallback(() => pendingRef.current > 0 || failedRef.current.size > 0, [])

  // Try again automatically when the connection returns.
  useEffect(() => {
    const onOnline = () => { if (failedRef.current.size) retry() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [retry])

  const status = pending > 0 ? 'saving' : failed > 0 ? 'error' : savedAt ? 'saved' : 'idle'
  const value = useMemo(
    () => ({ status, failedCount: failed, run: exec, retry, isBusy }),
    [status, failed, exec, retry, isBusy],
  )
  return <SaveContext.Provider value={value}>{children}</SaveContext.Provider>
}

export const useSave = () => useContext(SaveContext)
