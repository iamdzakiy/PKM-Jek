'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Plus, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from './brand-mark';
import { QuickCapture } from './quick-capture';
import { ThemeToggle } from './theme-toggle';
import { AccountBlock, SidebarNav } from './sidebar';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ALL_NAV, MOBILE_TABS, isActive } from './nav';

export function TopBar({ email }: { email: string }) {
  const pathname = usePathname();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeCapture = useCallback(() => setCaptureOpen(false), []);
  const current = ALL_NAV.find((n) => isActive(pathname, n.href))?.label ?? 'Second Brain';

  useEffect(() => setMenuOpen(false), [pathname]);

  // Ctrl/Cmd+K opens capture from anywhere; plain "c" only when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCaptureOpen(true);
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
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(true)} aria-label="Buka menu" aria-expanded={menuOpen}>
            <Menu size={19} />
          </Button>
          <p className="font-heading text-[15px] font-semibold text-ink">{current}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => setCaptureOpen(true)} aria-keyshortcuts="Control+K">
            <Plus size={15} strokeWidth={2.4} />
            <span className="hidden sm:inline">Tangkap cepat</span>
            <span className="sm:hidden">Baru</span>
            <kbd className="ml-1 hidden rounded bg-white/15 px-1.5 py-0.5 font-sans text-[11px] lg:inline">Ctrl K</kbd>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <QuickCapture open={captureOpen} onClose={closeCapture} />

      {/* Tab bawah ala aplikasi HP: jempol cukup, tanpa buka menu. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label="Navigasi bawah">
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
          {MOBILE_TABS.slice(0, 2).map((t) => (
            <MobileTab key={t.href} href={t.href} label={t.label} icon={t.icon} active={isActive(pathname, t.href)} />
          ))}
          <li className="flex justify-center">
            <button type="button" onClick={() => setCaptureOpen(true)} aria-label="Tangkap cepat" className="-mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-solid text-white shadow-lift transition active:scale-90">
              <Plus size={26} strokeWidth={2.6} />
            </button>
          </li>
          {MOBILE_TABS.slice(2).map((t) => (
            <MobileTab key={t.href} href={t.href} label={t.label} icon={t.icon} active={isActive(pathname, t.href)} />
          ))}
        </ul>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-[60] md:hidden">
            <motion.div className="absolute inset-0 bg-navy/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 border-r border-line bg-surface px-3.5 py-5"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            >
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2.5">
                  <BrandMark size={28} />
                  <span className="font-heading text-[15px] font-bold text-ink">Second Brain</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)} aria-label="Tutup menu">
                  <X size={18} />
                </Button>
              </div>
              <SidebarNav onNavigate={() => setMenuOpen(false)} />
              <AccountBlock email={email} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
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
