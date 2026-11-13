type BrandLogoProps = {
  className?: string;
  light?: boolean;
  compact?: boolean;
};

export function BrandLogo({ className = "", light = false, compact = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo${light ? " brand-logo--light" : ""}${compact ? " brand-logo--compact" : ""}${className ? ` ${className}` : ""}`}>
      <svg className="brand-logo__symbol" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        {/* No gradient def: an SVG hidden with display:none (the sidebar on phones) cannot supply url(#id) to a visible copy. */}
        <rect x="2" y="2" width="60" height="60" rx="18" fill="#1E6B4A" />
        <path d="M20 2h24L2 44V20C2 10 10 2 20 2z" fill="#fff" fillOpacity=".1" />
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
