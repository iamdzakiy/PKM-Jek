import { GRID_CELLS } from '@/lib/adhd/xp';
import { cn } from '@/lib/utils';

/** Kisi 7x4 = 28 hari. Hari yang terisi menyala; hari kosong tetap netral, tanpa tanda silang. */
export function MicroWinGrid({ days }: { days: { label: string; wins: number }[] }) {
  const cells = days.slice(-GRID_CELLS);
  return (
    <div className="grid grid-cols-7 gap-1.5" role="img" aria-label="Kemenangan kecil 28 hari terakhir">
      {cells.map((d, i) => (
        <div
          key={i}
          title={`${d.label}: ${d.wins} kemenangan kecil`}
          className={cn('aspect-square rounded-md transition-colors', d.wins === 0 ? 'bg-surface-2' : d.wins < 3 ? 'bg-mint/40' : d.wins < 6 ? 'bg-mint/70' : 'bg-mint')}
        />
      ))}
    </div>
  );
}
