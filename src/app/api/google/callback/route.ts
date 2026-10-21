import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { exchangeCodeForTokens, fetchGoogleEmail, googleEnvProblem } from '@/lib/google/client';
import { ensureWatchChannel, pullFromGoogle } from '@/lib/google/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * OAuth 2.0 redirect target: exchanges the consent code for tokens, stores the
 * GoogleAccount (keeping the old refresh_token when Google omits it — it only
 * returns one on the first consent), then does an initial 30-day pull and
 * registers the push channel so real-time sync starts immediately.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // carries the app user id from buildAuthUrl
  const back = `${origin}/settings/google`;

  if (!code || !state) return NextResponse.redirect(`${back}?google=error`);
  const envProblem = googleEnvProblem();
  if (envProblem) return NextResponse.redirect(`${back}?google=env`);

  // requireUser resolves (and upserts) the Prisma row for the signed-in
  // Supabase session; middleware.ts already enforced ALLOWED_EMAIL.
  const user = await requireUser().catch(() => null);
  if (!user || user.id !== state) return NextResponse.redirect(`${back}?google=denied`);

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = (await fetchGoogleEmail(tokens.accessToken)) ?? user.email;

    const existing = await prisma.googleAccount.findUnique({ where: { userId: user.id } });
    const account = await prisma.googleAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? '',
        expiresAt: tokens.expiresAt,
      },
      update: {
        email,
        accessToken: tokens.accessToken,
        // Re-consent may not return a refresh_token; keep the stored one.
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
        expiresAt: tokens.expiresAt,
      },
    });
    if (!tokens.refreshToken && !existing?.refreshToken) {
      // Without any refresh token the grant dies in ~1h — surface it loudly.
      console.error('[google] no refresh_token returned; re-connect with a different Google account prompt');
    }

    await pullFromGoogle(user.id).catch((err) => console.error('[google] initial pull failed:', err));
    await ensureWatchChannel(account).catch((err) => console.error('[google] watch registration failed:', err));

    return NextResponse.redirect(`${back}?google=connected`);
  } catch (err) {
    console.error('[google] oauth callback failed:', err);
    return NextResponse.redirect(`${back}?google=error`);
  }
}
