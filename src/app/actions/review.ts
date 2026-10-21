'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/current-user';
import { refreshAllScores } from '@/lib/memory/refresh';
import type { ActionResult } from '@/lib/types';

/** Weekly review: recalculate MB, PV and folders for the whole vault on demand. */
export async function recomputeMyScores(): Promise<ActionResult> {
  const user = await requireUser();
  const count = await refreshAllScores(user.id);
  revalidatePath('/');
  revalidatePath('/notes');
  return { ok: true, message: `${count} catatan dihitung ulang.` };
}
