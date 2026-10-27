import { BrainCircuit, ClipboardCheck, Dumbbell, CalendarCheck, Flower2, Inbox, Radar, Repeat, Timer, TrendingUp, CalendarDays, FolderKanban, Hash, LayoutDashboard, ListChecks, NotebookText, SlidersHorizontal, Settings, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Harian',
    items: [
      { href: '/', label: 'Hari Ini', icon: CalendarCheck },
      { href: '/habits', label: 'Habit', icon: Repeat },
      { href: '/tasks', label: 'Tugas', icon: ListChecks },
      { href: '/training', label: 'Latihan', icon: Dumbbell },
      { href: '/notes', label: 'Catatan', icon: NotebookText },
    ],
  },
  {
    title: 'Fokus',
    items: [
      { href: '/sprints', label: 'Sprint', icon: Timer },
      { href: '/recall', label: 'Recall', icon: BrainCircuit },
      { href: '/admin', label: 'Admin', icon: Inbox },
      { href: '/reset', label: 'Reset', icon: Flower2 },
      { href: '/review', label: 'Review', icon: ClipboardCheck },
      { href: '/progress', label: 'Progres', icon: TrendingUp },
    ],
  },
  {
    title: 'Arsip',
    items: [
      { href: '/projects', label: 'Proyek', icon: FolderKanban },
      { href: '/opportunities', label: 'Peluang', icon: Radar },
      { href: '/topics', label: 'Topik', icon: Hash },
      { href: '/people', label: 'Orang', icon: Users },
      { href: '/events', label: 'Acara', icon: CalendarDays },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { href: '/memory', label: 'Memori', icon: LayoutDashboard },
      { href: '/engine', label: 'Pembobotan', icon: SlidersHorizontal },
      { href: '/settings', label: 'Pengaturan', icon: Settings },
    ],
  },
];

/** Tab bawah di HP: empat tujuan harian, tombol tangkap cepat di tengah. */
export const MOBILE_TABS: NavItem[] = [
  { href: '/', label: 'Hari Ini', icon: CalendarCheck },
  { href: '/habits', label: 'Habit', icon: Repeat },
  { href: '/tasks', label: 'Tugas', icon: ListChecks },
  { href: '/training', label: 'Latihan', icon: Dumbbell },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
