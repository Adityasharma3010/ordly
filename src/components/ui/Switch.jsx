export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 disabled:opacity-50 ${
        checked ? 'border-accent bg-accent' : 'border-line-strong bg-raised'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 size-4.5 rounded-full shadow transition-transform duration-150 ${
        checked ? 'translate-x-4 bg-on-accent' : 'bg-faint'
      }`} />
    </button>
  )
}
