'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Badge, type Tone } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EASE } from '@/components/motion/primitives';
import { INTERACTION_WEIGHTS, PV_WEIGHTS, THRESHOLDS, categorizeIntoFolder, computeMemoryBuoyancy } from '@/lib/memory/scoring';
import { FOLDER_HINT, FOLDER_LABEL, type FolderKey } from '@/lib/types';
import { cn, pct } from '@/lib/utils';

const DAY = 86_400_000;
const BASE = new Date('2026-01-01T00:00:00Z').getTime();
const SPAN = 30;

// A sample note: created on day 0, edited on day 2, answered correctly in a recall on day 5.
const SAMPLE = [
  { id: 'create', label: 'Dibuat', type: 'CREATE', day: 0 },
  { id: 'edit', label: 'Diedit', type: 'EDIT', day: 2 },
  { id: 'recall', label: 'Kuis benar', type: 'COMMENT', day: 5 },
] as const;

const PV_TERMS = [
  { key: 'UI', label: 'Investasi (UI)' },
  { key: 'G', label: 'Gravitasi (G)' },
  { key: 'SG', label: 'Social Graph (SG)' },
  { key: 'P', label: 'Popularitas (P)' },
  { key: 'C', label: 'Coverage (C)' },
  { key: 'Q', label: 'Quality (Q)' },
] as const;
type PvKey = (typeof PV_TERMS)[number]['key'];

const FOLDER_TONE: Record<FolderKey, Tone> = { LAST_FOCUS: 'brand', HOT_TOPICS: 'warn', ACTIVE: 'neutral', TIME_CAPSULE: 'cream', FORGOTTEN: 'neutral' };

// Chart geometry
const W = 640;
const H = 250;
const M = { l: 42, r: 14, t: 14, b: 30 };
const x = (day: number) => M.l + (day / SPAN) * (W - M.l - M.r);
const y = (v: number) => H - M.b - v * (H - M.t - M.b);

function AnimatedPercent({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(value, { stiffness: 140, damping: 22 });
  const text = useTransform(spring, (v) => `${Math.round(v)}`);
  useEffect(() => spring.set(value), [value, spring]);
  return <motion.span className={cn('tabular', className)}>{text}</motion.span>;
}

export function EngineLab() {
  const [lambda, setLambda] = useState(0.1);
  const [day, setDay] = useState(8);
  const [active, setActive] = useState<Record<string, boolean>>({ create: true, edit: true, recall: true });
  const [pv, setPv] = useState<Record<PvKey, number>>({ UI: 0.4, G: 0.4, SG: 0.2, P: 0.3, C: 0.5, Q: 0.5 });

  const interactions = useMemo(
    () => SAMPLE.filter((s) => active[s.id]).map((s) => ({ type: s.type, createdAt: new Date(BASE + s.day * DAY) })),
    [active]
  );

  const mbAt = (d: number) => computeMemoryBuoyancy(interactions, new Date(BASE + d * DAY), lambda);

  const points = useMemo(() => Array.from({ length: SPAN * 2 + 1 }, (_, i) => ({ d: i / 2, v: computeMemoryBuoyancy(interactions, new Date(BASE + (i / 2) * DAY), lambda) })), [interactions, lambda]);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.d).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(SPAN)} ${y(0)} L${x(0)} ${y(0)} Z`;

  const pvTotal = (Object.keys(PV_WEIGHTS) as PvKey[]).reduce((sum, k) => sum + PV_WEIGHTS[k] * pv[k], 0);
  const mbNow = mbAt(day);
  const lastTouch = interactions.length ? Math.max(...interactions.map((i) => (i.createdAt.getTime() - BASE) / DAY)) : null;
  const folder = categorizeIntoFolder({
    memoryBuoyancy: mbNow,
    preservationValue: pvTotal,
    lastInteractionAt: lastTouch === null ? null : new Date(BASE + lastTouch * DAY),
    hasHotTopic: false,
    now: new Date(BASE + day * DAY),
  }) as FolderKey;

  const halfLife = Math.log(2) / lambda;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
      <Card className="p-0">
        <div className="p-5 pb-3">
          <CardHeader className="mb-2">
            <CardTitle>Memory Buoyancy</CardTitle>
          </CardHeader>
          <p className="rounded-lg bg-surface-2/70 px-3 py-2 font-mono text-[12.5px] text-ink">
            MB = 1 − e<sup>−Σ wᵢ · e<sup>−λ·Δtᵢ</sup></sup>
          </p>
          <CardDescription className="mt-3">
            Setiap interaksi menyumbang bobotnya lalu meluruh seiring hari. Geser λ untuk melihat seberapa cepat catatan tenggelam tanpa disentuh lagi.
          </CardDescription>
        </div>

        <div className="px-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Kurva Memory Buoyancy selama ${SPAN} hari. Pada hari ke-${day}, nilainya ${pct(mbNow)} persen.`}>
            {[0, THRESHOLDS.forgottenMB, THRESHOLDS.focusMB, 1].map((g) => (
              <g key={g}>
                <line x1={M.l} x2={W - M.r} y1={y(g)} y2={y(g)} stroke="rgb(var(--line))" strokeDasharray={g === 0 || g === 1 ? undefined : '4 4'} />
                <text x={M.l - 8} y={y(g) + 4} textAnchor="end" className="fill-ink-faint text-[10px]">
                  {Math.round(g * 100)}%
                </text>
              </g>
            ))}
            <text x={W - M.r - 4} y={y(THRESHOLDS.focusMB) - 5} textAnchor="end" className="fill-ink-faint text-[10px]">
              Last Focus di atas {Math.round(THRESHOLDS.focusMB * 100)}%
            </text>
            <text x={W - M.r - 4} y={y(THRESHOLDS.forgottenMB) + 13} textAnchor="end" className="fill-ink-faint text-[10px]">
              Forgotten di bawah {Math.round(THRESHOLDS.forgottenMB * 100)}%
            </text>
            {[0, 5, 10, 15, 20, 25, 30].map((d) => (
              <text key={d} x={x(d)} y={H - 10} textAnchor="middle" className="fill-ink-faint text-[10px]">
                {d === 0 ? 'hari 0' : d}
              </text>
            ))}

            <motion.path d={area} fill="rgb(var(--brand-solid))" fillOpacity={0.14} animate={{ d: area }} transition={{ duration: 0.35, ease: EASE }} />
            <motion.path d={line} fill="none" stroke="rgb(var(--brand))" strokeWidth={2} strokeLinejoin="round" animate={{ d: line }} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.35, ease: EASE, pathLength: { duration: 1.1, ease: EASE } }} />

            {SAMPLE.filter((s) => active[s.id]).map((s) => (
              <g key={s.id}>
                <circle cx={x(s.day)} cy={y(mbAt(s.day))} r={4} fill="rgb(var(--surface))" stroke="rgb(var(--brand))" strokeWidth={2} />
              </g>
            ))}

            <line x1={x(day)} x2={x(day)} y1={M.t} y2={H - M.b} stroke="rgb(var(--mint))" strokeWidth={1.5} />
            <circle cx={x(day)} cy={y(mbNow)} r={5.5} fill="rgb(var(--mint))" stroke="rgb(var(--surface))" strokeWidth={2} />
          </svg>
        </div>

        <div className="space-y-5 border-t border-line p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ink-faint">Hari ke-{day}</p>
              <p className="font-heading text-3xl font-bold text-ink">
                <AnimatedPercent value={pct(mbNow)} />
                <span className="text-lg text-ink-soft">%</span>
              </p>
            </div>
            <div className="text-right">
              <Badge tone={FOLDER_TONE[folder]}>{FOLDER_LABEL[folder]}</Badge>
              <p className="mt-1.5 max-w-[220px] text-xs text-ink-faint">{FOLDER_HINT[folder]}</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="day" className="text-xs font-medium text-ink-soft">
                  Hari yang dilihat
                </label>
                <span className="tabular text-xs font-semibold text-ink">{day}</span>
              </div>
              <input id="day" type="range" min={0} max={SPAN} step={1} value={day} onChange={(e) => setDay(Number(e.target.value))} className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--mint))]" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="lambda" className="text-xs font-medium text-ink-soft">
                  Peluruhan λ
                </label>
                <span className="tabular text-xs font-semibold text-ink">
                  {lambda.toFixed(2)} · separuh nilai tiap {halfLife.toFixed(1)} hari
                </span>
              </div>
              <input id="lambda" type="range" min={0.02} max={0.4} step={0.01} value={lambda} onChange={(e) => setLambda(Number(e.target.value))} className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--brand-solid))]" />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-ink-soft">Riwayat interaksi catatan contoh</legend>
            <div className="flex flex-wrap gap-2">
              {SAMPLE.map((s) => (
                <label
                  key={s.id}
                  className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition', active[s.id] ? 'border-brand-solid bg-brand-soft text-brand' : 'border-line text-ink-soft hover:border-brand-solid/50')}
                >
                  <input type="checkbox" checked={active[s.id]} onChange={(e) => setActive((a) => ({ ...a, [s.id]: e.target.checked }))} className="sr-only" />
                  {s.label}
                  <span className="text-[10px] opacity-70">
                    hari {s.day} · w {INTERACTION_WEIGHTS[s.type]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card>
        <CardHeader className="mb-2">
          <CardTitle>Preservation Value</CardTitle>
        </CardHeader>
        <p className="rounded-lg bg-surface-2/70 px-3 py-2 font-mono text-[12px] leading-relaxed text-ink">PV = 0.25·UI + 0.20·G + 0.15·SG + 0.15·P + 0.15·C + 0.10·Q</p>
        <CardDescription className="mt-3">
          Nilai jangka panjang. PV {Math.round(THRESHOLDS.capsulePV * 100)}% ke atas menyelamatkan catatan dari Forgotten dan memindahkannya ke Time Capsule saat MB sudah tenggelam.
        </CardDescription>

        <div className="mt-5 flex items-end justify-between">
          <p className="text-xs text-ink-faint">Hasil</p>
          <p className="font-heading text-4xl font-bold text-ink">
            <AnimatedPercent value={pct(pvTotal)} />
            <span className="text-xl text-ink-soft">%</span>
          </p>
        </div>

        <ul className="mt-4 space-y-4">
          {PV_TERMS.map((t) => (
            <li key={t.key}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <label htmlFor={`pv-${t.key}`} className="font-medium text-ink">
                  {t.label} <span className="font-normal text-ink-faint">× {Math.round(PV_WEIGHTS[t.key] * 100)}%</span>
                </label>
                <span className="tabular text-ink-soft">
                  {pct(pv[t.key])}% → +{(PV_WEIGHTS[t.key] * pv[t.key] * 100).toFixed(1)}
                </span>
              </div>
              <input
                id={`pv-${t.key}`}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={pv[t.key]}
                onChange={(e) => setPv((cur) => ({ ...cur, [t.key]: Number(e.target.value) }))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--mint))]"
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
