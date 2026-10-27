import { BrainCircuit, CalendarCheck, Flower2, Inbox, Radar, Repeat, Timer, TrendingUp, CalendarClock, CalendarDays, FolderKanban, Hash, LayoutDashboard, ListChecks, NotebookText, SlidersHorizontal, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Utama',
    items: [
      { href: '/', label: 'Hari Ini', icon: CalendarCheck },
      { href: '/habits', label: 'Habit', icon: Repeat },
      { href: '/tasks', label: 'Tugas', icon: ListChecks },
      { href: '/notes', label: 'Catatan', icon: NotebookText },
    ],
  },
  {
    title: 'Ritme',
    items: [
      { href: '/progress', label: 'Progres', icon: TrendingUp },
      { href: '/sprints', label: 'Sprint', icon: Timer },
      { href: '/reset', label: 'Reset', icon: Flower2 },
      { href: '/admin', label: 'Admin', icon: Inbox },
      { href: '/opportunities', label: 'Peluang', icon: Radar },
    ],
  },
  {
    title: 'Lainnya',
    items: [
      { href: '/recall', label: 'Active Recall', icon: BrainCircuit },
      { href: '/projects', label: 'Proyek', icon: FolderKanban },
      { href: '/topics', label: 'Topik', icon: Hash },
      { href: '/people', label: 'Orang', icon: Users },
      { href: '/events', label: 'Acara', icon: CalendarDays },
      { href: '/memory', label: 'Memori', icon: LayoutDashboard },
      { href: '/engine', label: 'Pembobotan', icon: SlidersHorizontal },
      { href: '/settings/google', label: 'Google Calendar', icon: CalendarClock },
    ],
  },
];

/** Tab bawah di HP: empat tujuan harian, tombol tangkap cepat di tengah. */
export const MOBILE_TABS: NavItem[] = [
  { href: '/', label: 'Hari Ini', icon: CalendarCheck },
  { href: '/habits', label: 'Habit', icon: Repeat },
  { href: '/tasks', label: 'Tugas', icon: ListChecks },
  { href: '/progress', label: 'Progres', icon: TrendingUp },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
