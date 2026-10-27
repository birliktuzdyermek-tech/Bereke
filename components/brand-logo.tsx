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
        <path d="M15 18h34M32 18v31" fill="none" stroke="#16383B" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M20 21v12m24-12v12M13 34c1.5 6 4.5 9 7 9s5.5-3 7-9M37 34c1.5 6 4.5 9 7 9s5.5-3 7-9" fill="none" stroke="#16383B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="brand-logo__name">Теңгерім</span>
    </span>
  );
}
