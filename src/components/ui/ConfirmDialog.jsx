import { useRef, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }) {
  const cancelRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm" initialFocus={cancelRef}>
      <div className="mt-4 flex justify-end gap-2">
        <Button ref={cancelRef} onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={go}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
