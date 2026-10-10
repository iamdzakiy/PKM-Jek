import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * This is what makes the app private. It runs on every request:
 *  1. Refreshes the Supabase session cookie (required by @supabase/ssr).
 *  2. If there's no session, and the request isn't for /login or an asset,
 *     redirect to /login.
 *  3. If there IS a session but its email isn't ALLOWED_EMAIL, sign it out
 *     and redirect to /login?denied=1 — so even if someone else creates a
 *     Supabase account, or a leaked session cookie is replayed, they never
 *     see your data.
 */
export async function middleware(request: NextRequest) {
  // The cron endpoints authenticate themselves with a bearer secret, and the
  // Google webhook authenticates with the channel token it mints at watch
  // registration — without these bypasses the redirect to /login swallowed
  // every scheduled call and every push from Google.
  if (request.nextUrl.pathname.startsWith('/api/recompute-scores')) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/api/google/renew-watch')) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/api/google/webhook')) return NextResponse.next();

  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/api/auth');

  const allowedEmail = process.env.ALLOWED_EMAIL?.toLowerCase().trim();

  // Redirects must carry any refreshed session cookies set on `response`.
  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return redirectTo(url);
  }

  if (user && allowedEmail && user.email?.toLowerCase() !== allowedEmail) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('denied', '1');
    return redirectTo(url);
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return redirectTo(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images, so the check above
     * runs for pages and API routes but not for _next/static, favicon, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
