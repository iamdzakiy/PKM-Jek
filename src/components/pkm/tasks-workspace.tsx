'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CalendarRange, ChevronLeft, ChevronRight, Columns3, List, X } from 'lucide-react';
import { planTaskOn, setTaskStatus } from '@/app/actions/tasks';
import { useToast } from '@/components/ui/toast';
import { usePrefs } from '@/lib/prefs';
import { NEED, effortLabel, needOf, sizeOf, type EffortSize } from '@/lib/tasks/labels';
import { cn } from '@/lib/utils';
import { TaskList, type TaskDTO } from './task-list';

type View = 'list' | 'board' | 'week';
type When = 'all' | 'today' | 'week' | 'late' | 'none';
type Status = TaskDTO['status'];

const VIEWS: { v: View; label: string; icon: typeof List }[] = [
  { v: 'list', label: 'Daftar', icon: List },
  { v: 'board', label: 'Board', icon: Columns3 },
  { v: 'week', label: 'Minggu', icon: CalendarRange },
];

const WHEN: { v: When; label: string }[] = [
  { v: 'all', label: 'Kapan aja' },
  { v: 'today', label: 'Hari ini' },
  { v: 'week', label: '7 hari' },
  { v: 'late', label: 'Lewat' },
  { v: 'none', label: 'Tanpa tanggal' },
];

const DAY = 86_400_000;
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekday = (ymd: string) => ((new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = Senin

function readView(): View {
  try {
    const v = localStorage.getItem('sc-task-view');
    return v === 'board' || v === 'week' ? v : 'list';
  } catch {
    return 'list';
  }
}

/** Tugas dalam tiga tampilan (Daftar, Board, Minggu) dengan filter yang sama. */
export function TasksWorkspace({ tasks, today }: { tasks: TaskDTO[]; today: string }) {
  const [view, setView] = useState<View>('list');
  const [tag, setTag] = useState<string | null>(null);
  const [need, setNeed] = useState<number | null>(null);
  const [size, setSize] = useState<EffortSize | null>(null);
  const [when, setWhen] = useState<When>('all');

  useEffect(() => setView(readView()), []);
  function changeView(v: View) {
    setView(v);
    try {
      localStorage.setItem('sc-task-view', v);
    } catch {
      /* ignore */
    }
  }

  const tags = useMemo(() => Array.from(new Set(tasks.map((t) => t.tag).filter((x): x is string => !!x))).sort(), [tasks]);
  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (tag && t.tag !== tag) return false;
        if (need && t.energyNeed !== need) return false;
        if (size && sizeOf(t.estimateMin) !== size) return false;
        if (view !== 'week' && when !== 'all') {
          if (when === 'none') return !t.day;
          if (!t.day) return false;
          if (when === 'today') return t.day === today;
          if (when === 'late') return t.day < today && t.status !== 'DONE';
          if (when === 'week') return t.day >= today && t.day <= addDays(today, 6);
        }
        return true;
      }),
    [tasks, tag, need, size, when, view, today]
  );
  const active = Boolean(tag || need || size || (view !== 'week' && when !== 'all'));

  return (
    <section className="space-y-4" aria-label="Daftar tugas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="glass flex rounded-2xl p-1" role="tablist" aria-label="Tampilan tugas">
          {VIEWS.map(({ v, label, icon: Icon }) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => changeView(v)} className={cn('relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition', view === v ? 'text-white' : 'text-ink-soft hover:text-ink')}>
              {view === v && <motion.span layoutId="task-view-pill" className="absolute inset-0 rounded-xl bg-brand-solid" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <Icon size={14} className="relative" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        {active && (
          <button type="button" onClick={() => (setTag(null), setNeed(null), setSize(null), setWhen('all'))} className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint hover:text-ink">
            <X size={13} /> Hapus filter · {filtered.length} tugas
          </button>
        )}
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 text-xs" aria-label="Filter">
        {view !== 'week' &&
          WHEN.map((w) => (
            <Chip key={w.v} on={when === w.v} onClick={() => setWhen(w.v)}>
              {w.label}
            </Chip>
          ))}
        {view !== 'week' && <span className="mx-1 w-px shrink-0 bg-line" aria-hidden="true" />}
        {NEED.map((n) => (
          <Chip key={n.value} on={need === n.value} onClick={() => setNeed(need === n.value ? null : n.value)} title={n.hint}>
            {n.emoji} {n.label}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" aria-hidden="true" />
        {(['kecil', 'sedang', 'besar'] as const).map((s) => (
          <Chip key={s} on={size === s} onClick={() => setSize(size === s ? null : s)} title={s === 'kecil' ? 'Usaha kecil' : s === 'sedang' ? 'Usaha sedang' : 'Usaha besar'}>
            {s === 'kecil' ? '≤30m' : s === 'sedang' ? '≤1j' : '>1j'}
          </Chip>
        ))}
        {tags.length > 0 && <span className="mx-1 w-px shrink-0 bg-line" aria-hidden="true" />}
        {tags.map((t) => (
          <Chip key={t} on={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            #{t}
          </Chip>
        ))}
      </div>

      {view === 'list' && <TaskList initial={filtered} />}
      {view === 'board' && <TaskBoard tasks={filtered} />}
      {view === 'week' && <TaskWeek tasks={filtered} today={today} />}
    </section>
  );
}

function Chip({ on, onClick, title, children }: { on: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} title={title} className={cn('shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition', on ? 'bg-brand-solid text-white' : 'bg-surface-2/70 text-ink-soft hover:text-ink')}>
      {children}
    </button>
  );
}

// ── Pindah kartu: seret di laptop, atau ketuk kartu lalu ketuk tujuan (HP) ──

function useMover<T extends string | null>(move: (id: string, to: T) => Promise<void>) {
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<T | 'none'>('none');
  return {
    picked,
    pick: (id: string) => setPicked((p) => (p === id ? null : id)),
    card: (id: string) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
      },
    }),
    target: (to: T) => ({
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(to);
      },
      onDragLeave: () => setOver('none'),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver('none');
        const id = e.dataTransfer.getData('text/plain');
        if (id) void move(id, to);
      },
      onClick: () => {
        if (picked) {
          void move(picked, to);
          setPicked(null);
        }
      },
    }),
    isOver: (to: T) => over === to,
  };
}

function useOptimistic(tasks: TaskDTO[]) {
  const [local, setLocal] = useState(tasks);
  useEffect(() => setLocal(tasks), [tasks]);
  return [local, setLocal] as const;
}

function MiniCard({ task, picked, onPick, drag, showDay }: { task: TaskDTO; picked: boolean; onPick: () => void; drag: object; showDay?: boolean }) {
  const need = needOf(task.energyNeed);
  const effort = effortLabel(task.estimateMin);
  const done = task.status === 'DONE';
  return (
    <li>
      <button
        type="button"
        {...drag}
        onClick={(e) => {
          e.stopPropagation();
          onPick();
        }}
        aria-pressed={picked}
        className={cn('block w-full cursor-grab rounded-xl border bg-surface px-3 py-2 text-left shadow-card transition active:cursor-grabbing', picked ? 'border-brand-solid ring-2 ring-brand-solid/30' : 'border-line hover:border-ink-faint/50')}
      >
        <span className={cn('line-clamp-2 text-sm font-medium', done ? 'text-ink-faint line-through' : 'text-ink')}>{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-faint">
          {need && <span title={`Tenaga ${need.label}`}>{need.emoji}</span>}
          {effort && <span>±{effort}</span>}
          {task.tag && <span>#{task.tag}</span>}
          {showDay && task.day && <span suppressHydrationWarning>{new Date(`${task.day}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>}
        </span>
      </button>
    </li>
  );
}

// ── Board per status ─────────────────────────────────────────────────────

const COLUMNS: { status: Status; label: string; tone: string }[] = [
  { status: 'OPEN', label: 'Belum', tone: 'bg-ink-faint' },
  { status: 'IN_PROGRESS', label: 'Dikerjakan', tone: 'bg-gold' },
  { status: 'DONE', label: 'Selesai', tone: 'bg-ranger' },
];

function TaskBoard({ tasks }: { tasks: TaskDTO[] }) {
  const router = useRouter();
  const toast = useToast();
  const [local, setLocal] = useOptimistic(tasks);
  const mover = useMover<Status>(async (id, status) => {
    const before = local;
    if (before.find((t) => t.id === id)?.status === status) return;
    setLocal((cur) => cur.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      const r = await setTaskStatus(id, status);
      if (!r.ok) throw new Error();
      if (status === 'DONE') toast({ message: 'Mission cleared! +XP' });
      router.refresh();
    } catch {
      setLocal(before);
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  });

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((c) => {
        const list = local.filter((t) => t.status === c.status);
        return (
          <section key={c.status} {...mover.target(c.status)} aria-label={c.label} className={cn('glass min-h-[8rem] rounded-card p-3 transition', mover.isOver(c.status) && 'ring-2 ring-brand-solid/50', mover.picked && 'cursor-pointer')}>
            <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
              <span className={cn('h-2 w-2 rounded-full', c.tone)} /> {c.label} <span className="font-medium normal-case tracking-normal">{list.length}</span>
            </h3>
            <ul className="space-y-2">
              {list.map((t) => (
                <MiniCard key={t.id} task={t} picked={mover.picked === t.id} onPick={() => mover.pick(t.id)} drag={mover.card(t.id)} showDay />
              ))}
            </ul>
            {mover.picked && !list.some((t) => t.id === mover.picked) && <p className="mt-2 rounded-lg border border-dashed border-brand-solid/50 py-2 text-center text-xs text-brand">Ketuk buat pindah ke sini</p>}
          </section>
        );
      })}
    </div>
  );
}

// ── Kalender mingguan ────────────────────────────────────────────────────

function TaskWeek({ tasks, today }: { tasks: TaskDTO[]; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [prefs] = usePrefs();
  const [offset, setOffset] = useState(0);
  const [local, setLocal] = useOptimistic(tasks);
  const monday = addDays(today, -(weekday(today) - 1) + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const cap = prefs.capHours * 60;

  const mover = useMover<string | null>(async (id, day) => {
    const before = local;
    if (before.find((t) => t.id === id)?.day === day) return;
    setLocal((cur) => cur.map((t) => (t.id === id ? { ...t, day } : t)));
    try {
      const r = await planTaskOn(id, day);
      if (!r.ok) throw new Error();
      router.refresh();
    } catch {
      setLocal(before);
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  });

  const unplanned = local.filter((t) => !t.day && t.status !== 'DONE');
  const label = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('id-ID', { ...opts, timeZone: 'UTC' });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Minggu sebelumnya" className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-2 hover:text-ink">
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={() => setOffset(0)} className="text-sm font-semibold text-ink" suppressHydrationWarning>
          {label(days[0], { day: 'numeric', month: 'short' })} – {label(days[6], { day: 'numeric', month: 'short' })}
          {offset !== 0 && <span className="ml-2 text-xs font-medium text-brand">ke minggu ini</span>}
        </button>
        <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Minggu berikutnya" className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-2 hover:text-ink">
          <ChevronRight size={18} />
        </button>
      </div>

      <section {...mover.target(null)} aria-label="Belum dijadwalkan" className={cn('glass rounded-card p-3 transition', mover.isOver(null) && 'ring-2 ring-brand-solid/50')}>
        <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
          Belum dijadwalkan <span className="font-medium normal-case tracking-normal">{unplanned.length}</span>
        </h3>
        {unplanned.length === 0 ? (
          <p className="px-1 text-xs text-ink-faint">Semua udah punya hari. Mantap.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unplanned.map((t) => (
              <MiniCard key={t.id} task={t} picked={mover.picked === t.id} onPick={() => mover.pick(t.id)} drag={mover.card(t.id)} />
            ))}
          </ul>
        )}
        {!mover.picked && unplanned.length > 0 && <p className="mt-2 px-1 text-[11px] text-ink-faint">Seret ke hari, atau ketuk tugas lalu ketuk harinya.</p>}
      </section>

      <div className="grid gap-2 lg:grid-cols-7">
        {days.map((d) => {
          const list = local.filter((t) => t.day === d);
          const load = list.filter((t) => t.status !== 'DONE').reduce((s, t) => s + (t.estimateMin ?? 30), 0);
          const isToday = d === today;
          return (
            <section key={d} {...mover.target(d)} aria-label={label(d, { weekday: 'long', day: 'numeric', month: 'long' })} className={cn('glass min-h-[6rem] rounded-card p-2.5 transition', mover.isOver(d) && 'ring-2 ring-brand-solid/50', isToday && 'ring-1 ring-brand-solid/60', mover.picked && 'cursor-pointer')}>
              <h3 className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <span className={cn('text-xs font-bold', isToday ? 'text-brand' : 'text-ink-soft')} suppressHydrationWarning>
                  {label(d, { weekday: 'short' })} <span className="font-heading text-base text-ink">{label(d, { day: 'numeric' })}</span>
                </span>
                {load > 0 && <span className={cn('text-[11px] tabular', load > cap ? 'font-semibold text-danger' : 'text-ink-faint')}>{effortLabel(load)}</span>}
              </h3>
              <ul className="space-y-1.5">
                {list.map((t) => (
                  <MiniCard key={t.id} task={t} picked={mover.picked === t.id} onPick={() => mover.pick(t.id)} drag={mover.card(t.id)} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
