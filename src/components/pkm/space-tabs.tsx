'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SYSTEM, isActive, spaceOf } from './nav';

/** Sub-tab di atas halaman: halaman lain di ruang yang sama, satu ketukan. */
export function SpaceTabs() {
  const pathname = usePathname();
  const space = spaceOf(pathname);
  const items = space ? space.items : SYSTEM.some((s) => isActive(pathname, s.href)) ? SYSTEM : [];
  if (items.length < 2) return null;
  return (
    <nav aria-label={space ? `Halaman di ${space.label}` : 'Pengaturan'} className="-mx-4 mb-5 overflow-x-auto px-4 scroll-thin sm:mx-0 sm:px-0 md:hidden">
      <ul className="flex w-max gap-1.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href) && !items.some((o) => o.href !== item.href && o.href.length > item.href.length && isActive(pathname, o.href));
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors', active ? 'bg-brand-solid text-white' : 'bg-surface-2/70 text-ink-soft hover:text-ink')}
              >
                <Icon size={15} strokeWidth={active ? 2.3 : 1.9} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
