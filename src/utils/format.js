const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null

export function timeAgo(iso, now = Date.now()) {
  const diff = (new Date(iso).getTime() - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'just now'
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [unit, secs] of units) {
    if (abs >= secs || unit === 'minute') return rtf.format(Math.round(diff / secs), unit)
  }
  return ''
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

export const nowIso = () => new Date().toISOString()

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}
