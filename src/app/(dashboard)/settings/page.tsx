import Link from 'next/link';
import { ArrowUpRight, CalendarClock, DatabaseBackup, FileDown, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/pkm/page-header';
import { SettingsPanel } from '@/components/pkm/settings-panel';
import { SignOutButton } from '@/components/pkm/sidebar';

export const metadata = { title: 'Pengaturan' };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Pengaturan" description="Berlaku di perangkat ini. Atur sekali, lupakan." />
      <SettingsPanel />
      <section className="glass mt-4 rounded-card p-5" aria-label="Data dan backup">
        <h2 className="font-heading text-[15px] font-semibold text-ink">Data & backup</h2>
        <p className="mt-1 text-xs text-ink-faint">Simpan salinan di Drive atau laptop, buat jaga-jaga kalau ada apa-apa.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <a href="/export?what=all" download className="flex items-center gap-3 rounded-2xl bg-brand-solid px-4 py-3 text-white transition hover:brightness-110">
            <DatabaseBackup size={20} className="shrink-0" />
            <span>
              <span className="block text-sm font-semibold">Unduh semua data</span>
              <span className="block text-xs text-white/75">Backup lengkap (.zip)</span>
            </span>
          </a>
          <a href="/export" download className="flex items-center gap-3 rounded-2xl bg-surface-2/70 px-4 py-3 text-ink transition hover:bg-surface-2">
            <FileDown size={20} className="shrink-0 text-brand" />
            <span>
              <span className="block text-sm font-semibold">Catatan saja</span>
              <span className="block text-xs text-ink-faint">Markdown, bisa dibuka di Obsidian</span>
            </span>
          </a>
        </div>
      </section>
      <Link href="/settings/google" className="glass mt-4 flex items-center gap-3 rounded-card px-5 py-4 text-sm transition hover:ring-1 hover:ring-brand/40">
        <CalendarClock size={18} className="shrink-0 text-brand" />
        <span className="flex-1 font-medium text-ink">Google Calendar</span>
        <ArrowUpRight size={15} className="text-ink-faint" />
      </Link>
      <Link href="/engine" className="glass mt-2 flex items-center gap-3 rounded-card px-5 py-4 text-sm transition hover:ring-1 hover:ring-brand/40">
        <SlidersHorizontal size={18} className="shrink-0 text-brand" />
        <span className="flex-1 font-medium text-ink">Pembobotan prioritas</span>
        <ArrowUpRight size={15} className="text-ink-faint" />
      </Link>
      <div className="glass mt-2 flex items-center gap-3 rounded-card py-2 pl-5 pr-2 text-sm">
        <span className="flex-1 font-medium text-ink">Keluar dari akun</span>
        <SignOutButton />
      </div>
    </div>
  );
}
