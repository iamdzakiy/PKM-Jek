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
 * Normalizes errors from supabase-js into a message safe to show on the
 * login form. Network failures ("fetch failed", DNS, ECONNREFUSED) mean the
 * request never reached Supabase, so we point at the config instead of
 * echoing the raw undici message.
 */
export function describeAuthError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : // supabase-js's own _getErrorMessage checks `msg` before `message`.
          typeof error === 'object' && error !== null && 'msg' in error
          ? String((error as { msg: unknown }).msg)
          : JSON.stringify(error);

  if (/fetch failed|failed to fetch|network|enotfound|econnrefused|etimedout|getaddrinfo/i.test(message)) {
    return 'Tidak bisa terhubung ke server Supabase. Periksa NEXT_PUBLIC_SUPABASE_URL di .env (harus Project URL asli, bukan placeholder) lalu coba lagi.';
  }

  return message;
}
