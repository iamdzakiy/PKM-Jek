'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAdminSweep } from '@/app/actions/adhd';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export function AdminStartButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await startAdminSweep(20);
      if (!r.ok || !r.href) throw new Error();
      router.push(r.href);
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
      setBusy(false);
    }
  }
  return <Button onClick={go} loading={busy} disabled={disabled}>Mulai sweep 20 menit</Button>;
}
