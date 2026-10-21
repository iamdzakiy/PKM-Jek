import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { PageHeader } from '@/components/pkm/page-header';
import { MicroWinGrid } from '@/components/pkm/micro-wins';
import { Card, CardTitle } from '@/components/ui/card';
import { levelFromXp, xpForLevel } from '@/lib/adhd/xp';
import { jakartaDay } from '@/lib/adhd/progress';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Progres' };

export default async function ProgressPage() {
  const user = await requireUser();
  const since = new Date(Date.now() - 28 * 86_400_000);
  const [progress, wins] = await Promise.all([
    prisma.userProgress.findUnique({ where: { userId: user.id } }),
    prisma.microWin.findMany({ where: { userId: user.id, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' } }),
  ]);

  const xp = progress?.xp ?? 0;
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = Math.min(100, Math.round(((xp - base) / Math.max(1, next - base)) * 100));

  const perDay = new Map<string, number>();
  for (const w of wins) perDay.set(jakartaDay(w.createdAt), (perDay.get(jakartaDay(w.createdAt)) ?? 0) + 1);
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * 86_400_000);
    const key = jakartaDay(d);
    return { label: key, wins: perDay.get(key) ?? 0 };
  });

  return (
    <>
      <PageHeader title="Progres" description="Yang kamu lakukan tetap tercatat. Angka di sini hanya naik, tidak pernah turun." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardTitle className="mb-3">Level {level}</CardTitle>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand-solid transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-soft">{xp} XP · {next - xp} lagi ke level {level + 1}</p>
          <p className="mt-4 text-sm text-ink-soft">Rangkaian hari: <span className="font-semibold text-ink">{progress?.streakDays ?? 0}</span>. Libur sehari dua hari tidak memutusnya.</p>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle className="mb-4">28 hari terakhir</CardTitle>
          <MicroWinGrid days={days} />
        </Card>
        <Card className="lg:col-span-3">
          <CardTitle className="mb-4">Kemenangan kecil terbaru</CardTitle>
          <ul className="space-y-1.5">
            {wins.slice(0, 12).map((w) => (
              <li key={w.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{w.label}</span>
                <span className="text-xs text-mint">+{w.xp} XP</span>
              </li>
            ))}
            {wins.length === 0 && <li className="text-sm text-ink-soft">Mulai dari satu langkah kecil. Itu sudah dihitung.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
