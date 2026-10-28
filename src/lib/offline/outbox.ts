'use client';

import { useSyncExternalStore } from 'react';
import { quickCapture } from '@/app/actions/capture';
import { setTaskStatus } from '@/app/actions/tasks';
import { addTodayTask, deferTask, planTask, toggleHabitToday, toggleTaskDone } from '@/app/actions/today';
import type { ActionResult } from '@/lib/types';

/**
 * Outbox: perubahan yang dibuat saat offline disimpan di perangkat lalu
 * dikirim ulang (berurutan) begitu online. Server action yang sama dipakai
 * untuk kirim langsung maupun kirim ulang, jadi aturannya tetap satu.
 */

type Form = Record<string, string>;
const RUN = {
  habit: (id: string, done: boolean, mini: boolean) => toggleHabitToday(id, done, mini),
  task: (id: string, done: boolean) => toggleTaskDone(id, done),
  status: (id: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE') => setTaskStatus(id, status),
  plan: (id: string, when: 'today' | 'tomorrow' | 'none') => planTask(id, when),
  defer: (id: string, days: number) => deferTask(id, days),
  addToday: (form: Form) => addTodayTask(toFormData(form)),
  capture: (form: Form) => quickCapture(toFormData(form)),
};

export type OpKind = keyof typeof RUN;
type Args<K extends OpKind> = Parameters<(typeof RUN)[K]>;

export interface Op {
  id: string;
  kind: OpKind;
  args: unknown[];
  label: string;
  at: number;
  tries?: number;
}

export type SendResult = ActionResult & { queued?: boolean };

const KEY = 'sc-outbox';
const EVENT = 'sc-outbox';
let cache: Op[] | null = null;
const EMPTY: Op[] = [];

function toFormData(form: Form) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(form)) fd.set(k, v);
  return fd;
}

function read(): Op[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(ops: Op[]) {
  cache = ops;
  try {
    localStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    /* penyimpanan penuh/diblokir: tetap di memori sampai halaman ditutup */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Toggle untuk benda yang sama cukup disimpan yang terakhir. */
function dedupeKey(kind: OpKind, args: unknown[]) {
  return kind === 'habit' || kind === 'task' || kind === 'status' || kind === 'plan' || kind === 'defer' ? `${kind === 'plan' || kind === 'defer' ? 'when' : kind}:${String(args[0])}` : null;
}

function enqueue(kind: OpKind, args: unknown[], label: string) {
  const key = dedupeKey(kind, args);
  const ops = read().filter((o) => !key || dedupeKey(o.kind, o.args) !== key);
  ops.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, kind, args, label, at: Date.now() });
  write(ops);
}

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Gagal karena jaringan (bukan karena server menolak). */
function isNetworkError(e: unknown) {
  return e instanceof TypeError || /fetch|network|load failed|offline/i.test(String((e as Error)?.message ?? e));
}

/** Kirim ke server; kalau offline atau jaringan putus, simpan di outbox dan anggap berhasil. */
export async function send<K extends OpKind>(kind: K, args: Args<K>, label: string): Promise<SendResult> {
  const queued: SendResult = { ok: true, queued: true, message: 'Tersimpan offline. Nanti sync sendiri pas online.' };
  if (isOffline()) {
    enqueue(kind, args, label);
    return queued;
  }
  try {
    return await (RUN[kind] as (...a: unknown[]) => Promise<ActionResult>)(...args);
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    enqueue(kind, args, label);
    return queued;
  }
}

let flushing: Promise<{ sent: number; rejected: string[] }> | null = null;

/** Kirim ulang isi outbox berurutan. Berhenti kalau jaringan putus lagi; yang ditolak server dibuang. */
export function flush() {
  flushing ??= (async () => {
    let sent = 0;
    const rejected: string[] = [];
    for (const op of [...read()]) {
      if (isOffline()) break;
      try {
        const r = await (RUN[op.kind] as (...a: unknown[]) => Promise<ActionResult>)(...op.args);
        if (r.ok) sent++;
        else rejected.push(op.label);
      } catch (e) {
        // Jaringan putus atau sesi habis (server balas halaman login): simpan, coba lagi nanti.
        // Setelah 5 kali gagal baru dibuang supaya satu op rusak tidak menahan antrean selamanya.
        const tries = (op.tries ?? 0) + 1;
        if (isNetworkError(e) || tries < 5) {
          write(read().map((o) => (o.id === op.id ? { ...o, tries } : o)));
          break;
        }
        rejected.push(op.label);
      }
      write(read().filter((o) => o.id !== op.id));
    }
    return { sent, rejected };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useOutbox(): Op[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Tangkap cepat yang tetap jalan offline (dipakai form tangkap & palet). */
export function captureAnywhere(fd: FormData) {
  const form: Form = {};
  fd.forEach((v, k) => {
    if (typeof v === 'string') form[k] = v;
  });
  const first = (form.text ?? '').trim().split('\n')[0].slice(0, 60);
  return send('capture', [form], first || 'Tangkapan');
}
