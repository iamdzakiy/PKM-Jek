'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from './brand-mark';
import { QuickCapture } from './quick-capture';
import { ThemeToggle } from './theme-toggle';
import { AccountBlock, SidebarNav } from './sidebar';
import { ALL_NAV, isActive } from './nav';

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
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === 'c') {
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
