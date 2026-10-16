import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '../src/contexts/ToastContext'
import { ShareModal } from '../src/components/sharing/ShareModal'

// ---- In-memory stand-in for the sharing half of the backend ----------------------------
const h = vi.hoisted(() => ({
  db: { share: null, people: [], invites: [] },
  calls: [],
}))

vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', email: 'me@test.dev', name: 'Me' } }),
}))

vi.mock('../src/services/api', () => {
  const log = (name, ...args) => h.calls.push([name, ...args])
  return {
    backendMode: 'supabase',
    api: {
      capabilities: { auth: true, sharing: true, realtime: false },
      listShares: async () => (h.db.share ? [{ ...h.db.share }] : []),
      collaborators: async () => h.db.people.map((p) => ({ ...p })),
      invites: async () => h.db.invites.map((i) => ({ ...i })),
      createShare: async (listId, permission, expiresAt = null) => {
        log('createShare', listId, permission, expiresAt)
        h.db.share = { id: 's1', token: 'tok123', permission, expires_at: expiresAt }
      },
      setSharePermission: async (id, permission) => {
        log('setSharePermission', id, permission)
        h.db.share.permission = permission
      },
      setShareExpiry: async (id, expiresAt) => {
        log('setShareExpiry', id, expiresAt)
        h.db.share.expires_at = expiresAt
      },
      revokeShare: async (id) => {
        log('revokeShare', id)
        h.db.share = null
        h.db.people = h.db.people.filter((p) => !p.via_link)
      },
      inviteByEmail: async (listId, email, role) => {
        log('inviteByEmail', listId, email, role)
        const found = h.db.invites.find((i) => i.email === email)
        if (found) found.role = role
        else h.db.invites.push({ id: `i${h.db.invites.length + 1}`, email, role })
      },
      removeInvite: async (id) => {
        log('removeInvite', id)
        h.db.invites = h.db.invites.filter((i) => i.id !== id)
      },
      setMemberRole: async (listId, userId, role) => {
        log('setMemberRole', listId, userId, role)
        const p = h.db.people.find((x) => x.user_id === userId)
        p.role = role
        p.via_link = false
      },
      removeMember: async (listId, userId) => {
        log('removeMember', listId, userId)
        h.db.people = h.db.people.filter((p) => p.user_id !== userId)
      },
    },
  }
})

const list = { id: 'L1', title: 'Groceries' }
const person = (over = {}) => ({ user_id: 'u1', display_name: 'Priya', role: 'viewer', via_link: false, ...over })
const called = (name) => h.calls.filter(([n]) => n === name)

const mount = async () => {
  const user = userEvent.setup()
  render(<ToastProvider><ShareModal open list={list} onClose={() => {}} /></ToastProvider>)
  await screen.findByText('People with access')
  // The modal moves focus to its first control ~30 ms after opening; wait for that so it
  // can't steal focus from an input in the middle of a test.
  await waitFor(() => expect(screen.getByRole('dialog')).toContainElement(document.activeElement))
  return user
}

beforeEach(() => {
  h.db = { share: null, people: [], invites: [] }
  h.calls = []
})

describe('ShareModal: general access (one link, Google Docs style)', () => {
  it('starts Restricted with no link, then turning it on creates a view link', async () => {
    const user = await mount()
    const access = screen.getByRole('combobox', { name: 'General access' })
    expect(access).toHaveValue('restricted')
    expect(screen.queryByLabelText('Share link')).not.toBeInTheDocument()

    await user.selectOptions(access, 'link')

    expect(await screen.findByLabelText('Share link')).toHaveValue(`${window.location.origin}/s/tok123`)
    expect(called('createShare')).toEqual([['createShare', 'L1', 'view', null]])
    expect(screen.getByRole('combobox', { name: /what people with the link can do/i })).toHaveValue('view')
    expect(screen.getByText(/no account needed/i)).toBeInTheDocument()
  })

  it('switches the same link between Viewer and Editor without making a second link', async () => {
    h.db.share = { id: 's1', token: 'tok123', permission: 'view', expires_at: null }
    const user = await mount()
    await user.selectOptions(screen.getByRole('combobox', { name: /what people with the link can do/i }), 'edit')

    await waitFor(() => expect(screen.getByText(/anyone with the link can edit/i)).toBeInTheDocument())
    expect(called('setSharePermission')).toEqual([['setSharePermission', 's1', 'edit']])
    expect(called('createShare')).toHaveLength(0)
    expect(screen.getByLabelText('Share link')).toHaveValue(`${window.location.origin}/s/tok123`)
  })

  it('sets and clears link expiry', async () => {
    h.db.share = { id: 's1', token: 'tok123', permission: 'view', expires_at: null }
    const user = await mount()
    const before = Date.now()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Link expiry' }), '7')

    await waitFor(() => expect(called('setShareExpiry')).toHaveLength(1))
    const sent = new Date(called('setShareExpiry')[0][2]).getTime()
    expect(sent - before).toBeGreaterThan(6.9 * 86400000)
    expect(sent - before).toBeLessThan(7.1 * 86400000)

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Link expiry' }), 'never')
    await waitFor(() => expect(called('setShareExpiry')).toHaveLength(2))
    expect(called('setShareExpiry')[1]).toEqual(['setShareExpiry', 's1', null])
  })

  it('warns when the link has expired and lets the owner renew it', async () => {
    h.db.share = { id: 's1', token: 'tok123', permission: 'edit', expires_at: new Date(Date.now() - 3600000).toISOString() }
    const user = await mount()
    expect(screen.getByRole('alert')).toHaveTextContent(/this link has expired/i)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Link expiry' }), '30')
    await waitFor(() => expect(screen.queryByText(/this link has expired/i)).not.toBeInTheDocument())
  })

  it('turns the link off straight away when nobody joined through it', async () => {
    h.db.share = { id: 's1', token: 'tok123', permission: 'view', expires_at: null }
    h.db.people = [person({ via_link: false })]
    const user = await mount()
    await user.selectOptions(screen.getByRole('combobox', { name: 'General access' }), 'restricted')

    await waitFor(() => expect(called('revokeShare')).toHaveLength(1))
    expect(screen.queryByText(/turn off the link\?/i)).not.toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: 'General access' })).toHaveValue('restricted')
  })

  it('asks first when people joined through the link, and keeps them if you cancel', async () => {
    h.db.share = { id: 's1', token: 'tok123', permission: 'view', expires_at: null }
    h.db.people = [person({ via_link: true })]
    const user = await mount()
    await user.selectOptions(screen.getByRole('combobox', { name: 'General access' }), 'restricted')

    expect(await screen.findByText(/turn off the link\?/i)).toBeInTheDocument()
    expect(screen.getByText(/1 person who joined through it will lose access/i)).toBeInTheDocument()
    expect(called('revokeShare')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(called('revokeShare')).toHaveLength(0)

    await user.selectOptions(screen.getByRole('combobox', { name: 'General access' }), 'restricted')
    await user.click(await screen.findByRole('button', { name: 'Turn off link' }))
    await waitFor(() => expect(called('revokeShare')).toHaveLength(1))
  })

  it('replacing the link keeps its permission and expiry', async () => {
    const expires = new Date(Date.now() + 5 * 86400000).toISOString()
    h.db.share = { id: 's1', token: 'tok123', permission: 'edit', expires_at: expires }
    const user = await mount()
    await user.click(screen.getByRole('button', { name: /replace link/i }))

    await waitFor(() => expect(called('createShare')).toHaveLength(1))
    expect(called('revokeShare')).toHaveLength(1)
    expect(called('createShare')[0]).toEqual(['createShare', 'L1', 'edit', expires])
  })
})

describe('ShareModal: people and email invites', () => {
  it('adds a person by email (trimmed, lower-cased) with the chosen role, and shows them as Pending', async () => {
    const user = await mount()
    await user.type(screen.getByLabelText('Add people'), '  Bob@Example.COM ')
    await user.selectOptions(screen.getByRole('combobox', { name: /role for the new person/i }), 'editor')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(await screen.findByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(called('inviteByEmail')).toEqual([['inviteByEmail', 'L1', 'bob@example.com', 'editor']])
    expect(screen.getByLabelText('Add people')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Access for bob@example.com' })).toHaveValue('editor')
  })

  it('rejects a malformed email and your own email without calling the backend', async () => {
    const user = await mount()
    await user.type(screen.getByLabelText('Add people'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)

    await user.clear(screen.getByLabelText('Add people'))
    await user.type(screen.getByLabelText('Add people'), 'ME@test.dev')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/your own email/i)
    expect(called('inviteByEmail')).toHaveLength(0)
  })

  it('is honest that no email is sent', async () => {
    await mount()
    expect(screen.getByText(/doesn’t send an email/i)).toBeInTheDocument()
  })

  it('changes a pending invite role and removes an invite', async () => {
    h.db.invites = [{ id: 'i1', email: 'zed@x.com', role: 'viewer' }]
    const user = await mount()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Access for zed@x.com' }), 'editor')
    await waitFor(() => expect(called('inviteByEmail')).toEqual([['inviteByEmail', 'L1', 'zed@x.com', 'editor']]))

    await user.click(await screen.findByRole('button', { name: /remove invite for zed@x.com/i }))
    await waitFor(() => expect(screen.queryByText('zed@x.com')).not.toBeInTheDocument())
    expect(called('removeInvite')).toEqual([['removeInvite', 'i1']])
  })

  it('shows the owner, changes a member role, and removes a member', async () => {
    h.db.people = [person({ via_link: true })]
    const user = await mount()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('via link')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Access for Priya' }), 'editor')
    await waitFor(() => expect(called('setMemberRole')).toEqual([['setMemberRole', 'L1', 'u1', 'editor']]))
    await waitFor(() => expect(screen.queryByText('via link')).not.toBeInTheDocument())

    await user.click(await screen.findByRole('button', { name: /remove priya/i }))
    await waitFor(() => expect(screen.queryByText('Priya')).not.toBeInTheDocument())
    expect(called('removeMember')).toEqual([['removeMember', 'L1', 'u1']])
  })

  it('labels the list Private until something is shared', async () => {
    const user = await mount()
    expect(screen.getByText('Private')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'General access' }), 'link')
    expect(await screen.findByText('Shared')).toBeInTheDocument()
  })
})
