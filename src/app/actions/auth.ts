'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { describeAuthError, supabaseEnvProblem } from '@/lib/supabase/env';

export interface AuthActionState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
}

/**
 * Browser-local guard between two successful sends. Supabase's built-in
 * email provider only allows 2 magic links per hour (and 60s between OTP
 * requests), so a reload-and-resend double click would otherwise burn the
 * quota and trigger "Email rate limit exceeded". This is UX protection, not
 * security: Supabase's own server-side rate limit is what enforces the quota,
 * and the cookie is trivial to clear.
 */
const RESEND_COOLDOWN_COOKIE = 'magic_link_sent_at';
const RESEND_COOLDOWN_MS = 60_000;

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

  const jar = cookies();
  const lastSentAt = Number(jar.get(RESEND_COOLDOWN_COOKIE)?.value);
  const remainingMs = Number.isFinite(lastSentAt) && lastSentAt > 0 ? RESEND_COOLDOWN_MS - (Date.now() - lastSentAt) : 0;
  if (remainingMs > 0) {
    return {
      status: 'error',
      message: `Tunggu ${Math.ceil(remainingMs / 1000)} detik sebelum meminta link masuk baru, ya.`,
    };
  }

  const supabase = createClient();

  // Path-absolute second argument discards any path on the base, so a
  // misconfigured value like "https://x.vercel.app/login" still resolves to
  // the correct callback instead of ".../login/api/auth/callback" (which
  // Supabase would reject as not allow-listed and fall back to Site URL).
  let emailRedirectTo: string;
  try {
    emailRedirectTo = new URL('/api/auth/callback', process.env.NEXT_PUBLIC_SITE_URL?.trim()).toString();
  } catch {
    return {
      status: 'error',
      message: 'NEXT_PUBLIC_SITE_URL belum di-set atau bukan URL valid (contoh: https://pkm-jek.vercel.app, tanpa path).',
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
      },
    });

    if (error) return { status: 'error', message: describeAuthError(error) };
  } catch (err) {
    // Network-level failures (fetch failed) are thrown, not returned.
    return { status: 'error', message: describeAuthError(err) };
  }

  // Writable in Server Actions. Runs only after a send actually succeeded,
  // so a failed attempt never locks the user out of retrying.
  jar.set(RESEND_COOLDOWN_COOKIE, String(Date.now()), {
    path: '/',
    maxAge: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    httpOnly: true,
    sameSite: 'lax',
  });

  return { status: 'sent', message: `Link masuk telah dikirim ke ${email}.` };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  // Previously this returned without navigating, so the button looked dead until the next request.
  redirect('/login');
}
