export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-surface" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="h-72 animate-pulse rounded-card border border-line bg-surface" />
        <div className="h-72 animate-pulse rounded-card border border-line bg-surface" />
      </div>
    </div>
  );
}
