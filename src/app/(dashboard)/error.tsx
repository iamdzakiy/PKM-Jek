'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
      <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={20} />
      </div>
      <h1 className="font-heading text-lg font-semibold text-ink">Halaman ini gagal dimuat</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Biasanya koneksi database sedang bermasalah. Datamu aman, coba muat ulang.</p>
      {error.digest && <p className="mt-3 text-xs text-ink-faint">Kode: {error.digest}</p>}
      <Button className="mt-5" onClick={reset}>
        Coba lagi
      </Button>
    </div>
  );
}
