'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { BrandMark } from './brand-mark';
import { SPACES, isActive, spaceOf } from './nav';

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form
      action={signOut}
      onSubmit={() => {
        // Hapus salinan halaman & antrean offline dari perangkat saat keluar.
        navigator.serviceWorker?.controller?.postMessage('clear');
        try {
          localStorage.removeItem('sc-outbox');
        } catch {}
      }}
    >
      <button type="submit" title="Keluar" aria-label="Keluar" className={cn('grid h-9 w-9 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger', className)}>
        <LogOut size={16} />
      </button>
    </form>
  );
}

/** Sidebar desktop: 4 ruang; ruang yang aktif membuka daftar halamannya. Tanpa animasi layout supaya ringan. */
export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const current = spaceOf(pathname);
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-5 border-r border-line/60 bg-surface/40 px-3 py-5 md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2" aria-label="Star Command, ke Hari Ini">
        <BrandMark size={28} />
        <span className="font-heading text-[15px] font-bold tracking-tight text-ink">Star Command</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scroll-thin" aria-label="Navigasi utama">
        {SPACES.map((space) => {
          const open = current?.key === space.key;
          const Icon = space.icon;
          return (
            <div key={space.key}>
              <Link
                href={space.href}
                aria-current={open && isActive(pathname, space.href) ? 'page' : undefined}
                className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors', open ? 'bg-brand-soft text-ink' : 'text-ink-soft hover:bg-surface-2/60 hover:text-ink')}
              >
                <Icon size={18} strokeWidth={open ? 2.3 : 1.9} className={open ? 'text-brand' : ''} />
                {space.label}
              </Link>
              {open && space.items.length > 1 && (
                <ul className="mb-2 ml-[22px] mt-1 space-y-0.5 border-l border-line pl-3">
                  {space.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link href={item.href} aria-current={active ? 'page' : undefined} className={cn('block rounded-lg px-2.5 py-1.5 text-sm transition-colors', active ? 'font-semibold text-brand' : 'text-ink-soft hover:text-ink')}>
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/40 p-1.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-solid text-[13px] font-bold uppercase text-white" aria-hidden="true">
          {email.slice(0, 1)}
        </div>
        <p className="min-w-0 flex-1 truncate px-1 text-xs text-ink-soft">{email}</p>
        <Link href="/settings" title="Pengaturan" aria-label="Pengaturan" className={cn('grid h-9 w-9 place-items-center rounded-xl transition-colors hover:bg-surface-2 hover:text-ink', isActive(pathname, '/settings') || isActive(pathname, '/engine') ? 'text-brand' : 'text-ink-soft')}>
          <Settings size={16} />
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}
