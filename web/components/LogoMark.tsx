/** The KeysReady mark (a key with a green "ready" dot), the same as the landing's. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#16171b" />
      <circle cx="22" cy="34" r="9" fill="none" stroke="#f1efe9" strokeWidth="5" />
      <path
        d="M31 34h20M44 34v7M51 34v6"
        fill="none"
        stroke="#f1efe9"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="47" cy="17" r="6" fill="#43d095" />
    </svg>
  );
}
