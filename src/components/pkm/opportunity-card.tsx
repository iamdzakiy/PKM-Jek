'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { chunkOpportunity, updateOpportunityStatus } from '@/app/actions/adhd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { radarLabel } from '@/lib/adhd/urgency';

export interface OpportunityDTO {
  id: string;
  title: string;
  source: string | null;
  url: string | null;
  handoverDate: string;
  status: 'WATCHING' | 'APPLYING' | 'SUBMITTED' | 'ARCHIVED';
}

const STATUS_LABEL = { WATCHING: 'Dipantau', APPLYING: 'Diajukan', SUBMITTED: 'Terkirim', ARCHIVED: 'Diarsipkan' } as const;

export function OpportunityCard({ opp }: { opp: OpportunityDTO }) {
  const toast = useToast();
  const router = useRouter();
  const radar = radarLabel(opp.handoverDate);

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    try {
      const r = await fn();
      if (!r.ok) throw new Error();
      if (r.message) toast({ message: r.message });
      router.refresh();
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{opp.title}</p>
          <p className="mt-0.5 text-xs text-ink-faint">{[opp.source, STATUS_LABEL[opp.status]].filter(Boolean).join(' · ')}</p>
        </div>
        <Badge tone={radar.tone}>{radar.label}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {opp.status === 'WATCHING' && <Button size="sm" onClick={() => run(() => chunkOpportunity(opp.id))}>Pecah jadi langkah</Button>}
        {opp.status === 'APPLYING' && <Button size="sm" variant="secondary" onClick={() => run(() => updateOpportunityStatus(opp.id, 'SUBMITTED'))}>Sudah terkirim</Button>}
        {opp.url && (
          <a href={opp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            Buka <ExternalLink size={11} />
          </a>
        )}
        {opp.status !== 'ARCHIVED' && (
          <button type="button" onClick={() => run(() => updateOpportunityStatus(opp.id, 'ARCHIVED'))} className="ml-auto text-xs text-ink-faint hover:text-ink">
            Arsipkan
          </button>
        )}
      </div>
    </li>
  );
}
