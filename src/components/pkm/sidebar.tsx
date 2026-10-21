'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { BrandMark } from './brand-mark';
import { NAV_GROUPS, isActive } from './nav';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto scroll-thin" aria-label="Navigasi utama">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{group.title}</p>
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'text-ink' : 'text-ink-soft hover:text-ink'
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-lg bg-brand-soft"
                        transition={{ type: 'spring', stiffness: 460, damping: 38 }}
                      />
                    )}
                    {active && (
                      <motion.span
                        layoutId="sidebar-bar"
                        className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-brand-solid"
                        transition={{ type: 'spring', stiffness: 460, damping: 38 }}
                      />
                    )}
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.9} className={cn('relative z-10 transition-colors', active ? 'text-brand' : 'group-hover:text-ink')} />
                    <span className="relative z-10">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AccountBlock({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/50 p-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-solid text-[13px] font-bold uppercase text-white" aria-hidden="true">
        {email.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{email}</p>
        <p className="text-[11px] text-ink-faint">Ruang privat</p>
      </div>
      <form action={signOut}>
        <button type="submit" title="Keluar" aria-label="Keluar" className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-danger-soft hover:text-danger">
          <LogOut size={15} />
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-line bg-surface px-3.5 py-5 md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2" aria-label="Second Brain, ke dashboard">
        <BrandMark size={30} />
        <span className="font-heading text-[15px] font-bold tracking-tight text-ink">Second Brain</span>
      </Link>
      <SidebarNav />
      <AccountBlock email={email} />
    </aside>
  );
}
