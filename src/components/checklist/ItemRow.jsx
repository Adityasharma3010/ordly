import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckSquare, GripVertical, MoreHorizontal, NotebookPen, Pencil, Square, Trash2 } from 'lucide-react'
import { Checkbox } from '../ui/Checkbox'
import { Menu } from '../ui/Menu'
import { IconButton } from '../ui/Button'

export function ItemRow({ item, canEdit, dragEnabled, onPatch, onDelete }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id, disabled: !dragEnabled,
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)
  const [showNotes, setShowNotes] = useState(false)
  const inputRef = useRef(null)
  const notesRef = useRef(null)

  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select() } }, [editing])
  useEffect(() => { if (showNotes && !item.notes) notesRef.current?.focus() }, [showNotes]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => { if (!canEdit) return; setDraft(item.text); setEditing(true) }
  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (!next) return setDraft(item.text) // empty edits are ignored; use Delete to remove
    if (next !== item.text) onPatch({ text: next })
  }
  const cancel = () => { setEditing(false); setDraft(item.text) }

  const done = item.has_checkbox && item.completed
  const hasNotes = !!item.notes

  const menuItems = [
    { label: 'Edit text', icon: Pencil, onClick: startEdit },
    { label: hasNotes ? 'Edit notes' : 'Add notes', icon: NotebookPen, onClick: () => setShowNotes(true) },
    { label: item.has_checkbox ? 'Make plain text' : 'Add checkbox', icon: item.has_checkbox ? Square : CheckSquare, onClick: () => onPatch({ has_checkbox: !item.has_checkbox }) },
    { divider: true },
    { label: 'Delete item', icon: Trash2, danger: true, onClick: onDelete },
  ]

  return (
    <motion.li
      ref={setNodeRef}
      layout={dragEnabled ? false : 'position'}
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      style={{ transform: CSS.Translate.toString(transform), transition, overflow: 'clip', overflowClipMargin: 6, zIndex: isDragging ? 20 : undefined, position: 'relative' }}
      className="list-none"
    >
      <div
        className={`group flex items-start gap-2 rounded-xl border px-2 py-2 transition-colors ${
          isDragging ? 'border-accent bg-surface shadow-pop' : 'border-transparent hover:border-line hover:bg-surface/60'
        }`}
      >
        {canEdit && (
          <button
            ref={setActivatorNodeRef} {...attributes} {...(dragEnabled ? listeners : {})}
            disabled={!dragEnabled} aria-label={`Reorder “${item.text}”`}
            title={dragEnabled ? 'Drag to reorder (or focus and press Space, then arrow keys)' : 'Switch sort to Custom order to reorder'}
            className={`mt-0.5 grid size-6 shrink-0 touch-none place-items-center rounded-md text-faint transition ${
              dragEnabled ? 'cursor-grab hover:text-fg active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100' : 'cursor-default opacity-0'
            }`}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}

        <div className="mt-px grid h-6 shrink-0 place-items-center">
          {item.has_checkbox ? (
            <Checkbox checked={item.completed} disabled={!canEdit} onChange={(completed) => onPatch({ completed })} label={`${item.completed ? 'Mark incomplete' : 'Mark complete'}: ${item.text}`} />
          ) : (
            <span className="size-1.5 rounded-full bg-faint" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} maxLength={2000}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } if (e.key === 'Escape') { e.stopPropagation(); cancel() } }}
              aria-label="Edit item text"
              className="w-full rounded-md border border-accent/60 bg-raised px-2 py-0.5 text-[15px] focus:outline-none"
            />
          ) : (
            <p
              onClick={startEdit}
              className={`py-0.5 text-[15px] leading-6 break-words transition-[opacity,color] duration-200 ${canEdit ? 'cursor-text' : ''} ${
                done ? 'text-faint line-through decoration-faint/70 opacity-80' : 'text-fg'
              } ${item.has_checkbox ? '' : 'text-muted'}`}
            >
              {item.text}
              {done && <span className="sr-only"> (completed)</span>}
            </p>
          )}

          {(showNotes || hasNotes) && (
            <div className="mt-1">
              {showNotes && canEdit ? (
                <textarea
                  ref={notesRef} value={item.notes} rows={2} maxLength={10000} aria-label="Item notes"
                  onChange={(e) => onPatch({ notes: e.target.value }, { debounce: true })}
                  onBlur={() => { if (!item.notes) setShowNotes(false) }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowNotes(false) } }}
                  placeholder="Add details…"
                  className="w-full resize-y rounded-md border border-line bg-raised px-2 py-1.5 text-[13px] text-muted placeholder:text-faint focus:border-accent focus:outline-none"
                />
              ) : (
                <button
                  type="button" onClick={() => setShowNotes(true)} disabled={!canEdit}
                  className="block w-full cursor-pointer text-left text-[13px] whitespace-pre-wrap text-faint hover:text-muted disabled:cursor-default"
                >
                  {item.notes}
                </button>
              )}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Menu
              width="w-52"
              trigger={({ ref, props }) => (
                <IconButton ref={ref} size="sm" label={`Actions for “${item.text}”`} {...props}><MoreHorizontal className="size-4" /></IconButton>
              )}
              items={menuItems}
            />
          </div>
        )}
      </div>
    </motion.li>
  )
}
