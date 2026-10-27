'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Dumbbell, Footprints, Flower2, Info, RefreshCw, Scale, Timer, TrendingUp } from 'lucide-react';
import { logBody, saveWorkout, syncTrainingHabits } from '@/app/actions/training';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { WEEK_PLAN, WORKOUTS, YOGA_FLOW, nextTarget, weeklyGainRange, type Exercise, type LoggedSet, type WorkoutKey } from '@/lib/training/program';

export interface TrainingData {
  ymd: string;
  weekday: number;
  phase: 'fullbody' | 'ppl';
  weeksIn: number;
  pplReady: boolean;
  suggested: WorkoutKey | null;
  lastByExercise: Record<string, LoggedSet & { date: string }>;
  today: Partial<Record<WorkoutKey, { sets: LoggedSet[]; minutes: number | null; distanceKm: number | null }>>;
  recent: { date: string; workout: WorkoutKey; minutes: number | null; distanceKm: number | null }[];
  body: { date: string; weightKg: number; waistCm: number | null }[];
  scheduleSynced: boolean;
}

const PICKS: Record<'fullbody' | 'ppl', WorkoutKey[]> = {
  fullbody: ['A', 'B', 'HOME', 'RUN', 'YOGA'],
  ppl: ['PUSH', 'PULL', 'LEGS', 'HOME', 'RUN', 'YOGA'],
};

const ICON: Partial<Record<WorkoutKey, typeof Dumbbell>> = { RUN: Footprints, YOGA: Flower2 };

const shortDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

export function TrainingBoard({ data }: { data: TrainingData }) {
  const [selected, setSelected] = useState<WorkoutKey>(data.suggested ?? (data.phase === 'ppl' ? 'PUSH' : 'A'));
  const [showAll, setShowAll] = useState(false);
  const picks = showAll ? (['A', 'B', 'PUSH', 'PULL', 'LEGS', 'HOME', 'RUN', 'YOGA'] as WorkoutKey[]) : PICKS[data.phase];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr,1fr]">
      <div className="min-w-0 space-y-4">
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="tablist" aria-label="Pilih sesi">
          {picks.map((k) => {
            const Icon = ICON[k] ?? Dumbbell;
            const isToday = data.suggested === k;
            const logged = !!data.today[k];
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={selected === k}
                onClick={() => setSelected(k)}
                className={cn(
                  'relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition',
                  selected === k ? 'border-brand-solid bg-brand-solid text-white shadow-sm' : 'glass border-line text-ink-soft hover:text-ink'
                )}
              >
                {logged ? <Check size={15} strokeWidth={3} className={selected === k ? 'text-white' : 'text-ranger'} /> : <Icon size={15} />}
                {WORKOUTS[k].name.replace('Versi rumah 20 menit', 'Rumah')}
                {isToday && <span className={cn('rounded-md px-1.5 text-[10px] font-bold uppercase', selected === k ? 'bg-white/20' : 'bg-ranger/15 text-ranger')}>Hari ini</span>}
              </button>
            );
          })}
          <button type="button" onClick={() => setShowAll((v) => !v)} className="h-10 shrink-0 rounded-xl px-2 text-xs font-medium text-ink-faint hover:text-ink">
            {showAll ? 'Ringkas' : 'Semua'}
          </button>
        </div>

        {data.suggested === null && !data.today[selected] && (
          <p className="glass rounded-2xl px-4 py-3 text-sm text-ink-soft">Hari ini jadwalnya istirahat. Otot tumbuh pas istirahat, jadi ini bagian dari latihan.</p>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={selected} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {selected === 'RUN' ? (
              <CardioCard workout="RUN" initial={data.today.RUN} />
            ) : selected === 'YOGA' ? (
              <CardioCard workout="YOGA" initial={data.today.YOGA} />
            ) : (
              <SessionCard workout={selected} last={data.lastByExercise} initial={data.today[selected]?.sets} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="min-w-0 space-y-4">
        {data.pplReady && (
          <Card className="border-gold/40">
            <p className="text-sm font-semibold text-ink">🚀 Udah {data.weeksIn} minggu Full Body.</p>
            <p className="mt-1 text-sm text-ink-soft">
              Boleh pindah ke PPL kalau goblet squat ±20 kg dan DB bench ±12 kg/tangan udah rapi, dan berat udah naik. Pilih Push di &quot;Semua&quot; dan catat sesi pertama, jadwalnya ikut pindah.
            </p>
          </Card>
        )}
        <BodyCard body={data.body} />
        <WeekCard weekday={data.weekday} phase={data.phase} synced={data.scheduleSynced} />
        {data.recent.length > 0 && (
          <Card>
            <CardTitle className="mb-3">Sesi terakhir</CardTitle>
            <ul className="space-y-1.5 text-sm">
              {data.recent.map((r) => (
                <li key={`${r.date}-${r.workout}`} className="flex items-center justify-between gap-3">
                  <span className="text-ink">{WORKOUTS[r.workout]?.name ?? r.workout}</span>
                  <span className="text-xs text-ink-faint tabular">
                    {r.distanceKm ? `${r.distanceKm} km · ` : ''}
                    {r.minutes ? `${r.minutes} mnt · ` : ''}
                    {shortDate(r.date)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Sesi gym ──────────────────────────────────────────────────────────────

type Draft = Record<string, { weight: string; reps: string[] }>;

function SessionCard({ workout, last, initial }: { workout: WorkoutKey; last: TrainingData['lastByExercise']; initial?: LoggedSet[] }) {
  const plan = WORKOUTS[workout];
  const toast = useToast();
  const [pending, start] = useTransition();
  const [restEnd, setRestEnd] = useState<number | null>(null);

  const targets = useMemo(() => Object.fromEntries(plan.exercises.map((e) => [e.id, nextTarget(e, last[e.id])])), [plan, last]);
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(
      plan.exercises.map((e) => {
        const prev = initial?.find((s) => s.exercise === e.id);
        const w = prev?.weight ?? targets[e.id].weight;
        return [e.id, { weight: w !== null && w !== undefined ? String(w) : '', reps: Array.from({ length: e.sets }, (_, i) => (prev?.reps[i] ? String(prev.reps[i]) : '')) }];
      })
    )
  );

  const filled = plan.exercises.filter((e) => draft[e.id].reps.some(Boolean)).length;

  function setRep(ex: Exercise, i: number, v: string) {
    setDraft((d) => ({ ...d, [ex.id]: { ...d[ex.id], reps: d[ex.id].reps.map((r, j) => (j === i ? v.replace(/\D/g, '').slice(0, 3) : r)) } }));
  }

  function tapSet(ex: Exercise, i: number) {
    if (draft[ex.id].reps[i]) return;
    setRep(ex, i, String(targets[ex.id].reps));
    setRestEnd(Date.now() + ex.restSec * 1000);
  }

  function save() {
    const sets: LoggedSet[] = plan.exercises.map((e) => ({
      exercise: e.id,
      weight: draft[e.id].weight ? Number(draft[e.id].weight.replace(',', '.')) : null,
      reps: draft[e.id].reps.map((r) => Number(r)).filter((r) => r > 0),
    }));
    start(async () => {
      const r = await saveWorkout({ workout, sets, minutes: plan.minutes });
      toast({ kind: r.ok ? 'success' : 'error', message: r.message ?? (r.ok ? 'Tersimpan.' : 'Belum tersimpan.') });
      if (r.ok) setRestEnd(null);
    });
  }

  return (
    <section className="space-y-3" aria-label={plan.name}>
      <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-solid to-[#4A1460] p-5 text-white shadow-lift">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-ranger/40 blur-3xl" />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{plan.minutes} menit · {plan.exercises.length} gerakan</p>
        <h2 className="relative mt-1 font-heading text-2xl font-bold">{plan.name}</h2>
        <p className="relative mt-1 text-sm text-white/80">{plan.warmup}</p>
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <motion.div className="h-full rounded-full bg-ranger" animate={{ width: `${(filled / plan.exercises.length) * 100}%` }} />
        </div>
      </div>

      <ol className="space-y-3">
        {plan.exercises.map((e, idx) => (
          <ExerciseRow key={e.id} n={idx + 1} ex={e} target={targets[e.id]} last={last[e.id]} value={draft[e.id]} onWeight={(v) => setDraft((d) => ({ ...d, [e.id]: { ...d[e.id], weight: v.replace(/[^\d.,]/g, '').slice(0, 6) } }))} onRep={(i, v) => setRep(e, i, v)} onTap={(i) => tapSet(e, i)} />
        ))}
      </ol>

      <div className="sticky bottom-24 z-10 flex items-center gap-2 md:bottom-4">
        <RestTimer end={restEnd} onDone={() => setRestEnd(null)} />
        <button
          type="button"
          onClick={save}
          disabled={pending || filled === 0}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-ranger text-base font-extrabold uppercase tracking-wide text-white shadow-[0_5px_0_rgb(40_110_25)] transition active:translate-y-[3px] active:shadow-[0_2px_0_rgb(40_110_25)] disabled:opacity-50"
        >
          <Check size={20} strokeWidth={3.2} /> {pending ? 'Menyimpan…' : initial ? 'Perbarui sesi' : 'Sesi selesai'}
        </button>
      </div>
    </section>
  );
}

function ExerciseRow({
  n,
  ex,
  target,
  last,
  value,
  onWeight,
  onRep,
  onTap,
}: {
  n: number;
  ex: Exercise;
  target: ReturnType<typeof nextTarget>;
  last?: LoggedSet & { date: string };
  value: { weight: string; reps: string[] };
  onWeight: (v: string) => void;
  onRep: (i: number, v: string) => void;
  onTap: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const unit = ex.unit === 'detik' ? 'dtk' : ex.unit === 'per kaki' ? '/kaki' : 'rep';
  const range = ex.reps[0] === ex.reps[1] ? `${ex.reps[0]}` : `${ex.reps[0]}–${ex.reps[1]}`;
  const done = value.reps.every(Boolean);

  return (
    <li className={cn('glass rounded-card p-4 transition-colors', done && 'ring-1 ring-ranger/50')}>
      <div className="flex items-start gap-3">
        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold', done ? 'bg-ranger text-white' : 'bg-brand-soft text-brand')}>{done ? <Check size={16} strokeWidth={3} /> : n}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-ink">{ex.name}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {ex.sets} × {range} {unit} · istirahat {ex.restSec >= 60 ? `${ex.restSec / 60} mnt` : `${ex.restSec} dtk`}
            {last && <span> · terakhir {last.weight !== null ? `${last.weight} kg ` : ''}{last.reps.join('/')}</span>}
          </p>
          <p className={cn('mt-1 text-xs font-medium', target.hint.startsWith('Naik') ? 'text-warn' : 'text-info')}>{target.hint}</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Cara gerak" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-surface-2 hover:text-ink">
          <ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-11 text-sm leading-relaxed text-ink-soft">
            <span className="block pt-2">{ex.cue}</span>
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-11">
        {!ex.bodyweight && (
          <label className="flex items-center gap-1.5 text-xs text-ink-faint">
            <input inputMode="decimal" value={value.weight} onChange={(e) => onWeight(e.target.value)} placeholder={target.weight !== null ? String(target.weight) : '–'} aria-label={`Beban ${ex.name} (kg)`} className="h-10 w-16 rounded-xl border border-line bg-surface px-2 text-center text-sm font-semibold text-ink tabular" />
            kg
          </label>
        )}
        {value.reps.map((r, i) => (
          <input
            key={i}
            inputMode="numeric"
            value={r}
            onFocus={(e) => {
              const el = e.currentTarget;
              onTap(i);
              requestAnimationFrame(() => el.select());
            }}
            onChange={(e) => onRep(i, e.target.value)}
            placeholder={String(target.reps)}
            aria-label={`Set ${i + 1} ${ex.name}`}
            className={cn('h-10 w-12 rounded-xl border text-center text-sm font-bold tabular transition', r ? 'border-ranger bg-ranger/15 text-ink' : 'border-dashed border-line bg-surface/60 text-ink placeholder:text-ink-faint/60')}
          />
        ))}
      </div>
    </li>
  );
}

function RestTimer({ end, onDone }: { end: number | null; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!end) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [end]);
  useEffect(() => {
    if (end && now >= end) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([120, 80, 120]);
      onDone();
    }
  }, [end, now, onDone]);
  if (!end) return null;
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  return (
    <button type="button" onClick={onDone} title="Lewati istirahat" className="glass flex h-14 items-center gap-1.5 rounded-2xl px-4 text-sm font-bold text-info tabular">
      <Timer size={16} /> {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </button>
  );
}

// ── Lari / Yoga ──────────────────────────────────────────────────────────

function CardioCard({ workout, initial }: { workout: 'RUN' | 'YOGA'; initial?: { minutes: number | null; distanceKm: number | null } }) {
  const plan = WORKOUTS[workout];
  const toast = useToast();
  const [pending, start] = useTransition();
  const [minutes, setMinutes] = useState(String(initial?.minutes ?? plan.minutes));
  const [km, setKm] = useState(initial?.distanceKm ? String(initial.distanceKm) : '');
  const [poses, setPoses] = useState<boolean[]>(() => YOGA_FLOW.map(() => !!initial));

  function save() {
    start(async () => {
      const r = await saveWorkout({ workout, sets: [], minutes: Number(minutes) || plan.minutes, distanceKm: km ? Number(km.replace(',', '.')) : null });
      toast({ kind: r.ok ? 'success' : 'error', message: r.message ?? 'Tersimpan.' });
    });
  }

  return (
    <section className="space-y-3">
      <div className={cn('relative overflow-hidden rounded-card p-5 text-white shadow-lift', workout === 'RUN' ? 'bg-gradient-to-br from-[#0077A8] to-[#004E70]' : 'bg-gradient-to-br from-brand-solid to-[#4A1460]')}>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{plan.minutes} menit</p>
        <h2 className="mt-1 font-heading text-2xl font-bold">{plan.name}</h2>
        <p className="mt-1 text-sm text-white/85">{plan.short}. {plan.warmup}</p>
      </div>

      {workout === 'RUN' ? (
        <Card>
          <ul className="space-y-1.5 text-sm text-ink-soft">
            <li>• Pelan aja, napas masih bisa ngobrol. Tujuannya jantung dan kepala, bukan bakar kalori.</li>
            <li>• Pisah minimal 3 jam dari gym, dan tambah 1 snack hari ini.</li>
            <li>• Lagi capek? Jalan kaki 15 menit tetap dihitung.</li>
          </ul>
        </Card>
      ) : (
        <Card>
          <ul className="space-y-1">
            {YOGA_FLOW.map((p, i) => (
              <li key={p.pose}>
                <button type="button" onClick={() => setPoses((s) => s.map((v, j) => (j === i ? !v : v)))} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2/60">
                  <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full border-2', poses[i] ? 'border-ranger bg-ranger text-white' : 'border-ink-faint/40')}>{poses[i] && <Check size={14} strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm font-medium', poses[i] ? 'text-ink-faint line-through' : 'text-ink')}>{p.pose}</span>
                    <span className="block text-xs text-ink-faint">{p.why}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-ink-faint">{p.dur}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-ink-soft">
          Menit
          <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} className="mt-1 w-24" />
        </label>
        {workout === 'RUN' && (
          <label className="text-xs font-medium text-ink-soft">
            Jarak (km, opsional)
            <Input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} className="mt-1 w-28" />
          </label>
        )}
        <button type="button" onClick={save} disabled={pending} className="ml-auto flex h-12 items-center gap-2 rounded-2xl bg-ranger px-6 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_4px_0_rgb(40_110_25)] transition active:translate-y-[3px] active:shadow-[0_1px_0_rgb(40_110_25)] disabled:opacity-50">
          <Check size={18} strokeWidth={3} /> {initial ? 'Perbarui' : 'Selesai'}
        </button>
      </Card>
    </section>
  );
}

// ── Timbang ──────────────────────────────────────────────────────────────

function BodyCard({ body }: { body: TrainingData['body'] }) {
  const latest = body.at(-1);
  const first = body[0];
  const weeks = latest && first && latest.date !== first.date ? Math.max(1, (Date.parse(latest.date) - Date.parse(first.date)) / (7 * 86_400_000)) : null;
  const perWeek = weeks && latest && first ? Math.round(((latest.weightKg - first.weightKg) / weeks) * 100) / 100 : null;
  const [lo, hi] = weeklyGainRange(latest?.weightKg ?? 50);
  const status = perWeek === null ? null : perWeek < lo ? { text: 'Di bawah target. Tambah 1 shake atau ±300 kkal.', tone: 'text-warn' } : perWeek > hi + 0.05 ? { text: 'Agak cepat. Kurangi ±200 kkal biar nggak banyak lemak.', tone: 'text-warn' } : { text: 'Pas di jalur. Lanjut!', tone: 'text-ranger' };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Scale size={16} className="text-info" /> Timbang mingguan
        </CardTitle>
        {latest && <span className="font-heading text-xl font-bold text-ink tabular">{latest.weightKg} kg</span>}
      </div>
      {body.length > 1 && <Sparkline values={body.map((b) => b.weightKg)} />}
      {perWeek !== null && (
        <p className="mt-2 flex items-center gap-1.5 text-sm">
          <TrendingUp size={14} className="text-ink-faint" />
          <span className="font-semibold text-ink tabular">{perWeek > 0 ? '+' : ''}{perWeek} kg/minggu</span>
          <span className="text-xs text-ink-faint">target {lo}–{hi}</span>
        </p>
      )}
      {status && <p className={cn('mt-1 text-xs font-medium', status.tone)}>{status.text}</p>}
      <ActionForm action={logBody} className="mt-3 flex items-end gap-2">
        <label className="flex-1 text-xs font-medium text-ink-soft">
          Berat (kg)
          <Input name="weightKg" inputMode="decimal" required placeholder={latest ? String(latest.weightKg) : '50'} className="mt-1" />
        </label>
        <label className="w-24 text-xs font-medium text-ink-soft">
          Perut (cm)
          <Input name="waistCm" inputMode="decimal" placeholder="opsional" className="mt-1" />
        </label>
        <SubmitButton>Catat</SubmitButton>
      </ActionForm>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-faint">
        <Info size={12} className="mt-0.5 shrink-0" /> Senin pagi setelah bangun. Lihat tren 4 minggu, bukan angka harian.
      </p>
    </Card>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values) - 0.3;
  const max = Math.max(...values) + 0.3;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / (max - min)) * 32}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label={`Tren berat: ${values.join(', ')} kg`}>
      <polyline points={pts} fill="none" stroke="rgb(var(--ranger))" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Jadwal ──────────────────────────────────────────────────────────────

function WeekCard({ weekday, phase, synced }: { weekday: number; phase: 'fullbody' | 'ppl'; synced: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const gymLabel = phase === 'ppl' ? ['Push', 'Pull', 'Legs'] : ['Full Body', 'Full Body', 'Full Body'];
  let g = 0;
  return (
    <Card>
      <CardTitle className="mb-3">Jadwal minggu ini</CardTitle>
      <ul className="space-y-1 text-sm">
        {WEEK_PLAN.map((d) => {
          const plan = d.plan === 'Gym' ? `Gym ${gymLabel[g++]}` : d.plan;
          return (
            <li key={d.day} className={cn('flex items-center justify-between gap-3 rounded-lg px-2 py-1.5', d.day === weekday && 'bg-brand-soft')}>
              <span className={cn('w-16 shrink-0 font-medium', d.day === weekday ? 'text-brand' : 'text-ink-soft')}>{d.label}</span>
              <span className="flex-1 text-ink">{plan}</span>
              <span className="text-xs text-ink-faint tabular">{d.time}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-faint">Minggu chaos? 2x gym udah cukup. Boleh skip sehari, jangan dua kali berturut-turut.</p>
      {!synced && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await syncTrainingHabits();
              toast({ kind: r.ok ? 'success' : 'error', message: r.message ?? 'Tersimpan.' });
            })
          }
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-info/15 px-3 text-xs font-semibold text-info transition hover:bg-info/25 disabled:opacity-50"
        >
          <RefreshCw size={13} className={pending ? 'animate-spin' : ''} /> Pasang jadwal ini ke Habit & Hari Ini
        </button>
      )}
    </Card>
  );
}
