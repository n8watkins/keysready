export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" className="fill-ink" />
      <circle cx="22" cy="34" r="9" fill="none" className="stroke-bg" strokeWidth="5" />
      <path d="M31 34h20M44 34v7M51 34v6" fill="none" className="stroke-bg" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="17" r="6" fill="#43d095" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-lg font-extrabold tracking-tight ${className}`}>
      <LogoMark />
      KeysReady
    </span>
  );
}
