import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Clock, Copy, Globe, Link2Off, Lock, Mail, RefreshCw, UserMinus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button, IconButton } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { inputCls } from '../ui/Field'
import { Skeleton } from '../ui/Skeleton'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { plural, timeAgo } from '../../utils/format'

const EXPIRY = [
  { key: 'never', label: 'Never expires', days: null },
  { key: '1', label: 'In 1 day', days: 1 },
  { key: '7', label: 'In 7 days', days: 7 },
  { key: '30', label: 'In 30 days', days: 30 },
]
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const selectCls =
  'h-8 cursor-pointer rounded-lg border border-line bg-raised px-2 text-[13px] text-fg transition-colors ' +
  'hover:border-line-strong focus:border-accent focus:outline-none disabled:opacity-60'

const urlFor = (token) => `${window.location.origin}/s/${token}`
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString()

function RoleSelect({ value, onChange, label, disabled }) {
  return (
    <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      <option value="viewer">Can view</option>
      <option value="editor">Can edit</option>
    </select>
  )
}

export function ShareModal({ open, onClose, list }) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [state, setState] = useState({ forList: null, error: '', share: null, people: [], invites: [] })
  const [busy, setBusy] = useState('') // key of the row being changed
  const [copied, setCopied] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [emailError, setEmailError] = useState('')
  const [confirmOff, setConfirmOff] = useState(false)
  const linkInput = useRef(null)

  const load = useCallback(async () => {
    try {
      const [shares, people, invites] = await Promise.all([api.listShares(list.id), api.collaborators(list.id), api.invites(list.id)])
      setState({ forList: list.id, error: '', share: shares[0] || null, people, invites })
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }))
    }
  }, [list.id])

  useEffect(() => { if (open && api.capabilities.sharing) load() }, [open, load])

  const { share, people, invites } = state
  const ready = state.forList === list.id
  const expired = !!share?.expires_at && new Date(share.expires_at) <= new Date()
  const linkPeople = people.filter((p) => p.via_link).length
  const isShared = (!!share && !expired) || people.length > 0 || invites.length > 0

  const run = async (key, fn, okMsg) => {
    setBusy(key)
    try { await fn(); await load(); if (okMsg) toast({ tone: 'success', message: okMsg }) }
    catch (e) { toast({ tone: 'error', message: `Couldn’t update sharing: ${e.message}` }) }
    finally { setBusy('') }
  }

  // ---- general access (the link) ----
  const turnOn = () => run('link', () => api.createShare(list.id, 'view'), 'Link on. Anyone with it can view.')
  const turnOff = () => run('link', () => api.revokeShare(share.id), 'Link turned off. It no longer works.')
  const askTurnOff = () => (linkPeople > 0 ? setConfirmOff(true) : turnOff())
  const changeAccess = (value) => (value === 'link' ? turnOn() : askTurnOff())
  const changePermission = (permission) => run('link', () => api.setSharePermission(share.id, permission),
    permission === 'edit' ? 'Anyone with the link can now edit' : 'Anyone with the link can now view')
  const changeExpiry = (key) => {
    const { days } = EXPIRY.find((o) => o.key === key)
    return run('link', () => api.setShareExpiry(share.id, days == null ? null : inDays(days)),
      days == null ? 'The link no longer expires' : 'Link expiry updated')
  }
  const regenerate = () => run('link', async () => {
    await api.revokeShare(share.id)
    await api.createShare(list.id, share.permission, expired ? null : share.expires_at)
  }, 'New link created. The old one no longer works.')

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = linkInput.current
      try {
        el?.focus(); el?.select()
        if (!document.execCommand('copy')) throw new Error('copy failed')
      } catch {
        toast({ tone: 'error', message: 'Couldn’t copy automatically. The link is selected: press Ctrl/Cmd+C.' })
        el?.select()
        return
      }
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
    toast({ tone: 'success', message: 'Link copied' })
  }

  // ---- people ----
  const invite = async (e) => {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!EMAIL_RE.test(addr)) return setEmailError('Enter a valid email address.')
    if (addr === (user?.email || '').toLowerCase()) return setEmailError('That’s your own email. You already own this list.')
    setEmailError('')
    await run('invite', async () => { await api.inviteByEmail(list.id, addr, inviteRole); setEmail('') },
      `${addr} added. They get access when they sign in with that email.`)
  }
  const roleText = (role) => (role === 'editor' ? 'edit' : 'view')
  const changeRole = (p, role) => run(`p-${p.user_id}`, () => api.setMemberRole(list.id, p.user_id, role),
    `${p.display_name || 'Person'} can now ${roleText(role)}`)
  const removePerson = (p) => run(`p-${p.user_id}`, () => api.removeMember(list.id, p.user_id), `${p.display_name || 'Person'} removed`)
  const changeInviteRole = (inv, role) => run(`i-${inv.id}`, () => api.inviteByEmail(list.id, inv.email, role),
    `${inv.email} can now ${roleText(role)}`)
  const removeInvite = (inv) => run(`i-${inv.id}`, () => api.removeInvite(inv.id), `Invite for ${inv.email} removed`)

  const expiryValue = share?.expires_at ? 'current' : 'never'
  const expiryText = share?.expires_at ? `${expired ? 'Expired' : 'Expires'} ${timeAgo(share.expires_at)}` : ''
  const youName = user?.name || 'You'

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Share “${list.title}”`} size="md"
        description={api.capabilities.sharing ? undefined : 'Sharing needs a Supabase backend.'}>
        {!api.capabilities.sharing ? (
          <div className="mt-3 flex gap-3 rounded-xl border border-line bg-raised p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <div className="space-y-2 text-muted">
              <p>This app is running in local dev mode, so your lists live only in this browser and can’t be shared.</p>
              <p>To enable sharing: create a Supabase project, run <code className="rounded bg-surface px-1">supabase/schema.sql</code>, add the keys to <code className="rounded bg-surface px-1">.env.local</code> and restart. The README walks through it.</p>
            </div>
          </div>
        ) : state.error && !ready ? (
          <div role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm">
            <p className="text-danger">Couldn’t load sharing settings: {state.error}</p>
            <Button className="mt-3" size="sm" onClick={load}>Try again</Button>
          </div>
        ) : !ready ? (
          <div className="mt-3 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        ) : (
          <div className="mt-2 space-y-5">
            <p className="flex items-center gap-2 text-sm text-muted">
              {isShared ? <Globe className="size-4 text-accent" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              <span><b className="font-medium text-fg">{isShared ? 'Shared' : 'Private'}</b>{isShared ? '' : ' · only you can open this list'}</span>
            </p>

            {/* Add people */}
            <form onSubmit={invite} noValidate>
              <label htmlFor="share-email" className="mb-1.5 block text-[13px] font-medium text-muted">Add people</label>
              <div className="flex items-center gap-2">
                <input
                  id="share-email" type="email" value={email} placeholder="name@example.com" autoComplete="off"
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError('') }}
                  aria-invalid={!!emailError} aria-describedby={emailError ? 'share-email-err' : 'share-email-hint'}
                  className={`${inputCls} min-w-0 flex-1`}
                />
                <RoleSelect label="Role for the new person" value={inviteRole} onChange={setInviteRole} />
                <Button type="submit" variant="primary" size="sm" loading={busy === 'invite'} disabled={!email.trim()}>
                  <Mail className="size-3.5" aria-hidden />Add
                </Button>
              </div>
              {emailError
                ? <p id="share-email-err" role="alert" className="mt-1.5 text-xs text-danger">{emailError}</p>
                : <p id="share-email-hint" className="mt-1.5 text-xs text-faint">Ordly doesn’t send an email. Let them know: when they sign in with this address, the list appears under Shared with me.</p>}
            </form>

            {/* People with access */}
            <div>
              <h3 className="mb-2 text-[13px] font-medium text-muted">People with access</h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                <li className="flex items-center gap-3 px-3 py-2">
                  <span className="grid size-7 place-items-center rounded-full bg-raised text-xs font-medium uppercase">{youName[0]}</span>
                  <span className="flex-1 truncate text-sm">{youName} <span className="text-faint">(you)</span></span>
                  <span className="rounded bg-raised px-1.5 py-0.5 text-xs text-muted">Owner</span>
                </li>
                {people.map((p) => (
                  <li key={p.user_id} className="flex items-center gap-3 px-3 py-2">
                    <span className="grid size-7 place-items-center rounded-full bg-raised text-xs font-medium uppercase">{(p.display_name || '?')[0]}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p.display_name || 'Unnamed user'}
                      {p.via_link && <span className="ml-2 text-xs text-faint">via link</span>}
                    </span>
                    <RoleSelect label={`Access for ${p.display_name || 'person'}`} value={p.role} disabled={busy === `p-${p.user_id}`} onChange={(r) => changeRole(p, r)} />
                    <IconButton size="sm" label={`Remove ${p.display_name || 'person'}`} disabled={busy === `p-${p.user_id}`} onClick={() => removePerson(p)}><UserMinus className="size-4" /></IconButton>
                  </li>
                ))}
                {invites.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="grid size-7 place-items-center rounded-full bg-raised text-muted"><Mail className="size-3.5" aria-hidden /></span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {inv.email}
                      <span className="ml-2 rounded bg-raised px-1.5 py-0.5 text-xs text-muted">Pending</span>
                    </span>
                    <RoleSelect label={`Access for ${inv.email}`} value={inv.role} disabled={busy === `i-${inv.id}`} onChange={(r) => changeInviteRole(inv, r)} />
                    <IconButton size="sm" label={`Remove invite for ${inv.email}`} disabled={busy === `i-${inv.id}`} onClick={() => removeInvite(inv)}><UserMinus className="size-4" /></IconButton>
                  </li>
                ))}
              </ul>
            </div>

            {/* General access */}
            <div className="rounded-xl border border-line p-3.5">
              <div className="flex items-start gap-3">
                {share ? <Globe className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />}
                <div className="flex-1">
                  <p className="text-sm font-medium">General access</p>
                  <p className="text-[13px] text-muted">
                    {!share ? 'Only the people above can open this list.'
                      : share.permission === 'edit' ? 'Anyone with the link can edit. They’ll need to sign in first.'
                        : 'Anyone with the link can view. No account needed.'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select aria-label="General access" className={selectCls} disabled={busy === 'link'}
                  value={share ? 'link' : 'restricted'} onChange={(e) => changeAccess(e.target.value)}>
                  <option value="restricted">Restricted</option>
                  <option value="link">Anyone with the link</option>
                </select>
                {share && (
                  <>
                    <select aria-label="What people with the link can do" className={selectCls} disabled={busy === 'link'}
                      value={share.permission} onChange={(e) => changePermission(e.target.value)}>
                      <option value="view">Viewer</option>
                      <option value="edit">Editor</option>
                    </select>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5 text-muted" aria-hidden />
                      <select aria-label="Link expiry" className={selectCls} disabled={busy === 'link'}
                        value={expiryValue} onChange={(e) => changeExpiry(e.target.value)}>
                        {share.expires_at && <option value="current">{expiryText}</option>}
                        {EXPIRY.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    </span>
                  </>
                )}
              </div>

              {share && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    ref={linkInput} readOnly value={urlFor(share.token)} aria-label="Share link"
                    onFocus={(e) => e.target.select()}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-[13px] text-muted focus:border-accent focus:outline-none"
                  />
                  <Button size="sm" onClick={() => copy(urlFor(share.token))}>
                    {copied ? <Check className="size-3.5 text-ok" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <IconButton label="Replace link (old link stops working)" disabled={busy === 'link'} onClick={regenerate}><RefreshCw className="size-4" /></IconButton>
                </div>
              )}
              {share && expired && (
                <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                  This link has expired. Nobody can open it, and people who joined through it are locked out. Pick a new expiry to turn it back on.
                </p>
              )}
            </div>

            <p className="flex items-start gap-2 text-xs text-faint">
              <Link2Off className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Turning the link off, or replacing it, removes everyone who joined through it. People you added by email keep their access.
            </p>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmOff} danger confirmLabel="Turn off link" title="Turn off the link?"
        description={`${plural(linkPeople, 'person')} who joined through it will lose access. People you added by email keep theirs.`}
        onConfirm={turnOff} onClose={() => setConfirmOff(false)}
      />
    </>
  )
}