import { cache } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase/server';

/**
 * Resolves the signed-in Supabase user to the app's Prisma `User` row,
 * creating it on first sign-in. Wrapped in React `cache` so the layout and the
 * page of one request share a single lookup instead of upserting twice.
 * middleware.ts already blocks anyone but ALLOWED_EMAIL.
 */
export const requireUser = cache(async () => {
  const authUser = await getUser();
  if (!authUser) redirect('/login');

  return prisma.user.upsert({
    where: { id: authUser.id },
    update: { email: authUser.email ?? undefined },
    create: {
      id: authUser.id,
      email: authUser.email ?? 'unknown@local',
      name: authUser.user_metadata?.full_name ?? null,
    },
  });
});
