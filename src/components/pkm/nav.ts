import { BrainCircuit, ClipboardCheck, Dumbbell, CalendarCheck, Flower2, Inbox, Radar, Repeat, Timer, TrendingUp, CalendarDays, FolderKanban, Hash, LayoutDashboard, ListChecks, NotebookText, SlidersHorizontal, Settings, Users, Sparkles, Sun, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface Space extends NavItem {
  key: string;
  /** halaman di dalam ruang ini; yang pertama = halaman utama ruang */
  items: NavItem[];
}

/**
 * Empat ruang. Semua halaman tetap ada, tapi dikelompokkan supaya yang
 * kelihatan cuma 4 pilihan; sisanya muncul sebagai sub-tab di dalam ruangnya.
 */
export const SPACES: Space[] = [
  {
    key: 'hari',
    href: '/',
    label: 'Hari Ini',
    icon: Sun,
    items: [
      { href: '/', label: 'Hari Ini', icon: CalendarCheck },
      { href: '/habits', label: 'Habit', icon: Repeat },
      { href: '/training', label: 'Latihan', icon: Dumbbell },
    ],
  },
  {
    key: 'tugas',
    href: '/tasks',
    label: 'Tugas',
    icon: ListChecks,
    items: [
      { href: '/tasks', label: 'Tugas', icon: ListChecks },
      { href: '/projects', label: 'Proyek', icon: FolderKanban },
      { href: '/sprints', label: 'Sprint', icon: Timer },
      { href: '/admin', label: 'Admin', icon: Inbox },
      { href: '/opportunities', label: 'Peluang', icon: Radar },
    ],
  },
  {
    key: 'catatan',
    href: '/notes',
    label: 'Catatan',
    icon: NotebookText,
    items: [
      { href: '/notes', label: 'Catatan', icon: NotebookText },
      { href: '/topics', label: 'Topik', icon: Hash },
      { href: '/people', label: 'Orang', icon: Users },
      { href: '/events', label: 'Acara', icon: CalendarDays },
      { href: '/memory', label: 'Memori', icon: LayoutDashboard },
    ],
  },
  {
    key: 'refleksi',
    href: '/review',
    label: 'Refleksi',
    icon: Sparkles,
    items: [
      { href: '/review', label: 'Review', icon: ClipboardCheck },
      { href: '/progress', label: 'Progres', icon: TrendingUp },
      { href: '/recall', label: 'Recall', icon: BrainCircuit },
      { href: '/reset', label: 'Reset', icon: Flower2 },
    ],
  },
];

/** Di luar 4 ruang: dibuka dari ikon gerigi. */
export const SYSTEM: NavItem[] = [
  { href: '/settings', label: 'Pengaturan', icon: Settings },
  { href: '/engine', label: 'Pembobotan', icon: SlidersHorizontal },
];

export const ALL_NAV: NavItem[] = [...SPACES.flatMap((s) => s.items), ...SYSTEM];

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function spaceOf(pathname: string): Space | null {
  return SPACES.find((s) => s.items.some((i) => isActive(pathname, i.href))) ?? null;
}

export function pageOf(pathname: string): NavItem | null {
  return ALL_NAV.find((n) => isActive(pathname, n.href)) ?? null;
}
