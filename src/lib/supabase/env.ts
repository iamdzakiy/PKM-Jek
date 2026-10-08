/**
 * Guards for the Supabase auth environment.
 *
 * .env is copied from .env.example, which ships placeholder values
 * (`https://YOUR-PROJECT-REF.supabase.co`, `YOUR-ANON-KEY`). Running with
 * those makes every auth call fail DNS resolution and surface as an opaque
 * "fetch failed" on the login form — these helpers translate that into an
 * actionable message instead.
 */

const PLACEHOLDER_MARKERS = ['your-project-ref', 'your-anon-key', 'your-service-role-key'];

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Returns null when the Supabase env is usable, otherwise an Indonesian,
 * user-facing description of what to fix in `.env`.
 */
export function supabaseEnvProblem(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return 'Konfigurasi Supabase belum lengkap: set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env (Supabase → Settings → API), lalu restart dev server.';
  }

  if (isPlaceholder(url) || isPlaceholder(anonKey)) {
    return 'Nilai Supabase di .env masih placeholder (YOUR-PROJECT-REF / YOUR-ANON-KEY). Ganti dengan Project URL dan anon key asli dari Supabase → Settings → API, lalu restart dev server.';
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return `NEXT_PUBLIC_SUPABASE_URL harus memakai https (nilai sekarang: ${url}).`;
    }
  } catch {
    return `NEXT_PUBLIC_SUPABASE_URL bukan URL yang valid: ${url}`;
  }

  return null;
}

/**
 * Reads one string field off an unknown error object. supabase-js errors are
 * `AuthError extends Error` with an extra `code`, but network/mocked errors
 * can be anything, so we probe instead of trusting the type.
 */
function errorField(error: unknown, key: string): string {
  if (typeof error !== 'object' || error === null) return '';
  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Normalizes errors from supabase-js into a message safe to show on the
 * login form. Network failures ("fetch failed", DNS, ECONNREFUSED) mean the
 * request never reached Supabase, so we point at the config instead of
 * echoing the raw undici message. Rate limits (the built-in email provider
 * allows 2 emails/hour and 60s between OTP requests for the same user) get
 * translated too — the raw English "Email rate limit exceeded" says nothing
 * about what to do next.
 */
export function describeAuthError(error: unknown): string {
  const message =
    errorField(error, 'message') ||
    errorField(error, 'msg') ||
    (error instanceof Error ? error.message : '') ||
    (typeof error === 'string' ? error : JSON.stringify(error));

  // Machine-readable cause, e.g. `over_email_send_rate_limit`. Testing
  // `code message` together catches the limit however Supabase words it.
  const haystack = `${errorField(error, 'code')} ${message}`.toLowerCase();

  if (/over_email_send_rate_limit|email rate limit/.test(haystack)) {
    return 'Terlalu banyak link masuk yang diminta. Supabase membatasi 2 email per jam (provider bawaan) — tunggu sekitar 1 jam lalu coba lagi, atau naikkan batasnya di Supabase → Authentication → Rate Limits.';
  }

  if (/over_request_rate_limit|for security purposes/.test(haystack)) {
    return 'Terlalu banyak permintaan berturut-turut. Supabase memberi jeda 60 detik sebelum link masuk berikutnya boleh diminta — tunggu sebentar lalu kirim ulang.';
  }

  if (/fetch failed|failed to fetch|network|enotfound|econnrefused|etimedout|getaddrinfo/i.test(message)) {
    return 'Tidak bisa terhubung ke server Supabase. Periksa NEXT_PUBLIC_SUPABASE_URL di .env (harus Project URL asli, bukan placeholder) lalu coba lagi.';
  }

  return message;
}
