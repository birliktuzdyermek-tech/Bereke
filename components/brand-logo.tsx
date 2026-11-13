type BrandLogoProps = {
  className?: string;
  light?: boolean;
  compact?: boolean;
};

export function BrandLogo({ className = "", light = false, compact = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo${light ? " brand-logo--light" : ""}${compact ? " brand-logo--compact" : ""}${className ? ` ${className}` : ""}`}>
      <svg className="brand-logo__symbol" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <defs><linearGradient id="bereke-tile" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse"><stop stopColor="#2F9068" /><stop offset="1" stopColor="#17583C" /></linearGradient></defs>
        <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#bereke-tile)" />
        {/* Balance: one large weight on the left, two smaller ones on the right, level on the fulcrum. */}
        <g transform="translate(0 -5)">
          <path d="M32 40 24.5 54h15z" fill="#fff" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
          <path d="M9 37h46" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <circle cx="18" cy="28" r="7" fill="#fff" />
          <circle cx="40.5" cy="30" r="5" fill="#B8F0D0" />
          <circle cx="50.5" cy="30" r="5" fill="#B8F0D0" />
        </g>
      </svg>
      <span className="brand-logo__name">Теңгерім</span>
    </span>
  );
}
