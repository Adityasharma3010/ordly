import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Menu as MenuIcon, Moon, Search, Share2, Sun, X } from 'lucide-react'
import { IconButton, Button } from '../ui/Button'
import { SaveIndicator } from './SaveIndicator'
import { UserMenu } from './UserMenu'
import { useTheme } from '../../contexts/ThemeContext'
import { searchWorkspace } from '../../utils/listStats'
import { accentHex } from '../../utils/appearance'

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

export function Header({ lists, onOpenList, onOpenMenu, onShare, canShare }) {
  const { theme, toggle } = useTheme()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const wrapRef = useRef(null)
  const results = useMemo(() => searchWorkspace(lists, query), [lists, query])

  // "/" (or Ctrl/Cmd+K) focuses search, but never while typing in another field.
  useEffect(() => {
    const onKey = (e) => {
      const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(document.activeElement)
      const k = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)
      if (slash || k) { e.preventDefault(); inputRef.current?.focus(); setOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const go = (listId, q) => { setOpen(false); setQuery(''); inputRef.current?.blur(); onOpenList(listId, q) }

  const onKeyDown = (e) => {
    const btns = [...(wrapRef.current?.querySelectorAll('[data-result]') || [])]
    const i = btns.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); (btns[i + 1] || btns[0])?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? inputRef.current : btns[i - 1])?.focus() }
    else if (e.key === 'Escape') { setOpen(false); if (query) setQuery(''); else inputRef.current?.blur() }
    else if (e.key === 'Enter' && document.activeElement === inputRef.current && results[0]) go(results[0].list.id, results[0].itemHits.length && !results[0].titleHit ? query : '')
  }

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/80 px-3 backdrop-blur sm:px-5">
      <IconButton label="Open navigation" className="lg:hidden" onClick={onOpenMenu}><MenuIcon className="size-5" /></IconButton>

      <div ref={wrapRef} onKeyDown={onKeyDown} className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input
          ref={inputRef} value={query} role="combobox" aria-expanded={open && !!query} aria-controls="global-search-results" aria-label="Search lists and items"
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Search lists and items"
          className="h-9 w-full rounded-lg border border-line bg-surface pr-12 pl-9 text-sm placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none"
        />
        {query ? (
          <button aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus() }} className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-faint hover:text-fg"><X className="size-3.5" /></button>
        ) : (
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line bg-raised px-1.5 text-[11px] text-faint sm:block">/</kbd>
        )}

        <AnimatePresence>
          {open && query.trim() && (
            <motion.div
              id="global-search-results" role="listbox"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
              className="scroll-thin absolute top-full right-0 left-0 z-40 mt-1.5 max-h-[60dvh] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-pop"
            >
              {results.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted">No lists or items match “{query.trim()}”.</p>
              ) : results.slice(0, 8).map((r) => (
                <button
                  key={r.list.id} data-result role="option" onClick={() => go(r.list.id, r.itemHits.length && !r.titleHit ? query : '')}
                  className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-colors hover:bg-raised focus:bg-raised focus:outline-none"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span style={{ color: accentHex(r.list.color) }}>{r.list.icon || '●'}</span>
                    <span className="truncate">{r.list.title}</span>
                    {r.list.archived && <span className="rounded bg-raised px-1.5 text-[11px] font-normal text-faint">Archived</span>}
                  </span>
                  {r.itemHits.map((i) => <span key={i.id} className="mt-0.5 block truncate pl-6 text-[13px] text-muted">{i.text}</span>)}
                  {r.itemHitCount > r.itemHits.length && <span className="block pl-6 text-xs text-faint">+{r.itemHitCount - r.itemHits.length} more matches</span>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden sm:block"><SaveIndicator /></div>
        {canShare && <Button size="sm" className="hidden sm:inline-flex" onClick={onShare}><Share2 className="size-3.5" aria-hidden />Share</Button>}
        <IconButton label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggle}>
          {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </IconButton>
        <UserMenu />
      </div>
    </div>
  )
}
