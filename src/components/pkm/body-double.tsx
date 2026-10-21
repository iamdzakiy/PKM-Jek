'use client';

import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { endBodyDouble, pingBodyDouble, startBodyDouble } from '@/app/actions/adhd';
import { Button } from '@/components/ui/button';

/** Body doubling lewat polling 20 detik (tanpa WebSocket). Hanya menampilkan jumlah, bukan siapa. */
export function BodyDouble({ taskTitle }: { taskTitle?: string }) {
  const [id, setId] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [others, setOthers] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;
    const tick = async () => {
      try {
        const r = await pingBodyDouble(id);
        if (r.ok) setOthers(r.others);
      } catch {
        /* abaikan, coba lagi di tick berikutnya */
      }
    };
    tick();
    timer.current = window.setInterval(tick, 20_000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [id]);

  async function join() {
    const r = await startBodyDouble('ruang-fokus', taskTitle);
    if (r.ok && r.id) {
      setId(r.id);
      setRoom(r.roomId ?? null);
    }
  }
  async function leave() {
    if (id) await endBodyDouble(id).catch(() => undefined);
    setId(null);
    setOthers(0);
  }

  if (!id)
    return (
      <Button variant="secondary" size="sm" onClick={join}>
        <Users size={14} /> Temani aku fokus
      </Button>
    );
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-ink-soft" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint" />
      </span>
      {others > 0 ? `${others} orang lain sedang fokus bersamamu` : 'Ruang fokus terbuka. Kamu tidak sendirian di sini.'}
      <button type="button" onClick={leave} className="ml-auto text-xs font-medium text-ink-faint hover:text-ink" aria-label={`Keluar dari ruang ${room ?? ''}`}>
        Keluar
      </button>
    </div>
  );
}
