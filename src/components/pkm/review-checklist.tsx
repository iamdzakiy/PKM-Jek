'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { finishWeeklyReview } from '@/app/actions/plan';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'inbox', label: 'Kosongkan inbox', hint: 'Tiap item: hari ini, besok, atau lepas.', href: '/' },
  { id: 'admin', label: 'Sapu kotak masuk', hint: 'WA, email, LINE, Edunex sekali jalan.', href: '/admin' },
  { id: 'calendar', label: 'Lihat kalender minggu depan', hint: 'Rapat, deadline, UTS. Itu batu besarnya.', href: '/events' },
  { id: 'deep', label: 'Pilih 2–3 blok deep work 90 menit', hint: 'Tulis di kotak Minggu ini.' },
  { id: 'projects', label: 'Cek peran dan proyek', hint: 'Maks 3 yang benar-benar aktif.', href: '/projects' },
  { id: 'win', label: 'Sebut 1 kemenangan minggu ini', hint: 'Sekecil apa pun.' },
];

/** Ceklis review per minggu, disimpan di perangkat ini saja. */
export function ReviewChecklist({ week, inbox }: { week: string; inbox: number }) {
  const key = `sc-review-${week}`;
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) ?? '[]'));
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }, [key]);
  function toggle(id: string) {
    setDone((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* abaikan */
      }
      return next;
    });
  }

  return (
    <Card>
      <CardTitle className="mb-3">Langkah review</CardTitle>
      <ul className="space-y-1">
        {STEPS.map((s) => {
          const on = done.includes(s.id);
          return (
            <li key={s.id} className="flex items-start gap-3 rounded-xl px-1 py-1.5">
              <button type="button" role="checkbox" aria-checked={on} aria-label={s.label} onClick={() => toggle(s.id)} className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition', on ? 'border-ranger bg-ranger text-white' : 'border-ink-faint/40 hover:border-ranger')}>
                {on && <Check size={14} strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', on ? 'text-ink-faint line-through' : 'text-ink')}>
                  {s.href ? (
                    <Link href={s.href} className="hover:text-brand">
                      {s.label}
                    </Link>
                  ) : (
                    s.label
                  )}
                  {s.id === 'inbox' && inbox > 0 && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-xs text-ink-soft">{inbox}</span>}
                </p>
                <p className="text-xs text-ink-faint">{s.hint}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <ActionForm action={finishWeeklyReview} className="mt-4">
        <SubmitButton className="w-full bg-ranger">Review selesai, rapikan arsip</SubmitButton>
      </ActionForm>
    </Card>
  );
}
