'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Plus, Search, Settings, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from './brand-mark';
import { QuickCapture } from './quick-capture';
import { CommandPalette } from './command-palette';
import { ThemeToggle } from './theme-toggle';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SPACES, pageOf, spaceOf } from './nav';

export function TopBar({ email }: { email: string }) {
  const pathname = usePathname();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const closeCapture = useCallback(() => setCaptureOpen(false), []);
  const space = spaceOf(pathname);
  const current = pageOf(pathname)?.label ?? 'Star Command';

  // Ctrl/Cmd+K (atau "/") membuka satu kotak cari-atau-tangkap; "c" langsung tangkap cepat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCaptureOpen(false);
        setPaletteOpen(true);
      } else if (!typing && e.key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'c' || e.key === ' ')) {
        e.preventDefault();
        setCaptureOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line/60 bg-bg/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" className="md:hidden" aria-label="Star Command, ke Hari Ini">
            <BrandMark size={26} />
          </Link>
          <p className="truncate font-heading text-[15px] font-semibold text-ink">{current}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K" aria-label="Cari">
            <Search size={15} />
            <span className="hidden sm:inline">Cari</span>
            <kbd className="ml-1 hidden rounded bg-surface px-1.5 py-0.5 font-sans text-[11px] text-ink-faint lg:inline">Ctrl K</kbd>
          </Button>
          <Button size="sm" onClick={() => setCaptureOpen(true)} className="hidden md:inline-flex" aria-keyshortcuts="c">
            <Plus size={15} strokeWidth={2.4} />
            Tangkap
          </Button>
          <ThemeToggle />
          <Link href="/settings" aria-label="Pengaturan" title={email} className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink md:hidden">
            <Settings size={18} />
          </Link>
        </div>
      </header>

      <QuickCapture open={captureOpen} onClose={closeCapture} />
      <CommandPalette open={paletteOpen} onClose={closePalette} />

      {/* Tab bawah di HP: 4 ruang, tombol tangkap cepat di tengah. */}
      <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-40 md:hidden" aria-label="Navigasi bawah">
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end rounded-[28px] border border-line/70 bg-surface/95 px-1 shadow-lift">
          {SPACES.slice(0, 2).map((t) => (
            <MobileTab key={t.key} href={t.href} label={t.label} icon={t.icon} active={space?.key === t.key} />
          ))}
          <li className="flex justify-center">
            <button type="button" onClick={() => setCaptureOpen(true)} aria-label="Tangkap cepat" className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-ranger text-white shadow-lift ring-4 ring-bg/70 transition active:scale-90">
              <Plus size={26} strokeWidth={2.6} />
            </button>
          </li>
          {SPACES.slice(2).map((t) => (
            <MobileTab key={t.key} href={t.href} label={t.label} icon={t.icon} active={space?.key === t.key} />
          ))}
        </ul>
      </nav>
    </>
  );
}

function MobileTab({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <li>
      <Link href={href} aria-current={active ? 'page' : undefined} className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors', active ? 'text-brand' : 'text-ink-faint')}>
        <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
        {label}
      </Link>
    </li>
  );
}
