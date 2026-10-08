/** Original mark: a buoyant node above a waterline, in the GSIC blue, mint and cream. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#3352CD" />
      <circle cx="16" cy="11.5" r="4.6" fill="#5CE3B6" />
      <path d="M6 20.5c3-2.4 5.2-2.4 8.2 0s5.2 2.4 8.2 0c1.6-1.3 2.7-1.8 3.6-1.9" stroke="#F2F8C9" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 25.5c3-2.4 5.2-2.4 8.2 0s5.2 2.4 8.2 0c1.6-1.3 2.7-1.8 3.6-1.9" stroke="#F2F8C9" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
