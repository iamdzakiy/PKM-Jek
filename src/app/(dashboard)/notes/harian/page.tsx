import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/current-user';
import { jakartaDay } from '@/lib/adhd/progress';
import { dailyNote, isYmd } from '@/lib/notes/daily';

export const dynamic = 'force-dynamic';

/** /notes/harian (hari ini) atau /notes/harian?d=2026-10-27: buka/buat catatan harian. */
export default async function DailyNotePage({ searchParams }: { searchParams: { d?: string } }) {
  const user = await requireUser();
  const ymd = isYmd(searchParams.d) ? searchParams.d : jakartaDay();
  const note = await dailyNote(user.id, ymd);
  redirect(`/notes/${note.id}`);
}
