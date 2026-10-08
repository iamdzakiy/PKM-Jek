'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { describeAuthError, supabaseEnvProblem } from '@/lib/supabase/env';

export interface AuthActionState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
}

/**
 * Sends a magic link. We never expose a password field: a link emailed to
 * the one inbox you control is simpler to keep private than a password.
 * Even if someone requests a link for another address, middleware.ts still
 * blocks any session whose email isn't ALLOWED_EMAIL.
 */
export async function sendMagicLink(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase().trim();

  if (!email) return { status: 'error', message: 'Masukkan alamat email.' };
  if (allowed && email !== allowed) {
    return { status: 'error', message: 'Alamat ini tidak diizinkan mengakses aplikasi private ini.' };
  }

  // Fail fast with an actionable message when .env still holds the
  // .env.example placeholders; otherwise the request to
  // https://YOUR-PROJECT-REF.supabase.co dies as an opaque "fetch failed".
  const envProblem = supabaseEnvProblem();
  if (envProblem) return { status: 'error', message: envProblem };

  const supabase = createClient();
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
      },
    });

    if (error) return { status: 'error', message: describeAuthError(error) };
  } catch (err) {
    // Network-level failures (fetch failed) are thrown, not returned.
    return { status: 'error', message: describeAuthError(err) };
  }

  return { status: 'sent', message: `Link masuk telah dikirim ke ${email}.` };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  // Previously this returned without navigating, so the button looked dead until the next request.
  redirect('/login');
}
