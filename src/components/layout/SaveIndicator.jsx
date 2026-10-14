import { Check, CloudOff, Loader2 } from 'lucide-react'
import { useSave } from '../../contexts/SaveContext'

export function SaveIndicator() {
  const { status, retry } = useSave()
  return (
    <div role="status" aria-live="polite" className="flex h-8 items-center text-[13px]">
      {status === 'saving' && <span className="flex items-center gap-1.5 text-muted"><Loader2 className="size-3.5 animate-spin" aria-hidden />Saving…</span>}
      {status === 'saved' && <span className="flex items-center gap-1.5 text-faint"><Check className="size-3.5 text-ok" aria-hidden />Saved</span>}
      {status === 'error' && (
        <span className="flex items-center gap-2 text-danger">
          <CloudOff className="size-3.5" aria-hidden />Unable to save
          <button onClick={retry} className="cursor-pointer rounded-md bg-danger/10 px-2 py-0.5 font-medium hover:bg-danger/20">Retry</button>
        </span>
      )}
    </div>
  )
}
