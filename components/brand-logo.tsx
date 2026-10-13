type BrandLogoProps = {
  className?: string;
  light?: boolean;
  compact?: boolean;
};

export function BrandLogo({ className = "", light = false, compact = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo${light ? " brand-logo--light" : ""}${compact ? " brand-logo--compact" : ""}${className ? ` ${className}` : ""}`}>
      <svg className="brand-logo__symbol" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="60" height="60" rx="18" fill="#B9EF59" />
        <path d="M16 20h32M32 20v27" fill="none" stroke="#16383B" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="brand-logo__name">Теңгерім<span className="brand-logo__dot">.</span></span>
    </span>
  );
}
