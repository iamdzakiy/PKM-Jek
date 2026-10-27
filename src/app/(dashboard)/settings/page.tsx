import Link from 'next/link';
import { ArrowUpRight, CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/pkm/page-header';
import { SettingsPanel } from '@/components/pkm/settings-panel';

export const metadata = { title: 'Pengaturan' };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Pengaturan" description="Berlaku di perangkat ini. Atur sekali, lupakan." />
      <SettingsPanel />
      <Link href="/settings/google" className="glass mt-4 flex items-center gap-3 rounded-card px-5 py-4 text-sm transition hover:ring-1 hover:ring-brand/40">
        <CalendarClock size={18} className="shrink-0 text-brand" />
        <span className="flex-1 font-medium text-ink">Google Calendar</span>
        <ArrowUpRight size={15} className="text-ink-faint" />
      </Link>
    </div>
  );
}
