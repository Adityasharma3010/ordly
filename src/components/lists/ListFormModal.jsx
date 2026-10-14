import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Field'
import { ACCENT_KEYS, ACCENTS, EMOJI_CHOICES } from '../../utils/appearance'

// Used for both "New list" and "Edit details". The modal only mounts its body while
// open, so the form state starts fresh from `list` every time it opens.
export function ListFormModal({ open, onClose, onSubmit, list }) {
  const titleRef = useRef(null)
  return (
    <Modal open={open} onClose={onClose} title={list ? 'Edit list details' : 'New list'} initialFocus={titleRef}>
      <ListForm list={list} onClose={onClose} onSubmit={onSubmit} titleRef={titleRef} />
    </Modal>
  )
}

function ListForm({ list, onClose, onSubmit, titleRef }) {
  const editing = !!list
  const [title, setTitle] = useState(list?.title ?? '')
  const [description, setDescription] = useState(list?.description ?? '')
  const [icon, setIcon] = useState(list?.icon ?? '')
  const [color, setColor] = useState(list?.color ?? 'amber')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('Give your list a name.'); titleRef.current?.focus(); return }
    onSubmit({ title: title.trim(), description: description.trim(), icon, color })
    onClose()
  }

  return (
      <form onSubmit={submit} className="mt-2 space-y-4">
        <Input ref={titleRef} label="Name" value={title} maxLength={200} placeholder="Weekend trip packing" error={error}
          onChange={(e) => { setTitle(e.target.value); setError('') }} />
        <Textarea label="Description (optional)" rows={2} maxLength={2000} value={description} placeholder="What is this list for?"
          onChange={(e) => setDescription(e.target.value)} />

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-muted">Icon (optional)</legend>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e} type="button" aria-label={`Use ${e} icon`} aria-pressed={icon === e} onClick={() => setIcon(icon === e ? '' : e)}
                className={`grid size-9 cursor-pointer place-items-center rounded-lg border text-lg transition ${icon === e ? 'border-accent bg-accent/15' : 'border-line bg-raised hover:border-line-strong'}`}
              >{e}</button>
            ))}
          </div>
          <input
            aria-label="Or type your own emoji" value={icon} onChange={(e) => setIcon([...e.target.value].slice(0, 2).join(''))} placeholder="…or type your own"
            className="mt-2 h-9 w-44 rounded-lg border border-line bg-raised px-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-muted">Accent colour</legend>
          <div className="flex flex-wrap gap-2">
            {ACCENT_KEYS.map((k) => (
              <button
                key={k} type="button" aria-label={`${k} accent`} aria-pressed={color === k} onClick={() => setColor(k)}
                className="grid size-8 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface transition active:scale-90"
                style={{ background: ACCENTS[k], boxShadow: color === k ? `0 0 0 2px var(--c-surface), 0 0 0 4px ${ACCENTS[k]}` : 'none' }}
              >
                {color === k && <Check className="size-4 text-black/70" aria-hidden />}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{editing ? 'Save changes' : 'Create list'}</Button>
        </div>
      </form>
  )
}
