/** The jiramorning mark: a woodcut sun rising over the horizon, like the login page's. */
export function BrandMark({ width = 36, className = "" }: { width?: number; className?: string }) {
  // Cropped to the drawing (the sun sits low in its 32×32 grid) so it reads at wordmark size.
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={Math.round((width * 17) / 30)}
      viewBox="1 9 30 17"
      fill="none"
      className={`brand-mark shrink-0 ${className}`}
    >
      <defs>
        <clipPath id="brand-sky">
          <rect x="0" y="0" width="32" height="24" />
        </clipPath>
      </defs>
      <g clipPath="url(#brand-sky)">
        <circle className="brand-sun" cx="16" cy="24" r="7" fill="var(--accent)" />
      </g>
      <g className="brand-rays" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round">
        <line x1="6.8" y1="21.5" x2="3.4" y2="20.6" />
        <line x1="9.3" y1="17.3" x2="6.8" y2="14.8" />
        <line x1="16" y1="14.5" x2="16" y2="11" />
        <line x1="22.7" y1="17.3" x2="25.2" y2="14.8" />
        <line x1="25.2" y1="21.5" x2="28.6" y2="20.6" />
      </g>
      <line x1="2" y1="24.5" x2="30" y2="24.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + wordmark. The sun rises once when the page loads (off under reduced motion). */
export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className="brand inline-flex items-center gap-2.5">
      <BrandMark width={lg ? 40 : 36} />
      <span
        className={`font-serif font-semibold italic tracking-[-0.02em] ${lg ? "text-[26px]" : "text-2xl"}`}
      >
        jiramorning
      </span>
    </span>
  );
}
