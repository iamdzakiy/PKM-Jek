'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, CalendarDays, Check, ChevronDown, Clock, Flame, GripVertical, Inbox, LayoutGrid, ListTree, Moon, Plus, Rocket, Shield, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { addTodayTask, closeDay, installStarterPack, planTask, scheduleTaskAt, setTodayEnergy, toggleHabitToday, toggleTaskDone } from '@/app/actions/today';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Input, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { EASE } from '@/components/motion/primitives';
import { hhmm, jakartaMinutes, minutesOfDay, WEEKDAY_SHORT, type HabitHeat } from '@/lib/adhd/today';
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
  /** estimasi menit fokus (tugas saja), dipakai bar bahan bakar 5 jam */
  estimate: number;
  /** halaman pendukung, mis. Gym → /training, Cek pagi → /admin */
  href?: string | null;
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
  shields: number;
  xp: number;
  level: number;
  levelFloor: number;
  levelCeil: number;
  week: { ymd: string; active: boolean; isToday: boolean }[];
}

/** Batas realistis kerja fokus per hari (Sunsama): 5 jam. */
const FUEL_CAP_MIN = 300;
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 05:00–23:00

const ENERGY = [
  { value: 1, emoji: '🪫', label: 'Habis', hint: 'Versi mini aja' },
  { value: 2, emoji: '😐', label: 'Biasa', hint: 'Jalan pelan' },
  { value: 3, emoji: '🔋', label: 'Penuh', hint: 'Gas fokus' },
] as const;

const CHEERS = ['Sector cleared, Ranger!', 'Misi beres. To infinity!', 'Satu sektor aman.', 'Mantap, Space Ranger!', 'Bintang bertambah satu.', 'Laser on target!'];

type View = 'cockpit' | 'timeline';

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

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

/** Bunyi "pop" kecil saat misi selesai. Web Audio, tanpa file, bisa dimatikan. */
function usePop() {
  const [on, setOn] = useState(true);
  const ctx = useRef<AudioContext | null>(null);
  useEffect(() => setOn(readLocal('sc-sound') !== 'off'), []);
  const toggle = useCallback(() => {
    setOn((v) => {
      writeLocal('sc-sound', v ? 'off' : 'on');
      return !v;
    });
  }, []);
  const pop = useCallback(
    (big = false) => {
      if (!on || typeof window === 'undefined') return;
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx.current ??= new AC();
        const c = ctx.current;
        const notes = big ? [523, 659, 784, 1047] : [660, 990];
        notes.forEach((f, i) => {
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          const t = c.currentTime + i * 0.07;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          o.connect(g).connect(c.destination);
          o.start(t);
          o.stop(t + 0.18);
        });
      } catch {
        /* audio tidak tersedia: diam saja */
      }
    },
    [on]
  );
  return { on, toggle, pop };
}

export function TodayBoard({ data }: { data: TodayData }) {
  const router = useRouter();
  const toast = useToast();
  const nowMin = useNowMinute();
  const sound = usePop();
  const [, startTransition] = useTransition();
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [minuteMap, setMinuteMap] = useState<Record<string, number | null>>({});
  const [energy, setEnergy] = useState<number | null>(data.energy);
  const [burst, setBurst] = useState<string | null>(null);
  const [view, setView] = useState<View>('cockpit');

  useEffect(() => {
    const v = readLocal('sc-view');
    if (v === 'cockpit' || v === 'timeline') setView(v);
  }, []);
  // Server data menang setelah refresh; state lokal hanya untuk respons instan.
  useEffect(() => {
    setDoneMap({});
    setMinuteMap({});
  }, [data.items]);
  useEffect(() => setEnergy(data.energy), [data.energy]);

  function changeView(v: View) {
    setView(v);
    writeLocal('sc-view', v);
  }

  const low = energy === 1;
  const items = useMemo(
    () => data.items.map((i) => ({ ...i, done: doneMap[i.key] ?? i.done, minute: i.key in minuteMap ? minuteMap[i.key] : i.minute })),
    [data.items, doneMap, minuteMap]
  );
  const checkable = items.filter((i) => i.kind !== 'event');
  const doneCount = checkable.filter((i) => i.done).length;
  const total = checkable.length;
  const allDone = total > 0 && doneCount === total;
  const fuel = items.filter((i) => i.kind === 'task' && !i.done).reduce((s, i) => s + i.estimate, 0);

  // Urutan misi: yang belum selesai, jam terdekat (maks. 2 jam lalu) dulu, lalu yang paling mendesak tanpa jam.
  const queue = useMemo(() => {
    if (nowMin === null) return [];
    const open = items.filter((i) => !i.done && i.kind !== 'event');
    const timed = open.filter((i) => i.minute !== null && i.minute >= nowMin - 120).sort((a, b) => a.minute! - b.minute!);
    const loose = open.filter((i) => i.minute === null).sort((a, b) => a.sortHeat - b.sortHeat);
    const missed = open.filter((i) => i.minute !== null && i.minute < nowMin - 120);
    return [...timed, ...loose, ...missed];
  }, [items, nowMin]);

  async function toggle(item: TodayItem, mini = false) {
    const nextDone = !item.done;
    setDoneMap((m) => ({ ...m, [item.key]: nextDone }));
    if (nextDone) {
      const finishing = doneCount + 1 === total;
      sound.pop(finishing);
      setBurst(item.key);
      window.setTimeout(() => setBurst((b) => (b === item.key ? null : b)), 900);
      toast({ message: finishing ? 'Mission cleared! Semua sektor aman hari ini.' : `${CHEERS[Math.floor(Math.random() * CHEERS.length)]} +${item.kind === 'habit' ? 10 : 8} XP` });
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

  async function schedule(taskId: string, minute: number | null) {
    setMinuteMap((m) => ({ ...m, [`t-${taskId}`]: minute }));
    try {
      const r = await scheduleTaskAt(taskId, minute);
      if (!r.ok) throw new Error();
      if (r.message) toast({ message: r.message });
      startTransition(() => router.refresh());
    } catch {
      setMinuteMap((m) => {
        const next = { ...m };
        delete next[`t-${taskId}`];
        return next;
      });
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

  const evening = nowMin !== null && nowMin >= 18 * 60;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-faint" suppressHydrationWarning>
            {data.dateLabel}
          </p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={sound.toggle} aria-label={sound.on ? 'Matikan suara' : 'Nyalakan suara'} className="grid h-9 w-9 place-items-center rounded-xl text-ink-faint transition hover:bg-surface-2 hover:text-ink">
            {sound.on ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <div className="glass flex rounded-2xl p-1" role="tablist" aria-label="Tampilan">
            {(
              [
                { v: 'cockpit', label: 'Cockpit', icon: LayoutGrid },
                { v: 'timeline', label: 'Timeline', icon: ListTree },
              ] as const
            ).map(({ v, label, icon: Icon }) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => changeView(v)} className={cn('relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition', view === v ? 'text-white' : 'text-ink-soft hover:text-ink')}>
                {view === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-xl bg-brand-solid" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <Icon size={14} className="relative" />
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </div>
        </div>
        <h1 className="mt-1 font-heading text-[26px] font-bold tracking-tight text-ink sm:text-[30px]" suppressHydrationWarning>
          {data.greeting}, {data.name}.
        </h1>
      </div>

      <Hud data={data} doneCount={doneCount} total={total} fuel={fuel} />

      <AnimatePresence mode="wait" initial={false}>
        {view === 'cockpit' ? (
          <motion.div key="cockpit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} transition={{ duration: 0.24, ease: EASE }} className="mt-4 space-y-4">
            {allDone ? (
              <AllDone />
            ) : energy === null ? (
              <EnergyCheck onPick={pickEnergy} />
            ) : data.habitCount === 0 && total === 0 ? (
              <StarterCta />
            ) : queue[0] ? (
              <MissionCard item={queue[0]} nowMin={nowMin} low={low} onDone={() => toggle(queue[0])} />
            ) : null}

            {evening && !data.closed ? (
              <CloseDay closed={false} defaultOpen />
            ) : (
              queue.length > 1 && (
                <section className="glass rounded-card p-3" aria-label="Berikutnya">
                  <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">Berikutnya</p>
                  <ul className="space-y-1">
                    {queue.slice(1, 3).map((i) => (
                      <MiniRow key={i.key} item={i} low={low} onToggle={() => toggle(i)} />
                    ))}
                  </ul>
                </section>
              )
            )}

            <button type="button" onClick={() => changeView('timeline')} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-ink-faint transition hover:text-ink">
              {Math.max(0, total - doneCount - Math.min(3, queue.length))} misi lain
              {data.inbox.length > 0 && ` · ${data.inbox.length} di inbox`} · buka timeline
              <ChevronDown size={15} className="-rotate-90" />
            </button>
          </motion.div>
        ) : (
          <motion.div key="timeline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} transition={{ duration: 0.24, ease: EASE }} className="mt-4">
            {energy === null && <EnergyCheck onPick={pickEnergy} />}
            {energy !== null && <EnergyBar energy={energy} low={low} onPick={pickEnergy} />}
            {data.habitCount === 0 && <StarterCta />}
            <Timeline items={items} nowMin={nowMin} low={low} burst={burst} onToggle={toggle} onSchedule={schedule} onShift={(id) => plan(id, 'today')} />

            {data.inbox.length > 0 && (
              <section className="glass mt-6 rounded-card p-4" aria-label="Inbox">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
                  <Inbox size={15} /> Inbox pikiran <span className="rounded-full bg-surface-2 px-2 text-xs text-ink-soft">{data.inbox.length}</span>
                </h2>
                <p className="mb-3 text-xs text-ink-faint">Seret ke jam di atas, atau kasih hari biar kepala lega.</p>
                <ul className="space-y-1.5">
                  {data.inbox.map((t) => (
                    <li key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)} className="flex cursor-grab items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2 active:cursor-grabbing">
                      <GripVertical size={14} className="shrink-0 text-ink-faint" />
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
              <section className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.upcoming.length > 0 && (
                  <div className="glass rounded-card p-4">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">Minggu ini</p>
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
                  <div className="glass rounded-card p-4">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">Belum waktunya</p>
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

            <CloseDay closed={data.closed} defaultOpen={evening} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── HUD: progres, streak + shield, XP, bahan bakar 5 jam (satu elemen) ────

function Hud({ data, doneCount, total, fuel }: { data: TodayData; doneCount: number; total: number; fuel: number }) {
  const pct = total ? doneCount / total : 0;
  const lvlPct = data.levelCeil > data.levelFloor ? (data.xp - data.levelFloor) / (data.levelCeil - data.levelFloor) : 0;
  const over = fuel > FUEL_CAP_MIN;
  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <section className="glass rounded-card p-4" aria-label="Status hari ini">
      <div className="flex items-center gap-4">
        <div className="relative h-[64px] w-[64px] shrink-0" aria-label={`${doneCount} dari ${total} misi selesai`}>
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
            <circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" className="stroke-surface-2" />
            <motion.circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-ranger" strokeDasharray={C} initial={false} animate={{ strokeDashoffset: C * (1 - pct) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center leading-none">
            <span className="font-heading text-base font-bold text-ink tabular">
              {doneCount}
              <span className="text-[11px] font-medium text-ink-faint">/{total}</span>
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <motion.span key={data.streak} initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
                <Flame size={20} className="fill-gold/40 text-gold" />
              </motion.span>
              <span className="font-heading text-lg font-bold leading-none text-ink tabular">{data.streak}</span>
              <span className="text-xs text-ink-faint">hari</span>
              <span className="ml-1 flex gap-0.5" title={`${data.shields} streak shield tersisa minggu ini`} aria-label={`${data.shields} streak shield`}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <Shield key={i} size={14} className={i < data.shields ? 'fill-info/30 text-info' : 'text-ink-faint/40'} />
                ))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-bold text-brand">Lv {data.level}</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                <motion.div className="h-full rounded-full bg-gold" initial={false} animate={{ width: `${Math.round(Math.min(1, Math.max(0, lvlPct)) * 100)}%` }} />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium">
              <span className={over ? 'text-danger' : 'text-ink-faint'}>{over ? `Over kapasitas ${Math.round((fuel - FUEL_CAP_MIN) / 6) / 10} jam: geser satu ke besok` : 'Bahan bakar fokus'}</span>
              <span className={cn('tabular', over ? 'text-danger' : 'text-ink-soft')}>
                {Math.floor(fuel / 60)}j {fuel % 60}m / 5j
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <motion.div className={cn('h-full rounded-full', over ? 'bg-danger shadow-[0_0_12px_rgb(var(--danger))]' : 'bg-info')} initial={false} animate={{ width: `${Math.min(100, (fuel / FUEL_CAP_MIN) * 100)}%` }} transition={{ type: 'spring', stiffness: 140, damping: 22 }} />
            </div>
          </div>
        </div>
      </div>

      <ol className="mt-3 flex justify-between gap-1 border-t border-line/60 pt-3" aria-label="7 hari terakhir">
        {data.week.map((d) => {
          const wd = new Date(`${d.ymd}T00:00:00Z`).getUTCDay();
          return (
            <li key={d.ymd} className="flex flex-1 flex-col items-center gap-1">
              <span className={cn('text-[10px] font-semibold', d.isToday ? 'text-brand' : 'text-ink-faint')}>{WEEKDAY_SHORT[(wd + 6) % 7]}</span>
              <span className={cn('grid h-6 w-6 place-items-center rounded-full', d.active ? 'bg-gold text-navy' : 'bg-surface-2', d.isToday && 'ring-2 ring-brand-solid ring-offset-2 ring-offset-surface')}>{d.active && <Flame size={12} />}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EnergyCheck({ onPick }: { onPick: (v: number) => void }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass mb-4 rounded-card border-2 !border-brand-solid/40 p-5">
      <p className="font-heading text-lg font-bold text-ink">Pre-flight check: energimu?</p>
      <p className="mb-4 text-sm text-ink-soft">Satu ketukan. Kalau habis, hari ini cukup versi mini dan itu tetap dihitung.</p>
      <div className="grid grid-cols-3 gap-2">
        {ENERGY.map((e) => (
          <button key={e.value} type="button" onClick={() => onPick(e.value)} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-line bg-surface-2/50 py-4 transition hover:-translate-y-0.5 hover:border-ranger active:translate-y-0 active:scale-95">
            <span className="text-3xl">{e.emoji}</span>
            <span className="text-sm font-bold text-ink">{e.label}</span>
            <span className="text-[11px] text-ink-faint">{e.hint}</span>
          </button>
        ))}
      </div>
    </motion.section>
  );
}

function EnergyBar({ energy, low, onPick }: { energy: number; low: boolean; onPick: (v: number) => void }) {
  return (
    <div className="glass mb-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm">
      <span className="text-ink-soft">
        Energi: <span className="font-semibold text-ink">{ENERGY[energy - 1].emoji} {ENERGY[energy - 1].label}</span>
        {low && <span className="ml-1 text-ink-faint">· mode minimum</span>}
      </span>
      <div className="flex gap-1">
        {ENERGY.map((e) => (
          <button key={e.value} type="button" onClick={() => onPick(e.value)} aria-label={`Energi ${e.label}`} aria-pressed={energy === e.value} className={cn('grid h-8 w-8 place-items-center rounded-lg text-base transition', energy === e.value ? 'bg-surface shadow-card' : 'opacity-50 hover:opacity-100')}>
            {e.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Kartu misi: satu hal, satu tombol besar ──────────────────────────────

function MissionCard({ item, nowMin, low, onDone }: { item: TodayItem; nowMin: number | null; low: boolean; onDone: () => void }) {
  const when = item.minute === null ? 'Kapan aja' : nowMin !== null && item.minute <= nowMin ? `Dari ${hhmm(item.minute)}` : `Jam ${hhmm(item.minute)}`;
  return (
    <motion.section layout key={item.key} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-solid to-[#4A1460] p-6 text-white shadow-lift" aria-label="Misi sekarang">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-ranger/40 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 rounded-card ring-1 ring-inset ring-white/15" />
      <p className="relative flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
        <Rocket size={13} /> Misi sekarang · {when}
      </p>
      <p className="relative mt-2 font-heading text-[26px] font-bold leading-tight">{item.title}</p>
      {item.sub && <p className="relative mt-1 text-sm text-white/80">{low && item.kind === 'habit' ? `Versi mini: ${item.sub}` : item.sub}</p>}
      {item.heatLabel && <p className="relative mt-2 inline-block rounded-lg bg-white/15 px-2 py-0.5 text-xs font-semibold">{item.heatLabel}</p>}
      {item.href && (
        <Link href={item.href} className="relative mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-white/15 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/25">
          Buka panduan <ArrowUpRight size={15} />
        </Link>
      )}
      <button type="button" onClick={onDone} className={cn('relative flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ranger text-base font-extrabold uppercase tracking-wide text-white shadow-[0_5px_0_rgb(40_110_25)] transition active:translate-y-[3px] active:shadow-[0_2px_0_rgb(40_110_25)]', item.href ? 'mt-2.5' : 'mt-5')}>
        <Check size={20} strokeWidth={3.2} /> Mission cleared
      </button>
    </motion.section>
  );
}

function MiniRow({ item, low, onToggle }: { item: TodayItem; low: boolean; onToggle: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-surface-2/60">
      <CheckButton done={item.done} label={item.title} onClick={onToggle} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ink">{item.title}</p>
        {(item.sub || item.heatLabel) && <p className="truncate text-xs text-ink-faint">{item.heatLabel ?? (low && item.kind === 'habit' ? `Mini: ${item.sub}` : item.sub)}</p>}
      </div>
      <span className="shrink-0 text-xs font-semibold text-ink-faint tabular">{item.minute !== null ? hhmm(item.minute) : ''}</span>
    </li>
  );
}

function CheckButton({ done, label, onClick, size = 'md', burst = false }: { done: boolean; label: string; onClick: () => void; size?: 'sm' | 'md'; burst?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={label} onClick={onClick} className={cn('relative grid shrink-0 place-items-center rounded-full border-[2.5px] transition active:scale-90', size === 'sm' ? 'h-8 w-8' : 'h-9 w-9', done ? 'border-ranger bg-ranger text-white' : 'border-ink-faint/50 hover:border-ranger')}>
      <AnimatePresence>
        {done && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }}>
            <Check size={size === 'sm' ? 15 : 18} strokeWidth={3.4} />
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {burst && (
          <motion.span className="pointer-events-none absolute -top-2 left-1/2 whitespace-nowrap text-xs font-extrabold text-gold" initial={{ opacity: 1, y: 0, x: '-50%' }} animate={{ opacity: 0, y: -24 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
            +XP
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// ── Timeline per jam dengan drag & drop (timebox ala Sunsama) ─────────────

const HEAT_BADGE: Record<HabitHeat, string> = {
  calm: '',
  due: 'bg-brand-soft text-brand',
  warm: 'bg-warn-soft text-warn',
  hot: 'bg-danger-soft text-danger',
};

function Timeline({ items, nowMin, low, burst, onToggle, onSchedule, onShift }: { items: TodayItem[]; nowMin: number | null; low: boolean; burst: string | null; onToggle: (i: TodayItem, mini?: boolean) => void; onSchedule: (taskId: string, minute: number | null) => void; onShift: (id: string) => void }) {
  const [over, setOver] = useState<number | 'anytime' | null>(null);
  const [showAll, setShowAll] = useState(false);
  const timed = items.filter((i) => i.minute !== null);
  const anytime = items.filter((i) => i.minute === null).sort((a, b) => Number(a.done) - Number(b.done) || a.sortHeat - b.sortHeat);
  const nowHour = nowMin === null ? null : Math.floor(nowMin / 60);
  const limit = low ? 1 : 5;
  const pending = anytime.filter((i) => !i.done);
  const visibleAnytime = showAll ? anytime : [...pending.slice(0, limit), ...anytime.filter((i) => i.done)];
  // Jam sebelum 05:00 (jarang) tetap ditampilkan di slot 05.
  const hourOf = (m: number) => Math.max(5, Math.floor(m / 60));

  function dropProps(target: number | 'anytime') {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(target);
      },
      onDragLeave: () => setOver((o) => (o === target ? null : o)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(null);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onSchedule(id, target === 'anytime' ? null : target * 60);
      },
    };
  }

  return (
    <section aria-label="Timeline hari ini">
      <p className="mb-2 px-1 text-xs text-ink-faint">Seret tugas ke jamnya. Kalau Google Calendar tersambung, bloknya ikut pindah.</p>
      <ol className="glass relative rounded-card px-2 py-2">
        {HOURS.map((h) => {
          const list = timed.filter((i) => hourOf(i.minute!) === h).sort((a, b) => a.minute! - b.minute!);
          const isNow = nowHour === h;
          return (
            <li key={h} {...dropProps(h)} className={cn('relative flex gap-2 rounded-2xl px-1 transition-colors', list.length ? 'py-1.5' : 'py-0.5', over === h && 'bg-ranger/15 ring-2 ring-ranger/50')}>
              <span className={cn('w-11 shrink-0 pt-2 text-[11px] font-semibold tabular', isNow ? 'text-ranger' : 'text-ink-faint/80')}>{String(h).padStart(2, '0')}:00</span>
              <div className="min-w-0 flex-1">
                {isNow && nowMin !== null && <div className="pointer-events-none absolute left-12 right-2 z-10 h-0.5 rounded-full bg-ranger shadow-[0_0_8px_rgb(var(--ranger))]" style={{ top: `${((nowMin % 60) / 60) * 100}%` }} />}
                {list.length ? (
                  <ul className="space-y-1.5">
                    {list.map((i) => (
                      <Row key={i.key} item={i} nowMin={nowMin} low={low} burst={burst === i.key} onToggle={onToggle} onSchedule={onSchedule} onShift={() => onShift(i.id)} />
                    ))}
                  </ul>
                ) : (
                  <div className="h-7 border-t border-dashed border-line/70" style={{ marginTop: 14 }} />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div {...dropProps('anytime')} className={cn('mt-5 rounded-card p-1 transition-colors', over === 'anytime' && 'bg-ranger/10 ring-2 ring-ranger/40')}>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
          <Zap size={14} /> Kapan aja hari ini
        </h2>
        {anytime.length ? (
          <ul className="space-y-2">
            {visibleAnytime.map((i) => (
              <Row key={i.key} item={i} nowMin={nowMin} low={low} burst={burst === i.key} onToggle={onToggle} onSchedule={onSchedule} onShift={() => onShift(i.id)} />
            ))}
          </ul>
        ) : (
          <p className="px-1 pb-2 text-sm text-ink-faint">Kosong. Tambah satu di bawah kalau perlu.</p>
        )}
        {anytime.length > visibleAnytime.length && (
          <button type="button" onClick={() => setShowAll(true)} className="mt-2 inline-flex items-center gap-1 px-1 text-sm font-medium text-ink-soft hover:text-ink">
            <ChevronDown size={15} /> {anytime.length - visibleAnytime.length} lagi (sengaja disembunyiin biar nggak overwhelm)
          </button>
        )}
        <QuickAdd />
      </div>
    </section>
  );
}

function Row({ item, nowMin, low, burst, onToggle, onSchedule, onShift }: { item: TodayItem; nowMin: number | null; low: boolean; burst: boolean; onToggle: (i: TodayItem, mini?: boolean) => void; onSchedule: (taskId: string, minute: number | null) => void; onShift: () => void }) {
  const [picking, setPicking] = useState(false);
  const past = item.kind !== 'event' && !item.done && item.minute !== null && nowMin !== null && item.minute + 60 < nowMin;
  const isEvent = item.kind === 'event';
  const isTask = item.kind === 'task';
  const showMini = item.kind === 'habit' && !!item.sub && !item.done && !low;

  return (
    <li
      draggable={isTask && !item.done}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
      className={cn(
        'relative flex items-center gap-3 rounded-2xl border bg-surface/80 px-3 py-2.5 transition-colors',
        isTask && !item.done && 'cursor-grab active:cursor-grabbing',
        item.done ? 'border-ranger/40 bg-mint-soft/50' : 'border-line/70',
        item.heat === 'hot' && !item.done && 'border-danger/50',
        isEvent && 'border-info/40 bg-info-soft/50'
      )}
    >
      {isEvent ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-info/15 text-info" aria-hidden="true">
          <CalendarDays size={16} />
        </span>
      ) : (
        <CheckButton done={item.done} label={item.title} onClick={() => onToggle(item)} burst={burst} />
      )}

      <div className="min-w-0 flex-1">
        <p className={cn('text-[15px] font-medium leading-snug', item.done ? 'text-ink-faint line-through decoration-ink-faint/50' : 'text-ink')}>{item.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          {item.minute !== null && <span className="font-semibold tabular">{hhmm(item.minute)}</span>}
          {item.kind === 'habit' && low && item.sub && !item.done ? <span className="font-medium text-brand">Mini: {item.sub}</span> : item.sub && <span>{item.sub}</span>}
          {item.heatLabel && !item.done && <span className={cn('rounded-md px-1.5 py-0.5 font-semibold', HEAT_BADGE[item.heat])}>{item.heatLabel}</span>}
          {past && <span>lewat jamnya, masih bisa</span>}
        </div>
      </div>

      {isTask && !item.done && (
        <>
          {picking ? (
            <input
              type="time"
              autoFocus
              defaultValue={item.minute !== null ? hhmm(item.minute) : ''}
              aria-label="Jam tugas"
              onBlur={() => setPicking(false)}
              onChange={(e) => {
                const m = minutesOfDay(e.target.value);
                if (m !== null) {
                  setPicking(false);
                  onSchedule(item.id, m);
                }
              }}
              className="h-8 w-[96px] rounded-lg border border-line bg-surface px-2 text-xs text-ink"
            />
          ) : (
            <button type="button" onClick={() => setPicking(true)} aria-label="Atur jam" title="Atur jam (atau seret ke timeline)" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-surface-2 hover:text-ink">
              <Clock size={15} />
            </button>
          )}
        </>
      )}
      {item.overdue && !item.done && (
        <button type="button" onClick={onShift} className="shrink-0 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
          Geser
        </button>
      )}
      {item.href && !item.done && (
        <Link href={item.href} aria-label={`Buka ${item.title}`} title="Buka panduan" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-surface-2 hover:text-ink">
          <ArrowUpRight size={15} />
        </Link>
      )}
      {showMini && (
        <button type="button" onClick={() => onToggle(item, true)} title={`Versi mini: ${item.sub}`} className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-faint hover:bg-surface-2 hover:text-ink">
          Mini
        </button>
      )}
    </li>
  );
}

function QuickAdd() {
  return (
    <ActionForm action={addTodayTask} className="mt-3 flex gap-2">
      <Input name="title" placeholder="Tambah misi hari ini…" maxLength={200} required aria-label="Tugas baru" className="flex-1" />
      <Select name="estimateMin" defaultValue="30" aria-label="Estimasi" className="w-[84px]">
        <option value="15">15m</option>
        <option value="30">30m</option>
        <option value="60">1j</option>
        <option value="90">1.5j</option>
        <option value="120">2j</option>
      </Select>
      <SubmitButton size="md" className="bg-ranger px-3">
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
    <section className="glass mb-5 rounded-card border-2 border-dashed !border-ranger/50 p-5">
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
        className="mt-3 inline-flex h-11 items-center gap-2 rounded-2xl bg-ranger px-5 text-sm font-bold text-white shadow-[0_4px_0_rgb(40_110_25)] transition active:translate-y-[2px] active:shadow-[0_2px_0_rgb(40_110_25)] disabled:opacity-60"
      >
        <Rocket size={15} /> Launch
      </button>
    </section>
  );
}

function AllDone() {
  return (
    <motion.section initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="relative overflow-hidden rounded-card bg-gradient-to-br from-ranger to-[#2E7D1E] p-6 text-white shadow-lift">
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.span key={i} className={cn('absolute h-2 w-2 rounded-full', i % 3 === 0 ? 'bg-gold' : i % 3 === 1 ? 'bg-white/80' : 'bg-brand-soft')} style={{ left: `${(i * 37) % 100}%`, top: '70%' }} initial={{ y: 0, opacity: 1 }} animate={{ y: -80 - (i % 4) * 20, opacity: 0 }} transition={{ duration: 1.2, delay: i * 0.03 }} />
      ))}
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">Semua sektor aman</p>
      <p className="mt-1 font-heading text-2xl font-bold">Mission cleared, Ranger! 🚀</p>
      <p className="mt-1 text-sm opacity-90">Streak aman. Sisanya waktu bebas kamu.</p>
    </motion.section>
  );
}

function CloseDay({ closed, defaultOpen }: { closed: boolean; defaultOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);

  if (closed) {
    return (
      <section className="glass mt-6 flex items-center gap-3 rounded-card p-4">
        <Moon size={18} className="text-brand" />
        <p className="text-sm text-ink-soft">Cockpit dikunci untuk malam ini. Selamat istirahat, Ranger.</p>
      </section>
    );
  }

  return (
    <section className="glass mt-6 rounded-card p-4" aria-label="Tutup hari">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span className="flex items-center gap-2 font-heading text-base font-semibold text-ink">
          <Moon size={17} className="text-brand" /> Shutdown: tutup hari
        </span>
        <ChevronDown size={17} className={cn('text-ink-faint transition', open && 'rotate-180')} />
      </button>
      {!open && <p className="mt-1 text-sm text-ink-faint">Muncul otomatis jam 18.00. Journaling 3 kalimat + meditasi.</p>}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="mt-2 text-xs text-ink-faint">Yang belum selesai nggak apa-apa. Itu bukan gagal, cuma pindah orbit ke besok.</p>
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
                <SubmitButton className="ml-auto">Kunci cockpit</SubmitButton>
              </div>
            </ActionForm>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
