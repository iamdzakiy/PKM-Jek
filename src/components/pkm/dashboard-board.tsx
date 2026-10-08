'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, ArrowRight, BrainCircuit, CalendarDays, Flame, ListChecks, MapPin, Moon, Rocket, Sparkles, Sunrise, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { CountUp, EASE, Stagger, StaggerItem } from '@/components/motion/primitives';
import { recomputeMyScores } from '@/app/actions/review';
import { cn, formatDate, pct } from '@/lib/utils';
import { FOLDER_HINT, FOLDER_LABEL, type FolderKey, type NoteDTO } from '@/lib/types';
import { NoteCard } from './note-card';
import { FocusTimer } from './focus-timer';
import { ShutdownChecklist } from './shutdown-checklist';

export interface DashboardData {
  greeting: string;
  dateLabel: string;
  counts: Record<FolderKey, number>;
  total: number;
  avgMB: number;
  dueRecall: number;
  openTasks: number;
  nextTask: { id: string; title: string; dueAt: string | null; location: string | null } | null;
  tasks: { id: string; title: string; dueAt: string | null; location: string | null }[];
  events: { id: string; title: string; startAt: string; location: string | null }[];
  lastFocus: NoteDTO[];
  hotTopics: NoteDTO[];
  resurfacing: NoteDTO[];
}

type Mode = 'autopilot' | 'mindfulness';
const MODE_KEY = 'sb-mode';

const SEGMENTS: { key: FolderKey; bar: string }[] = [
  { key: 'LAST_FOCUS', bar: 'bg-brand-solid' },
  { key: 'HOT_TOPICS', bar: 'bg-mint' },
  { key: 'ACTIVE', bar: 'bg-ink-faint' },
  { key: 'TIME_CAPSULE', bar: 'bg-cream ring-1 ring-inset ring-navy/20' },
  { key: 'FORGOTTEN', bar: 'bg-line' },
];

export function DashboardBoard({ data }: { data: DashboardData }) {
  const [mode, setMode] = useState<Mode>('autopilot');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'autopilot' || saved === 'mindfulness') setMode(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-faint" suppressHydrationWarning>
            {data.dateLabel}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-ink sm:text-[30px]" suppressHydrationWarning>
            {data.greeting}
          </h1>
        </div>
        <Segmented
          label="Mode kerja"
          value={mode}
          onChange={changeMode}
          options={[
            { value: 'autopilot', label: 'Autopilot', icon: <Rocket size={14} /> },
            { value: 'mindfulness', label: 'Mindfulness', icon: <Sunrise size={14} /> },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {mode === 'autopilot' ? <Autopilot data={data} /> : <Mindfulness data={data} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Autopilot: only what matters right now ────────────────────────────────

function Autopilot({ data }: { data: DashboardData }) {
  const hidden = data.counts.FORGOTTEN + data.counts.TIME_CAPSULE;
  const empty = data.total === 0;

  return (
    <Stagger className="space-y-5">
      <StaggerItem>
        <Card className="p-6">
          <FocusTimer focusOn={data.nextTask?.title} />
        </Card>
      </StaggerItem>

      <StaggerItem className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Sparkles} label="Last Focus" value={data.counts.LAST_FOCUS} href="/notes" />
        <StatTile icon={BrainCircuit} label="Kuis jatuh tempo" value={data.dueRecall} href="/recall" emphasis={data.dueRecall > 0} />
        <StatTile icon={ListChecks} label="Tugas terbuka" value={data.openTasks} href="/tasks" />
        <StatTile icon={TrendingUp} label="Rata-rata MB" value={pct(data.avgMB)} suffix="%" href="/engine" />
      </StaggerItem>

      <div className="grid gap-5 lg:grid-cols-[1.7fr,1fr]">
        <StaggerItem className="space-y-5">
          <section aria-labelledby="lf-title">
            <SectionTitle id="lf-title" icon={Sparkles} title="Last Focus" hint={FOLDER_HINT.LAST_FOCUS} href="/notes" />
            {data.lastFocus.length === 0 ? (
              <Card>
                <CardDescription>{empty ? 'Belum ada catatan. Tekan Ctrl K untuk menangkap yang pertama.' : 'Tidak ada yang sedang mengambang. Sentuh sebuah catatan agar naik kembali.'}</CardDescription>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.lastFocus.map((n) => (
                  <NoteCard key={n.id} note={n} />
                ))}
              </div>
            )}
          </section>

          {data.hotTopics.length > 0 && (
            <section aria-labelledby="ht-title">
              <SectionTitle id="ht-title" icon={Flame} title="Hot Topics" hint={FOLDER_HINT.HOT_TOPICS} />
              <div className="grid gap-4 sm:grid-cols-2">
                {data.hotTopics.map((n) => (
                  <NoteCard key={n.id} note={n} compact />
                ))}
              </div>
            </section>
          )}
        </StaggerItem>

        <StaggerItem className="space-y-5">
          <Card>
            <CardHeader>
              <ListChecks size={16} className="text-brand" />
              <CardTitle>Tugas mendatang</CardTitle>
            </CardHeader>
            {data.tasks.length === 0 ? (
              <CardDescription>Tidak ada tugas terbuka. Kepala bisa kosong.</CardDescription>
            ) : (
              <ul className="space-y-3">
                {data.tasks.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                      {t.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
                          <MapPin size={11} /> {t.location}
                        </p>
                      )}
                    </div>
                    {t.dueAt && <Badge tone="brand">{formatDate(t.dueAt)}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CalendarDays size={16} className="text-brand" />
              <CardTitle>Acara berikutnya</CardTitle>
            </CardHeader>
            {data.events.length === 0 ? (
              <CardDescription>Tidak ada acara terjadwal.</CardDescription>
            ) : (
              <ul className="space-y-3">
                {data.events.map((e) => (
                  <li key={e.id}>
                    <p className="text-sm font-medium text-ink">{e.title}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {formatDate(e.startAt, { day: 'numeric', month: 'long' })}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {hidden > 0 && (
            <Link
              href="/notes"
              className="flex items-center gap-3 rounded-card border border-dashed border-line px-4 py-3.5 text-sm text-ink-soft transition hover:border-brand-solid/50 hover:text-ink"
            >
              <Archive size={16} className="shrink-0 text-ink-faint" />
              <span>
                <span className="font-semibold text-ink tabular">{hidden}</span> catatan disembunyikan agar fokusmu tetap bersih.
              </span>
            </Link>
          )}
        </StaggerItem>
      </div>
    </Stagger>
  );
}

// ── Mindfulness: shutdown, weekly review, resurfacing ─────────────────────

function Mindfulness({ data }: { data: DashboardData }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const visible = data.counts.LAST_FOCUS + data.counts.HOT_TOPICS;
  const visiblePct = data.total ? Math.round((visible / data.total) * 100) : 0;

  async function recompute() {
    setPending(true);
    try {
      const r = await recomputeMyScores();
      toast({ kind: r.ok ? 'success' : 'error', message: r.message ?? 'Selesai.' });
    } catch {
      toast({ kind: 'error', message: 'Gagal menghitung ulang. Coba lagi.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Stagger className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <Moon size={16} className="text-brand" />
              <div>
                <CardTitle>Daily Shutdown</CardTitle>
                <p className="mt-0.5 text-xs text-ink-faint">15 menit untuk menutup semua loop hari ini</p>
              </div>
            </CardHeader>
            <ShutdownChecklist />
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full">
            <CardHeader className="justify-between">
              <div className="flex items-center gap-2.5">
                <TrendingUp size={16} className="text-brand" />
                <div>
                  <CardTitle>Weekly Review</CardTitle>
                  <p className="mt-0.5 text-xs text-ink-faint">Sebaran memori seluruh catatanmu</p>
                </div>
              </div>
              <Button size="sm" variant="secondary" loading={pending} onClick={recompute}>
                Hitung ulang
              </Button>
            </CardHeader>

            <FolderBar counts={data.counts} total={data.total} />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-2/60 p-3.5">
                <p className="text-xs text-ink-faint">Ruang kerja terlihat</p>
                <p className="mt-1 font-heading text-xl font-bold text-ink">
                  <CountUp value={visiblePct} suffix="%" />
                </p>
                <p className="mt-0.5 text-[11px] text-ink-faint">Target: di bawah 25%</p>
              </div>
              <div className="rounded-xl bg-surface-2/60 p-3.5">
                <p className="text-xs text-ink-faint">Rata-rata MB</p>
                <p className="mt-1 font-heading text-xl font-bold text-ink">
                  <CountUp value={pct(data.avgMB)} suffix="%" />
                </p>
                <p className="mt-0.5 text-[11px] text-ink-faint">{data.total} catatan total</p>
              </div>
            </div>
          </Card>
        </StaggerItem>
      </div>

      <StaggerItem>
        <section aria-labelledby="rs-title">
          <SectionTitle id="rs-title" icon={Archive} title="Layak diangkat kembali" hint="Sudah tenggelam, tetapi Preservation Value-nya tinggi. Sentuh agar naik, atau biarkan jadi Time Capsule." />
          {data.resurfacing.length === 0 ? (
            <Card>
              <CardDescription>Belum ada catatan berharga yang tenggelam. Semua yang penting masih terlihat.</CardDescription>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.resurfacing.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          )}
        </section>
      </StaggerItem>

      <StaggerItem>
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-heading text-[15px] font-semibold text-ink">Active Recall hari ini</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {data.dueRecall > 0 ? `${data.dueRecall} kuis menunggu. Jawab dari ingatan sebelum melihat jawaban.` : 'Tidak ada kuis jatuh tempo.'}
            </p>
          </div>
          <Link href="/recall" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition hover:border-brand-solid/50 hover:bg-brand-soft">
            Buka kuis <ArrowRight size={14} />
          </Link>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}

// ── Shared pieces ─────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  href,
  emphasis,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  suffix?: string;
  href: string;
  emphasis?: boolean;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
      <Link href={href} className="block rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-solid/50">
        <div className="mb-3 flex items-center justify-between">
          <span className={cn('grid h-8 w-8 place-items-center rounded-lg', emphasis ? 'bg-cream text-navy' : 'bg-brand-soft text-brand')}>
            <Icon size={16} />
          </span>
          <ArrowRight size={14} className="text-ink-faint" />
        </div>
        <p className="font-heading text-[28px] font-bold leading-none text-ink">
          <CountUp value={value} suffix={suffix} />
        </p>
        <p className="mt-1.5 text-xs font-medium text-ink-soft">{label}</p>
      </Link>
    </motion.div>
  );
}

function SectionTitle({ id, icon: Icon, title, hint, href }: { id: string; icon: typeof Sparkles; title: string; hint?: string; href?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 font-heading text-[15px] font-semibold text-ink">
          <Icon size={16} className="text-brand" /> {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-[13px] font-medium text-brand hover:underline">
          Semua
        </Link>
      )}
    </div>
  );
}

/** One stacked bar, 2px gaps between segments, every segment named and counted in the legend. */
function FolderBar({ counts, total }: { counts: Record<FolderKey, number>; total: number }) {
  if (total === 0) return <p className="text-sm text-ink-soft">Belum ada data. Tangkap beberapa catatan dulu.</p>;
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={SEGMENTS.map((s) => `${FOLDER_LABEL[s.key]} ${counts[s.key]}`).join(', ')}>
        {SEGMENTS.filter((s) => counts[s.key] > 0).map((s, i) => (
          <motion.div
            key={s.key}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', s.bar)}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: counts[s.key] }}
            style={{ flexBasis: 0 }}
            transition={{ duration: 0.8, delay: 0.1 + i * 0.07, ease: EASE }}
            title={`${FOLDER_LABEL[s.key]}: ${counts[s.key]}`}
          />
        ))}
      </div>
      <ul className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs text-ink-soft">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', s.bar)} aria-hidden="true" />
            <span>{FOLDER_LABEL[s.key]}</span>
            <span className="tabular ml-auto font-semibold text-ink">{counts[s.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

