import { forwardRef, useId } from 'react'

export const inputCls =
  'w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-fg placeholder:text-faint transition-colors ' +
  'hover:border-line-strong focus:border-accent focus:outline-none disabled:opacity-60'

export const Input = forwardRef(function Input({ label, error, hint, className = '', ...props }, ref) {
  const id = useId()
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-muted">{label}</label>}
      <input id={id} ref={ref} className={inputCls} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} {...props} />
      {hint && !error && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
      {error && <p id={`${id}-e`} role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ label, className = '', ...props }, ref) {
  const id = useId()
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-muted">{label}</label>}
      <textarea id={id} ref={ref} className={`${inputCls} resize-none`} {...props} />
    </div>
  )
})
