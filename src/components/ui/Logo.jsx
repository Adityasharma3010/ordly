export function LogoMark({ className = "size-7" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect
        width="32"
        height="32"
        rx="8"
        fill="var(--c-raised)"
        stroke="var(--c-line)"
      />
      <path
        d="M8.5 17.2l5 5.2L23.8 9.6"
        fill="none"
        stroke="var(--c-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ showName = true }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {showName && (
        <span className="font-serif text-[26px] leading-none tracking-tight">
          Ordly
        </span>
      )}
    </span>
  );
}
