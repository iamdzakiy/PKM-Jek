import { prisma } from '@/lib/prisma';
import type { GoogleAccount } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────
// Google Calendar REST + OAuth 2.0 (authorization-code flow with a refresh
// token). Implemented over plain `fetch` instead of the `googleapis` SDK —
// this app only needs six endpoints, and keeping the dependency surface at
// zero means the bundle and the audit list stay small.
//
// Scopes: `calendar.events` is enough for everything we do — insert / patch /
// delete events, events.list with a syncToken, and events.watch on a single
// calendar. We deliberately do NOT ask for full `calendar` scope.
// ─────────────────────────────────────────────────────────────────────────

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://www.googleapis.com/calendar/v3';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events openid email';

export function googleEnvProblem(): string | null {
  const missing = (['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const).filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    return `Konfigurasi Google Calendar belum lengkap: set ${missing.join(', ')} di .env (Google Cloud Console → Credentials), lalu restart dev server.`;
  }
  return null;
}

/** Where Google sends the user back after consent. Must exactly match the URI registered in the console. */
export function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${process.env.NEXT_PUBLIC_SITE_URL?.trim()}/api/google/callback`;
}

/**
 * Authorization URL for /settings/google → "Hubungkan". `state` carries the
 * app user id so the callback can bind the grant to the right row.
 */
export function buildAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline', // required for a refresh_token
    prompt: 'consent', // force the consent screen so Google actually returns a refresh_token
    state: userId,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      ...body,
    }),
    cache: 'no-store',
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Google token endpoint ${res.status}: ${json.error_description ?? json.error ?? 'unknown error'}`);
  }
  return json;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null; // null on re-consent — Google only returns it once
  expiresAt: Date;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenSet> {
  const json = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  return {
    accessToken: String(json.access_token),
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresAt: new Date(Date.now() + Number(json.expires_in ?? 3600) * 1000),
  };
}

/** Best-effort lookup of the Google account email for the settings screen. */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  if (!res.ok) return null;
  const json = (await res.json()) as { email?: string };
  return json.email ?? null;
}

/**
 * Returns a currently-valid access token, transparently refreshing and
 * persisting the new one when the stored one is expired (or about to —
 * 60s of headroom so a slow request doesn't trip over the expiry mid-flight).
 */
export async function getAccessToken(account: GoogleAccount): Promise<string> {
  if (account.accessToken && account.expiresAt.getTime() - 60_000 > Date.now()) {
    return account.accessToken;
  }
  const json = await tokenRequest({ grant_type: 'refresh_token', refresh_token: account.refreshToken });
  const accessToken = String(json.access_token);
  await prisma.googleAccount.update({
    where: { id: account.id },
    data: { accessToken, expiresAt: new Date(Date.now() + Number(json.expires_in ?? 3600) * 1000) },
  });
  return accessToken;
}

/** Thrown for any non-2xx Calendar API response so callers can branch on `status` (e.g. 410 → full resync). */
export class CalendarApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'CalendarApiError';
  }
}

async function calendarFetch<T>(account: GoogleAccount, path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken(account);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new CalendarApiError(res.status, `Calendar API ${init?.method ?? 'GET'} ${path} → ${res.status}: ${json.error?.message ?? 'unknown'}`);
  }
  return json;
}

// ── Event resource shapes (the subset we read/write) ─────────────────────

export interface GoogleEventInput {
  summary: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  description?: string;
  // Private extended props: invisible in the Google UI, our join key for the
  // two-way merge so a pull can tell "this row came from Second Brain" from
  // "this is a foreign event the user made in Google".
  extendedProperties?: { private?: Record<string, string> };
}

export interface GoogleEvent extends GoogleEventInput {
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  updated?: string;
  iCalUID?: string;
}

export interface EventListPage {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export function createEvent(account: GoogleAccount, body: GoogleEventInput): Promise<GoogleEvent> {
  return calendarFetch(account, `/calendars/${encodeURIComponent(account.calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patchEvent(account: GoogleAccount, googleEventId: string, body: Partial<GoogleEventInput>): Promise<GoogleEvent> {
  return calendarFetch(account, `/calendars/${encodeURIComponent(account.calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** 404 here means "already gone on Google's side" — callers treat it as success. */

/**
 * Incremental list. Pass the stored syncToken to get only what changed since
 * the last poll; pass null for the initial full sync (bounded to `timeMin`).
 * Throws CalendarApiError(410) when the syncToken has expired.
 */
export function listEvents(
  account: GoogleAccount,
  opts: { syncToken: string | null; pageToken?: string; timeMin?: Date }
): Promise<EventListPage> {
  // showDeleted: cancelled events come back too — required for delete propagation.
  const params = new URLSearchParams({ maxResults: '250', showDeleted: 'true' });
  if (opts.syncToken) {
    params.set('syncToken', opts.syncToken);
  } else {
    params.set('timeMin', (opts.timeMin ?? new Date(Date.now() - 30 * 24 * 3600 * 1000)).toISOString());
    params.set('singleEvents', 'false'); // don't expand recurrences — we mirror masters only
  }
  if (opts.pageToken) params.set('pageToken', opts.pageToken);
  return calendarFetch(account, `/calendars/${encodeURIComponent(account.calendarId)}/events?${params.toString()}`);
}

// ── Push notifications (events.watch) ────────────────────────────────────

export interface WatchChannel {
  id: string;
  resourceId: string;
  token: string;
  expiration: string; // epoch millis as string
}

/**
 * Registers a push channel pointing at /api/google/webhook. Google pings it
 * on every change; channels expire after at most 7 days, which is why
 * /api/google/watch renews them from a cron.
 */
export function watchEvents(account: GoogleAccount, channel: { id: string; token: string; address: string }): Promise<WatchChannel> {
  return calendarFetch(account, `/calendars/${encodeURIComponent(account.calendarId)}/events/watch`, {
    method: 'POST',
    body: JSON.stringify({ id: channel.id, type: 'web_hook', address: channel.address, token: channel.token }),
  });
}

/** Stops a channel (best-effort — it may already be dead, hence the swallow). */
export async function stopWatch(account: GoogleAccount, channel: { id: string; resourceId: string }): Promise<void> {
  try {
    await calendarFetch(account, `/calendars/${encodeURIComponent(account.calendarId)}/events/stop`, {
      method: 'POST',
      body: JSON.stringify({ id: channel.id, resourceId: channel.resourceId }),
    });
  } catch (err) {
    console.warn('[google] stopWatch failed (ignored):', err);
  }
}

export function deleteEvent(account: GoogleAccount, googleEventId: string): Promise<void> {
  return calendarFetch(account, `/calendars/${encodeURIComponent(account.calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
    method: 'DELETE',
  });
}

