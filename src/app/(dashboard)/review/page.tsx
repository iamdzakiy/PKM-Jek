import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { jakartaDay } from '@/lib/adhd/progress';
import { isoWeekday } from '@/lib/adhd/today';
import { isoWeek } from '@/lib/training/program';
import { savePlan } from '@/app/actions/plan';
import { PageHeader } from '@/components/pkm/page-header';
import { ReviewChecklist } from '@/components/pkm/review-checklist';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review' };

const DAY = 86_400_000;

function PlanForm({ scope, period, value, rows, placeholder }: { scope: string; period: string; value: string; rows: number; placeholder: string }) {
  return (
    <ActionForm action={savePlan} reset={false} className="space-y-2">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="period" value={period} />
      <Textarea name="content" defaultValue={value} rows={rows} placeholder={placeholder} aria-label={placeholder} />
      <SubmitButton variant="secondary" size="sm">
        Simpan
      </SubmitButton>
    </ActionForm>
  );
}

export default async function ReviewPage() {
  const user = await requireUser();
  const ymd = jakartaDay();
  const year = ymd.slice(0, 4);
  const quarter = `${year}-Q${Math.floor((Number(ymd.slice(5, 7)) - 1) / 3) + 1}`;
  const week = `${year}-W${String(isoWeek(ymd)).padStart(2, '0')}`;
  const monday = new Date(new Date(`${ymd}T00:00:00+07:00`).getTime() - (isoWeekday(ymd) - 1) * DAY);

  const [plans, wins, gym, done, inbox] = await Promise.all([
    prisma.planEntry.findMany({ where: { userId: user.id, OR: [{ scope: 'VISION' }, { scope: 'SEASON', period: quarter }, { scope: 'WEEK', period: week }] } }),
    prisma.microWin.count({ where: { userId: user.id, createdAt: { gte: monday } } }),
    prisma.workoutLog.count({ where: { userId: user.id, date: { gte: new Date(`${monday.toISOString().slice(0, 10)}T00:00:00Z`) }, workout: { in: ['A', 'B', 'PUSH', 'PULL', 'LEGS', 'HOME'] } } }),
    prisma.task.count({ where: { userId: user.id, status: 'DONE', lastTouchedAt: { gte: monday } } }),
    prisma.task.count({ where: { userId: user.id, archived: false, status: { not: 'DONE' }, plannedFor: null, dueAt: null, parentId: null } }),
  ]);
  const get = (scope: string) => plans.find((p) => p.scope === scope)?.content ?? '';

  const stats = [
    { label: 'kemenangan', value: wins },
    { label: 'tugas beres', value: done },
    { label: 'sesi gym', value: gym },
    { label: 'di inbox', value: inbox },
  ];

  return (
    <>
      <PageHeader title="Review mingguan" description="30 menit tiap Minggu. Lihat ke atas (vision), ke depan (minggu depan), lalu lepas sisanya." />

      <div className="mb-5 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl px-3 py-3 text-center">
            <p className="font-heading text-2xl font-bold text-ink tabular">{s.value}</p>
            <p className="text-[11px] text-ink-faint">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr,1fr]">
        <div className="space-y-5">
          <Card>
            <CardTitle className="mb-1">Vision</CardTitle>
            <p className="mb-3 text-sm text-ink-soft">Kenapa semua ini? Kamu mau jadi orang seperti apa akhir tahun depan. 3–5 kalimat, jarang diubah.</p>
            <PlanForm scope="VISION" period="" value={get('VISION')} rows={4} placeholder="Mis. Lulus dengan TA yang aku banggain, badan 58 kg dan kuat, IMD dan Digistar jalan tanpa aku burnout…" />
          </Card>
          <Card>
            <CardTitle className="mb-1">Musim ini · {quarter.replace('-', ' ')}</CardTitle>
            <p className="mb-3 text-sm text-ink-soft">Maksimal 3 target untuk 3 bulan. Yang lain boleh nunggu.</p>
            <PlanForm scope="SEASON" period={quarter} value={get('SEASON')} rows={3} placeholder={'1. \n2. \n3. '} />
          </Card>
          <Card>
            <CardTitle className="mb-1">Minggu ini · {week.split('-')[1]}</CardTitle>
            <p className="mb-3 text-sm text-ink-soft">Top 3 minggu ini, plus 2–3 blok deep work 90 menit (TA, proposal, belajar). Pasang bloknya di timeline Hari Ini dengan estimasi &quot;90m deep&quot;.</p>
            <PlanForm scope="WEEK" period={week} value={get('WEEK')} rows={4} placeholder={'Top 3:\n1. \n2. \n3. \nDeep work: Sen 13.00, Rab 13.00'} />
          </Card>
        </div>

        <div className="space-y-5">
          <ReviewChecklist week={week} inbox={inbox} />
          <Card>
            <CardTitle className="mb-2">Cara pakai</CardTitle>
            <ul className="space-y-1.5 text-sm text-ink-soft">
              <li>• Harian: 5 menit pagi di <Link href="/" className="text-brand hover:underline">Hari Ini</Link>, Shutdown jam 18.00 ke atas.</li>
              <li>• Mingguan: halaman ini, Minggu malam.</li>
              <li>• Musiman: ganti 3 target tiap awal kuartal.</li>
              <li>• Catatan yang lama nggak disentuh otomatis turun ke arsip, tapi tetap ketemu lewat Cari (Ctrl K).</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
