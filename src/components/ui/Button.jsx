import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap select-none transition duration-150 ' +
  'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none cursor-pointer'

const variants = {
  primary: 'bg-accent text-on-accent hover:brightness-110 shadow-sm',
  secondary: 'bg-raised text-fg border border-line hover:border-line-strong hover:bg-surface',
  ghost: 'text-muted hover:text-fg hover:bg-raised',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
}
const sizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-4 text-sm', lg: 'h-11 px-5 text-[15px]' }

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', loading = false, className = '', children, type = 'button', ...props }, ref,
) {
  return (
    <button ref={ref} type={type} disabled={loading || props.disabled} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export const IconButton = forwardRef(function IconButton(
  { label, size = 'md', active = false, className = '', children, type = 'button', ...props }, ref,
) {
  const dim = size === 'sm' ? 'size-7' : 'size-9'
  return (
    <button
      ref={ref} type={type} aria-label={label} title={label}
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-lg transition duration-150 active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
        active ? 'bg-raised text-fg' : 'text-muted hover:text-fg hover:bg-raised'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})
