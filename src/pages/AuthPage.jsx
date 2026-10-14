import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Link2, MailCheck, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { Logo } from '../components/ui/Logo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Splash } from './NotFound'

// Only allow in-app redirects (blocks open-redirect via ?next=https://evil.example).
export const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null)

const PREVIEW = [
  { t: 'Book the venue', done: true },
  { t: 'Send invitations', done: true },
  { t: 'Order the cake', done: false },
  { t: 'Notes: dietary needs → see Priya’s message', plain: true },
]

function Preview() {
  return (
    <div aria-hidden className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-pop">
      <p className="font-serif text-2xl">🎉 Party planning</p>
      <div className="mt-3 h-1.5 rounded-full bg-raised"><motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: '66%' }} transition={{ delay: 0.6, duration: 1.2, ease: 'easeOut' }} /></div>
      <ul className="mt-4 space-y-3">
        {PREVIEW.map((r, i) => (
          <motion.li key={r.t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.12 }} className="flex items-center gap-3 text-[15px]">
            {r.plain ? <span className="mx-2 size-1.5 rounded-full bg-faint" /> : (
              <span className={`grid size-[22px] place-items-center rounded-md border-[1.5px] ${r.done ? 'border-accent bg-accent/15' : 'border-line-strong'}`}>
                {r.done && <svg viewBox="0 0 24 24" className="size-4" fill="none"><motion.path d="M4.5 12.8l4.6 4.7L19.8 5.6" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5 + i * 0.3, duration: 0.4 }} /></svg>}
              </span>
            )}
            <span className={r.done ? 'text-faint line-through' : r.plain ? 'text-sm text-muted' : ''}>{r.t}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

const friendly = (msg = '') => {
  if (/invalid login/i.test(msg)) return 'That email and password don’t match.'
  if (/already registered|already been registered/i.test(msg)) return 'An account with this email already exists. Try signing in.'
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.'
  if (/fetch|network/i.test(msg)) return 'Can’t reach the server. Check your connection and try again.'
  return msg || 'Something went wrong. Please try again.'
}

export default function AuthPage({ initialMode = 'signin' }) {
  const { user, status, signIn, signUp, sessionExpired } = useAuth()
  const [params] = useSearchParams()
  const [mode, setMode] = useState(initialMode) // signin | signup | forgot
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // { kind: 'confirm' | 'reset', email }
  const next = safeNext(params.get('next'))

  if (!api.capabilities.auth) return <Navigate to="/app" replace />
  if (status === 'loading') return <Splash />
  if (user) return <Navigate to={next || '/app'} replace />

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError('') }

  const submit = async (e) => {
    e.preventDefault()
    const email = form.email.trim()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    if (mode !== 'forgot' && form.password.length < 8) return setError('Use at least 8 characters for your password.')
    setBusy(true); setError('')
    try {
      if (mode === 'signin') await signIn({ email, password: form.password })
      else if (mode === 'signup') {
        const res = await signUp({ email, password: form.password, name: form.name.trim() })
        if (res.needsConfirmation) setDone({ kind: 'confirm', email })
      } else {
        await api.sendPasswordReset(email)
        setDone({ kind: 'reset', email })
      }
    } catch (err) { setError(friendly(err.message)) }
    finally { setBusy(false) }
  }

  const switchTo = (m) => { setMode(m); setError(''); setDone(null) }
  const copy = { signin: ['Welcome back', 'Sign in'], signup: ['Create your account', 'Create account'], forgot: ['Reset your password', 'Send reset link'] }[mode]

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface/40 p-12 lg:flex">
        <Logo />
        <div className="max-w-lg">
          <h1 className="font-serif text-6xl leading-[1.02] tracking-tight">Lists that <em className="text-accent">stay put.</em></h1>
          <p className="mt-5 max-w-md text-lg text-muted">Checklists you can trust: saved the instant you tick them, available on every device, and shareable with one link.</p>
          <ul className="mt-8 space-y-3 text-[15px] text-muted">
            <li className="flex items-center gap-3"><Sparkles className="size-4 text-accent" aria-hidden />Tasks with checkboxes, or plain notes, in the same list</li>
            <li className="flex items-center gap-3"><Link2 className="size-4 text-accent" aria-hidden />View-only or editable share links you can revoke</li>
            <li className="flex items-center gap-3"><ShieldCheck className="size-4 text-accent" aria-hidden />Private by default, enforced in the database</li>
          </ul>
        </div>
        <Preview />
      </section>

      <main className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo /></div>
          {sessionExpired && !done && <p role="status" className="mb-5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-[13px]">Your session ended. Please sign in again.</p>}
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status">
                <MailCheck className="mb-4 size-8 text-accent" aria-hidden />
                <h2 className="font-serif text-4xl">Check your inbox</h2>
                <p className="mt-2 text-muted">
                  {done.kind === 'confirm' ? 'We sent a confirmation link to ' : 'If an account exists for '}<b className="text-fg">{done.email}</b>
                  {done.kind === 'confirm' ? '. Open it to finish creating your account, then sign in.' : ', a password reset link is on its way.'}
                </p>
                <Button className="mt-6" onClick={() => switchTo('signin')}>Back to sign in</Button>
              </motion.div>
            ) : (
              <motion.form key={mode} onSubmit={submit} noValidate initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <h2 className="font-serif text-4xl">{copy[0]}</h2>
                <p className="mt-1.5 mb-7 text-sm text-muted">
                  {mode === 'forgot' ? 'Enter your email and we’ll send you a link.' : next?.startsWith('/s/') ? 'Sign in to open the list that was shared with you.' : 'Your lists, saved and synced.'}
                </p>
                <div className="space-y-4">
                  {mode === 'signup' && <Input label="Name" value={form.name} onChange={set('name')} autoComplete="name" placeholder="What should we call you?" />}
                  <Input label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" autoFocus />
                  {mode !== 'forgot' && (
                    <Input label="Password" type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} hint={mode === 'signup' ? 'At least 8 characters.' : undefined} />
                  )}
                </div>
                {error && <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
                <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-6 w-full">{copy[1]}</Button>
                <div className="mt-5 flex items-center justify-between text-[13px] text-muted">
                  {mode === 'signin' && <><button type="button" className="cursor-pointer hover:text-fg" onClick={() => switchTo('forgot')}>Forgot password?</button><button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => switchTo('signup')}>Create an account</button></>}
                  {mode === 'signup' && <button type="button" className="cursor-pointer hover:text-fg" onClick={() => switchTo('signin')}>Already have an account? <span className="text-accent">Sign in</span></button>}
                  {mode === 'forgot' && <button type="button" className="cursor-pointer hover:text-fg" onClick={() => switchTo('signin')}>← Back to sign in</button>}
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
