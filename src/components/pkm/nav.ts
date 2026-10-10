import { BrainCircuit, CalendarClock, CalendarDays, FolderKanban, Hash, LayoutDashboard, ListChecks, NotebookText, SlidersHorizontal, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Ruang kerja',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/notes', label: 'Catatan', icon: NotebookText },
      { href: '/tasks', label: 'Tugas', icon: ListChecks },
      { href: '/recall', label: 'Active Recall', icon: BrainCircuit },
    ],
  },
  {
    title: 'Konteks',
    items: [
      { href: '/projects', label: 'Proyek', icon: FolderKanban },
      { href: '/topics', label: 'Topik', icon: Hash },
      { href: '/people', label: 'Orang', icon: Users },
      { href: '/events', label: 'Acara', icon: CalendarDays },
    ],
  },
  {
    title: 'Mesin',
    items: [
      { href: '/engine', label: 'Pembobotan', icon: SlidersHorizontal },
      { href: '/settings/google', label: 'Google Calendar', icon: CalendarClock },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

