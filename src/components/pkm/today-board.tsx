'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CalendarDays, Check, ChevronDown, Flame, Inbox, Moon, Plus, Sparkles, Sun, Sunrise, Sunset, Zap } from 'lucide-react';
import { addTodayTask, closeDay, installStarterPack, planTask, setTodayEnergy, toggleHabitToday, toggleTaskDone } from '@/app/actions/today';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { EASE } from '@/components/motion/primitives';
import { hhmm, jakartaMinutes, WEEKDAY_SHORT, type HabitHeat } from '@/lib/adhd/today';
import { cn, formatDate } from '@/lib/utils';

export interface TodayItem {
  key: string;
  kind: 'habit' | 'task' | 'event';
  id: string;
  title: string;
  /** menit sejak 00:00 WIB; null = kapan saja hari ini */
  minute: number | null;
  done: boolean;
  sub: string | null;
  heat: HabitHeat;
  heatLabel: string | null;
  overdue: boolean;
  sortHeat: number;
}

export interface TodayData {
  greeting: string;
  name: string;
  dateLabel: string;
  energy: number | null;
  closed: boolean;
  items: TodayItem[];
  inbox: { id: string; title: string }[];
  upcoming: { id: string; title: string; dueAt: string }[];
  laterChores: { name: string; label: string }[];
  habitCount: number;
  streak: number;
  xp: number;
  level: number;
  levelFloor: number;
  levelCeil: number;
  week: { ymd: string; active: boolean; isToday: boolean }[];
}

const SECTIONS = [
  { key: 'pagi', label: 'Pagi', icon: Sunrise, from: 0, to: 12 * 60 },
  { key: 'siang', label: 'Siang', icon: Sun, from: 12 * 60, to: 15 * 60 },
  { key: 'sore', label: 'Sore', icon: Sunset, from: 15 * 60, to: 18 * 60 },
  { key: 'malam', label: 'Malam', icon: Moon, from: 18 * 60, to: 24 * 60 },
] as const;

const ENERGY = [
  { value: 1, emoji: '🪫', label: 'Habis', hint: 'Versi mini aja' },
  { value: 2, emoji: '😐', label: 'Biasa', hint: 'Jalan pelan' },
  { value: 3, emoji: '🔋', label: 'Penuh', hint: 'Gas fokus' },
] as const;

/** Menit WIB sekarang, diperbarui tiap menit supaya "Sekarang" ikut bergeser. */
function useNowMinute() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(jakartaMinutes(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function TodayBoard({ data }: { data: TodayData }) {
  const router = useRouter();
  const toast = useToast();
  const nowMin = useNowMinute();
  const [, startTransition] = useTransition();
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [energy, setEnergy] = useState<number | null>(data.energy);
  const [burst, setBurst] = useState<string | null>(null);

  // Server data menang setelah refresh; state lokal hanya untuk respons instan.
  useEffect(() => setDoneMap({}), [data.items]);
  useEffect(() => setEnergy(data.energy), [data.energy]);

  const low = energy === 1;
  const items = useMemo(() => data.items.map((i) => ({ ...i, done: doneMap[i.key] ?? i.done })), [data.items, doneMap]);
  const checkable = items.filter((i) => i.kind !== 'event');
  const doneCount = checkable.filter((i) => i.done).length;
  const total = checkable.length;
  const allDone = total > 0 && doneCount === total;

  const timed = items.filter((i) => i.minute !== null).sort((a, b) => a.minute! - b.minute! || a.sortHeat - b.sortHeat);
  const anytime = items.filter((i) => i.minute === null).sort((a, b) => Number(a.done) - Number(b.done) || a.sortHeat - b.sortHeat);

  // "Sekarang": yang belum selesai, jamnya paling dekat (maks. 2 jam lalu), lalu yang paling mendesak tanpa jam.
  const next = useMemo(() => {
    if (nowMin === null) return null;
    const open = items.filter((i) => !i.done && i.kind !== 'event');
    const soon = open.filter((i) => i.minute !== null && i.minute >= nowMin - 120).sort((a, b) => a.minute! - b.minute!)[0];
    return soon ?? open.filter((i) => i.minute === null).sort((a, b) => a.sortHeat - b.sortHeat)[0] ?? null;
  }, [items, nowMin]);

  async function toggle(item: TodayItem, mini = false) {
    const nextDone = !item.done;
    setDoneMap((m) => ({ ...m, [item.key]: nextDone }));
    if (nextDone) {
      setBurst(item.key);
      window.setTimeout(() => setBurst((b) => (b === item.key ? null : b)), 900);
    }
    try {
      const r = item.kind === 'habit' ? await toggleHabitToday(item.id, nextDone, mini || low) : await toggleTaskDone(item.id, nextDone);
      if (!r.ok) throw new Error();
      startTransition(() => router.refresh());
    } catch {
      setDoneMap((m) => ({ ...m, [item.key]: item.done }));
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  async function pickEnergy(v: number) {
    setEnergy(v);
    const r = await setTodayEnergy(v);
    if (r.message) toast({ message: r.message });
    startTransition(() => router.refresh());
  }

  async function plan(id: string, when: 'today' | 'tomorrow') {
    const r = await planTask(id, when);
    if (r.message) toast({ message: r.message, kind: r.ok ? 'success' : 'error' });
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Hero data={data} doneCount={doneCount} total={total} />

      {energy === null ? (
        <EnergyCheck onPick={pickEnergy} />
      ) : (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-4 py-2.5 text-sm">
          <span className="text-ink-soft">
            Energi: <span className="font-semibold text-ink">{ENERGY[energy - 1].emoji} {ENERGY[energy - 1].label}</span>
            {low && <span className="ml-1 text-ink-faint">· mode minimum</span>}
          </span>
          <div className="flex gap-1">
            {ENERGY.map((e) => (
              <button key={e.value} type="button" onClick={() => pickEnergy(e.value)} aria-label={`Energi ${e.label}`} aria-pressed={energy === e.value} className={cn('grid h-8 w-8 place-items-center rounded-lg text-base transition', energy === e.value ? 'bg-surface shadow-card' : 'opacity-50 hover:opacity-100')}>
                {e.emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>{allDone && <AllDone />}</AnimatePresence>

      {next && !allDone && <NowCard item={next} nowMin={nowMin} low={low} onDone={() => toggle(next)} />}

      {data.habitCount === 0 && <StarterCta />}

      <section aria-label="Jadwal hari ini" className="space-y-6">
        {SECTIONS.map((s) => {
          const list = timed.filter((i) => i.minute! >= s.from && i.minute! < s.to);
          if (!list.length) return null;
          const Icon = s.icon;
          const isNow = nowMin !== null && nowMin >= s.from && nowMin < s.to;
          return (
            <div key={s.key}>
              <h2 className={cn('mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.1em]', isNow ? 'text-brand' : 'text-ink-faint')}>
                <Icon size={14} /> {s.label}
                {isNow && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] tracking-normal">sekarang</span>}
              </h2>
              <ul className="space-y-2">
                {list.map((i) => (
                  <Row key={i.key} item={i} nowMin={nowMin} low={low} burst={burst === i.key} onToggle={toggle} onShift={() => plan(i.id, 'today')} />
                ))}
              </ul>
            </div>
          );
        })}

        <div>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">
            <Zap size={14} /> Kapan aja hari ini
          </h2>
          <AnytimeList items={anytime} nowMin={nowMin} low={low} burst={burst} onToggle={toggle} onShift={(id) => plan(id, 'today')} />
          <QuickAdd />
        </div>
      </section>

      {data.inbox.length > 0 && (
        <section className="mt-8 rounded-2xl border border-dashed border-line p-4" aria-label="Inbox">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
            <Inbox size={15} /> Inbox pikiran <span className="rounded-full bg-surface-2 px-2 text-xs text-ink-soft">{data.inbox.length}</span>
          </h2>
          <p className="mb-3 text-xs text-ink-faint">Yang kamu tangkap tapi belum ada kapannya. Kasih hari, biar kepala lega.</p>
          <ul className="space-y-1.5">
            {data.inbox.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</span>
                <button type="button" onClick={() => plan(t.id, 'today')} className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand hover:brightness-105">
                  Hari ini
                </button>
                <button type="button" onClick={() => plan(t.id, 'tomorrow')} className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2">
                  Besok
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data.upcoming.length > 0 || data.laterChores.length > 0) && (
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {data.upcoming.length > 0 && (
            <div className="rounded-2xl bg-surface-2/50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">Minggu ini</p>
              <ul className="space-y-1.5 text-sm">
                {data.upcoming.map((u) => (
                  <li key={u.id} className="flex justify-between gap-2">
                    <span className="truncate text-ink">{u.title}</span>
                    <span className="shrink-0 text-ink-faint">{formatDate(u.dueAt, { weekday: 'short', day: 'numeric' })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.laterChores.length > 0 && (
            <div className="rounded-2xl bg-surface-2/50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">Belum waktunya</p>
              <ul className="space-y-1.5 text-sm">
                {data.laterChores.map((c) => (
                  <li key={c.name} className="flex justify-between gap-2">
                    <span className="text-ink-soft">{c.name}</span>
                    <span className="text-ink-faint">{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <CloseDay closed={data.closed} nowMin={nowMin} />
    </div>
  );
}

// ── Header ala Duolingo: streak, XP, cincin progres, minggu ini ───────────

function Hero({ data, doneCount, total }: { data: TodayData; doneCount: number; total: number }) {
  const pct = total ? doneCount / total : 0;
  const lvlPct = data.levelCeil > data.levelFloor ? (data.xp - data.levelFloor) / (data.levelCeil - data.levelFloor) : 0;
  const R = 30;
  const C = 2 * Math.PI * R;

  return (
    <header className="mb-5">
      <p className="text-sm font-medium text-ink-faint" suppressHydrationWarning>
        {data.dateLabel}
      </p>
      <div className="mt-1 flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-[28px]" suppressHydrationWarning>
          {data.greeting}, {data.name}.
        </h1>
        <div className="relative h-[72px] w-[72px] shrink-0" aria-label={`${doneCount} dari ${total} selesai`}>
          <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
            <circle cx="36" cy="36" r={R} fill="none" strokeWidth="7" className="stroke-surface-2" />
            <motion.circle cx="36" cy="36" r={R} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-mint" strokeDasharray={C} initial={false} animate={{ strokeDashoffset: C * (1 - pct) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center leading-none">
            <span className="font-heading text-lg font-bold text-ink tabular">{doneCount}</span>
            <span className="text-[10px] text-ink-faint">/ {total}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-warn-soft px-4 py-3">
          <motion.span key={data.streak} initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
            <Flame size={26} className="fill-warn/30 text-warn" />
          </motion.span>
          <div>
            <p className="font-heading text-xl font-bold leading-none text-ink tabular">{data.streak}</p>
            <p className="text-xs text-ink-soft">hari beruntun</p>
          </div>
        </div>
        <div className="rounded-2xl bg-brand-soft px-4 py-3">
          <div className="flex items-baseline justify-between">
            <p className="font-heading text-xl font-bold leading-none text-ink">Lv {data.level}</p>
            <p className="text-xs text-ink-soft tabular">{data.xp} XP</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface/70">
            <motion.div className="h-full rounded-full bg-brand-solid" initial={false} animate={{ width: `${Math.round(Math.min(1, Math.max(0, lvlPct)) * 100)}%` }} />
          </div>
        </div>
      </div>

      <ol className="mt-3 flex justify-between gap-1 rounded-2xl bg-surface px-3 py-2.5 shadow-card" aria-label="7 hari terakhir">
        {data.week.map((d) => {
          const wd = new Date(`${d.ymd}T00:00:00Z`).getUTCDay();
          return (
            <li key={d.ymd} className="flex flex-1 flex-col items-center gap-1">
              <span className={cn('text-[11px] font-medium', d.isToday ? 'text-brand' : 'text-ink-faint')}>{WEEKDAY_SHORT[(wd + 6) % 7]}</span>
              <span className={cn('grid h-7 w-7 place-items-center rounded-full text-xs', d.active ? 'bg-warn text-white' : 'bg-surface-2 text-ink-faint', d.isToday && 'ring-2 ring-brand-solid ring-offset-2 ring-offset-surface')}>
                {d.active ? <Flame size={14} /> : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

function EnergyCheck({ onPick }: { onPick: (v: number) => void }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-2xl border-2 border-brand-solid/40 bg-surface p-4 shadow-card">
      <p className="font-heading text-base font-semibold text-ink">Gimana energimu sekarang?</p>
      <p className="mb-3 text-sm text-ink-soft">Satu ketukan. Kalau habis, hari ini cukup versi mini.</p>
      <div className="grid grid-cols-3 gap-2">
        {ENERGY.map((e) => (
          <button key={e.value} type="button" onClick={() => onPick(e.value)} className="flex flex-col items-center gap-1 rounded-xl border-2 border-line bg-surface-2/40 py-3 transition hover:-translate-y-0.5 hover:border-brand-solid active:translate-y-0">
            <span className="text-2xl">{e.emoji}</span>
            <span className="text-sm font-semibold text-ink">{e.label}</span>
            <span className="text-[11px] text-ink-faint">{e.hint}</span>
          </button>
        ))}
      </div>
    </motion.section>
  );
}

function NowCard({ item, nowMin, low, onDone }: { item: TodayItem; nowMin: number | null; low: boolean; onDone: () => void }) {
  const when = item.minute === null ? 'Kapan aja' : nowMin !== null && item.minute <= nowMin ? `Dari ${hhmm(item.minute)}` : `Jam ${hhmm(item.minute)}`;
  return (
    <motion.section layout className="mb-6 overflow-hidden rounded-2xl bg-brand-solid p-5 text-white shadow-lift" aria-label="Sekarang">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/70">Sekarang · {when}</p>
      <p className="mt-1 font-heading text-xl font-bold leading-snug">{item.title}</p>
      {item.sub && <p className="mt-1 text-sm text-white/80">{low && item.kind === 'habit' ? `Versi mini: ${item.sub}` : item.sub}</p>}
      <button type="button" onClick={onDone} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-brand-solid shadow-sm transition active:scale-95">
        <Check size={17} strokeWidth={3} /> Selesai
      </button>
    </motion.section>
  );
}

const HEAT_BADGE: Record<HabitHeat, string> = {
  calm: '',
  due: 'bg-brand-soft text-brand',
  warm: 'bg-warn-soft text-warn',
  hot: 'bg-danger-soft text-danger',
};

function Row({ item, nowMin, low, burst, onToggle, onShift }: { item: TodayItem; nowMin: number | null; low: boolean; burst: boolean; onToggle: (i: TodayItem, mini?: boolean) => void; onShift: () => void }) {
  const past = !item.done && item.minute !== null && nowMin !== null && item.minute + 60 < nowMin;
  const isEvent = item.kind === 'event';
  const showMini = item.kind === 'habit' && !!item.sub && !item.done;

  return (
    <motion.li layout transition={{ duration: 0.25, ease: EASE }} className={cn('relative flex items-center gap-3 rounded-2xl border bg-surface px-3.5 py-3 shadow-card transition-colors', item.done ? 'border-mint/40 bg-mint-soft/40' : 'border-line', item.heat === 'hot' && !item.done && 'border-danger/40')}>
      <span className="w-11 shrink-0 text-xs font-semibold text-ink-faint tabular">{item.minute !== null ? hhmm(item.minute) : ''}</span>

      {isEvent ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft" aria-hidden="true">
          <CalendarDays size={16} />
        </span>
      ) : (
        <button type="button" role="checkbox" aria-checked={item.done} aria-label={item.title} onClick={() => onToggle(item)} className={cn('relative grid h-9 w-9 shrink-0 place-items-center rounded-full border-[2.5px] transition active:scale-90', item.done ? 'border-mint bg-mint text-white' : 'border-ink-faint/50 hover:border-mint')}>
          <AnimatePresence>
            {item.done && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }}>
                <Check size={18} strokeWidth={3.4} />
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {burst && (
              <motion.span className="pointer-events-none absolute -top-2 left-1/2 whitespace-nowrap text-xs font-bold text-mint" initial={{ opacity: 1, y: 0, x: '-50%' }} animate={{ opacity: 0, y: -22 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
                +XP
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className={cn('text-[15px] font-medium leading-snug', item.done ? 'text-ink-faint line-through decoration-ink-faint/50' : 'text-ink')}>{item.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          {item.kind === 'habit' && low && item.sub && !item.done ? <span className="font-medium text-brand">Mini: {item.sub}</span> : item.sub && <span>{item.sub}</span>}
          {item.heatLabel && !item.done && <span className={cn('rounded-md px-1.5 py-0.5 font-semibold', HEAT_BADGE[item.heat])}>{item.heatLabel}</span>}
          {past && <span>lewat jamnya, masih bisa</span>}
        </div>
      </div>

      {item.overdue && !item.done && (
        <button type="button" onClick={onShift} className="shrink-0 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
          Geser
        </button>
      )}
      {showMini && !low && (
        <button type="button" onClick={() => onToggle(item, true)} title={`Versi mini: ${item.sub}`} className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-faint hover:bg-surface-2 hover:text-ink">
          Mini
        </button>
      )}
    </motion.li>
  );
}

function AnytimeList({ items, nowMin, low, burst, onToggle, onShift }: { items: TodayItem[]; nowMin: number | null; low: boolean; burst: string | null; onToggle: (i: TodayItem, mini?: boolean) => void; onShift: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  // Batasi pilihan: mode minimum cuma 1 yang belum selesai, biasa 5. Sisanya dilipat.
  const limit = low ? 1 : 5;
  const pending = items.filter((i) => !i.done);
  const visible = open ? items : [...pending.slice(0, limit), ...items.filter((i) => i.done)];
  const hidden = items.length - visible.length;

  if (!items.length) return <p className="px-1 pb-2 text-sm text-ink-faint">Kosong. Tambah satu di bawah kalau perlu.</p>;
  return (
    <>
      <ul className="space-y-2">
        {visible.map((i) => (
          <Row key={i.key} item={i} nowMin={nowMin} low={low} burst={burst === i.key} onToggle={onToggle} onShift={() => onShift(i.id)} />
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 px-1 text-sm font-medium text-ink-soft hover:text-ink">
          <ChevronDown size={15} /> {hidden} lagi (sengaja disembunyiin biar nggak overwhelm)
        </button>
      )}
    </>
  );
}

function QuickAdd() {
  return (
    <ActionForm action={addTodayTask} className="mt-3 flex gap-2">
      <Input name="title" placeholder="Tambah tugas hari ini…" maxLength={200} required aria-label="Tugas baru" className="flex-1" />
      <Input name="time" type="time" aria-label="Jam (opsional)" className="w-[104px]" />
      <SubmitButton size="md" className="px-3">
        <Plus size={16} strokeWidth={2.6} />
        <span className="sr-only">Tambah</span>
      </SubmitButton>
    </ActionForm>
  );
}

function StarterCta() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <section className="mb-6 rounded-2xl border-2 border-dashed border-mint/60 bg-mint-soft/40 p-5">
      <p className="flex items-center gap-2 font-heading text-base font-semibold text-ink">
        <Sparkles size={17} className="text-mint" /> Pasang rutinitas awal
      </p>
      <p className="mt-1 text-sm text-ink-soft">Meditasi, gym Sen/Rab/Jum, makan, cuci piring, cuci baju tiap 3 hari, beresin kamar, journaling, review mingguan. Semua punya versi mini. Bisa diubah nanti.</p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await installStarterPack();
          toast({ message: r.message ?? 'Siap.' });
          router.refresh();
          setBusy(false);
        }}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-mint px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60 dark:text-navy"
      >
        Pasang sekarang <ArrowRight size={15} />
      </button>
    </section>
  );
}

function AllDone() {
  return (
    <motion.section initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="relative mb-6 overflow-hidden rounded-2xl bg-mint p-5 text-white dark:text-navy">
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span key={i} className="absolute h-2 w-2 rounded-full bg-white/70" style={{ left: `${(i * 37) % 100}%`, top: '60%' }} initial={{ y: 0, opacity: 1 }} animate={{ y: -60 - (i % 4) * 18, opacity: 0 }} transition={{ duration: 1.1, delay: i * 0.03 }} />
      ))}
      <p className="font-heading text-xl font-bold">Semua beres hari ini 🔥</p>
      <p className="mt-1 text-sm opacity-90">Streak aman. Sisanya waktu kamu.</p>
    </motion.section>
  );
}

function CloseDay({ closed, nowMin }: { closed: boolean; nowMin: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const evening = nowMin !== null && nowMin >= 18 * 60;
  const expanded = open || (evening && !closed);

  if (closed) {
    return (
      <section className="mt-8 flex items-center gap-3 rounded-2xl bg-surface-2/60 p-4">
        <Moon size={18} className="text-brand" />
        <p className="text-sm text-ink-soft">Hari ini udah ditutup. Selamat istirahat.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-card" aria-label="Tutup hari">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span className="flex items-center gap-2 font-heading text-base font-semibold text-ink">
          <Moon size={17} className="text-brand" /> Tutup Hari
        </span>
        <ChevronDown size={17} className={cn('text-ink-faint transition', expanded && 'rotate-180')} />
      </button>
      {!expanded && <p className="mt-1 text-sm text-ink-faint">Muncul otomatis jam 18.00. Journaling 3 kalimat + meditasi.</p>}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <ActionForm action={closeDay} onDone={(r) => r.ok && router.refresh()} className="mt-3 space-y-3">
              <Textarea name="win" rows={2} placeholder="Satu hal yang berhasil hari ini…" aria-label="Yang berhasil hari ini" />
              <Textarea name="lesson" rows={2} placeholder="Apa yang bikin berat?" aria-label="Yang bikin berat" />
              <Textarea name="tomorrow" rows={2} placeholder="Satu hal paling penting besok…" aria-label="Paling penting besok" />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  Meditasi
                  <Input name="meditationMin" type="number" min={0} max={120} inputMode="numeric" placeholder="5" className="w-20" />
                  menit
                </label>
                <SubmitButton className="ml-auto">Tutup hari</SubmitButton>
              </div>
            </ActionForm>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
