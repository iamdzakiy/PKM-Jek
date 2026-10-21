'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { endAdminSweep, logAdminItem } from '@/app/actions/adhd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export interface SweepSource { id: string; name: string; url: string | null }

/** Sesi sweep berbatas waktu: periksa semua sumber, catat satu baris per temuan, lalu tutup. */
export function AdminSweepTimer({ sessionId, startedAt, plannedMin, sources, ended }: { sessionId: string; startedAt: string; plannedMin: number; sources: SweepSource[]; ended: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [left, setLeft] = useState(plannedMin * 60);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ended) return;
    const end = new Date(startedAt).getTime() + plannedMin * 60_000;
    const t = window.setInterval(() => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(t);
  }, [startedAt, plannedMin, ended]);

  async function add() {
    if (!text.trim() || !sourceId || busy) return;
    setBusy(true);
    try {
      const r = await logAdminItem(sessionId, sourceId, text);
      if (!r.ok) throw new Error(r.message);
      setText('');
      router.refresh();
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    } finally {
      setBusy(false);
    }
  }
  async function close() {
    setBusy(true);
    try {
      const r = await endAdminSweep(sessionId);
      toast({ message: r.message ?? 'Selesai.' });
      router.push('/admin');
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
      setBusy(false);
    }
  }

  if (ended) return <p className="text-sm text-ink-soft">Sweep ini sudah selesai.</p>;
  return (
    <div className="space-y-4">
      <p className="tabular font-heading text-4xl font-bold text-ink">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</p>
      <ul className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => { setSourceId(s.id); if (s.url) window.open(s.url, '_blank', 'noopener'); }} aria-pressed={sourceId === s.id} className={`rounded-lg border px-3 py-1.5 text-sm transition ${sourceId === s.id ? 'border-brand-solid bg-brand-soft text-brand' : 'border-line text-ink-soft hover:text-ink'}`}>
              {s.name}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={160} placeholder="Satu baris: apa yang perlu ditindaklanjuti?" aria-label="Temuan" />
        <Button type="submit" loading={busy}>Catat</Button>
      </form>
      <Button variant="secondary" onClick={close} loading={busy}>Tutup sweep</Button>
    </div>
  );
}
