import { randomUUID } from 'node:crypto';
import type { Event, GoogleAccount, Task } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  CalendarApiError,
  createEvent as gCreate,
  deleteEvent as gDelete,
  listEvents,
  patchEvent as gPatch,
  stopWatch,
  watchEvents,
  type GoogleEvent,
  type GoogleEventInput,
} from '@/lib/google/client';
import { APP_TZ } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────
// Two-way Google Calendar sync.
//
// Push: every server-action mutation calls pushEventToGoogle /
// pushTaskToGoogle / removeRowFromGoogle. These NEVER throw into the caller —
// a Google outage must not fail "Tambah acara". Failures are logged and the
// next mutation (or manual "Tarik perubahan") will reconcile.
//
// Pull: pullFromGoogle() runs events.list({ syncToken }) and merges the delta
// into Prisma. The join key is the private extended property `pkmId` we stamp
// on everything we create; events without it are foreign (made in Google) and
// get imported as Event rows so they show up in Second Brain too.
// ─────────────────────────────────────────────────────────────────────────

type PkmKind = 'event' | 'task';

export interface PullStats {
  imported: number; // foreign Google events turned into Event rows
  updated: number; // local rows overwritten by their Google counterpart
  deleted: number; // local rows removed because Google cancelled the event
}

/** Module-level per-user lock so overlapping webhook pings don't double-merge. */
const inflight = new Map<string, Promise<PullStats>>();

// ── Row → Google payload ────────────────────────────────────────────────

function eventInput(row: Event): GoogleEventInput {
  const end = new Date(row.startAt.getTime() + 60 * 60 * 1000); // no end column locally; mirror as 1h
  return {
    summary: row.title,
    start: { dateTime: row.startAt.toISOString(), timeZone: APP_TZ },
    end: { dateTime: end.toISOString(), timeZone: APP_TZ },
    ...(row.location ? { location: row.location } : {}),
    extendedProperties: { private: { pkmKind: 'event', pkmId: row.id } },
  };
}

function taskInput(row: Task): GoogleEventInput | null {
  if (!row.dueAt) return null; // no time anchor → nothing sensible to hang on the calendar
  const end = new Date(row.dueAt.getTime() + 60 * 60 * 1000);
  return {
    summary: row.title,
    start: { dateTime: row.dueAt.toISOString(), timeZone: APP_TZ },
    end: { dateTime: end.toISOString(), timeZone: APP_TZ },
    ...(row.location ? { location: row.location } : {}),
    // Done tasks stay on the calendar (they happened); the checkbox lives in the app.
    description: `Tugas${row.status === 'DONE' ? ' ✓' : ''} — dikelola di PKM Jek`,
    extendedProperties: { private: { pkmKind: 'task', pkmId: row.id } },
  };
}

// ── Push ─────────────────────────────────────────────────────────────────

async function upsertOnGoogle(row: Event, kind: 'event'): Promise<void>;
async function upsertOnGoogle(row: Task, kind: 'task'): Promise<void>;
async function upsertOnGoogle(row: Event | Task, kind: PkmKind): Promise<void> {
  const account = await prisma.googleAccount.findUnique({ where: { userId: row.userId } });
  if (!account) return; // not connected → sync is a no-op, by design

  const input = kind === 'event' ? eventInput(row as Event) : taskInput(row as Task);
  if (!input) {
    // Task lost its dueAt: drop the calendar mirror instead of leaving a stale event.
    if (row.googleEventId) {
      await gDelete(account, row.googleEventId).catch((err) => {
        if (!(err instanceof CalendarApiError && err.status === 404)) throw err;
      });
      await prisma.task.update({ where: { id: row.id }, data: { googleEventId: null } });
    }
    return;
  }

  if (row.googleEventId) {
    const patched = await gPatch(account, row.googleEventId, input);
    // The id can change if Google re-created the event; keep our copy current.
    if (patched.id !== row.googleEventId) {
      if (kind === 'event') {
        await prisma.event.update({ where: { id: row.id }, data: { googleEventId: patched.id } });
      } else {
        await prisma.task.update({ where: { id: row.id }, data: { googleEventId: patched.id } });
      }
    }
  } else {
    const created = await gCreate(account, input);
    if (kind === 'event') {
      await prisma.event.update({ where: { id: row.id }, data: { googleEventId: created.id } });
    } else {
      await prisma.task.update({ where: { id: row.id }, data: { googleEventId: created.id } });
    }
  }
}

/** Create/update push for server actions. Log-and-continue: never fails the caller. */
export async function pushEventToGoogle(row: Event): Promise<void> {
  try {
    await upsertOnGoogle(row, 'event');
  } catch (err) {
    console.error('[google] push event failed:', err);
  }
}

export async function pushTaskToGoogle(row: Task): Promise<void> {
  try {
    await upsertOnGoogle(row, 'task');
  } catch (err) {
    console.error('[google] push task failed:', err);
  }
}

// ── Pull ─────────────────────────────────────────────────────────────────

/** Parses a Google start object: dateTime (RFC3339) or all-day `date` (treated as Jakarta midnight). */
function parseGoogleStart(ev: GoogleEvent): Date | null {
  if (ev.start?.dateTime) {
    const d = new Date(ev.start.dateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (ev.start?.date) {
    const d = new Date(`${ev.start.date}T00:00:00+07:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Merges one Google event into Prisma:
 *  - cancelled → delete the local Event/Task that mirrors it;
 *  - has pkmId private prop → Google wins, overwrite that local row;
 *  - no pkmId → foreign event, import (or refresh) as an Event row.
 */
async function mergeGoogleEvent(userId: string, ev: GoogleEvent): Promise<PullStats> {
  const empty: PullStats = { imported: 0, updated: 0, deleted: 0 };
  const priv = ev.extendedProperties?.private ?? {};
  const pkmKind = priv.pkmKind === 'task' ? 'task' : priv.pkmKind === 'event' ? 'event' : null;
  const pkmId = priv.pkmId ?? null;

  if (ev.status === 'cancelled') {
    // Both mirror tables may hold the googleEventId (events and tasks share the
    // Calendar surface); deleteMany covers whichever matches — and neither
    // matching is fine, foreign deletions have no local row.
    const [events, tasks] = await Promise.all([
      prisma.event.deleteMany({ where: { googleEventId: ev.id, userId } }),
      prisma.task.deleteMany({ where: { googleEventId: ev.id, userId } }),
    ]);
    return { ...empty, deleted: events.count + tasks.count };
  }

  const title = (ev.summary ?? '').trim() || '(Tanpa judul)';
  const location = (ev.location ?? '').trim() || null;

  // Our own mirror: Google is the source of truth for this ping (the user just
  // edited it there). Overwrite the local row — but only if it still exists;
  // a race with a local delete just means nothing to do.
  if (pkmId && pkmKind === 'event') {
    const res = await prisma.event.updateMany({
      where: { id: pkmId, userId },
      data: { title, startAt: parseGoogleStart(ev) ?? undefined, location, googleEventId: ev.id },
    });
    return { ...empty, updated: res.count };
  }
  if (pkmId && pkmKind === 'task') {
    const res = await prisma.task.updateMany({
      where: { id: pkmId, userId },
      data: { title, dueAt: parseGoogleStart(ev) ?? undefined, location, googleEventId: ev.id },
    });
    return { ...empty, updated: res.count };
  }

  // Foreign event (created in Google). Refresh the row if we already imported
  // it under this googleEventId, otherwise create a new Event row so the
  // calendar context surfaces in Second Brain too.
  const startAt = parseGoogleStart(ev);
  if (!startAt) return empty; // undated — nothing to hang on a timeline

  const existing = await prisma.event.findFirst({ where: { googleEventId: ev.id, userId } });
  if (existing) {
    await prisma.event.update({ where: { id: existing.id }, data: { title, startAt, location } });
    return { ...empty, updated: 1 };
  }
  await prisma.event.create({ data: { userId, title, startAt, location, googleEventId: ev.id } });
  return { ...empty, imported: 1 };
}


/** Delete push: removes the Google mirror for an Event or Task row. 404 = already gone = success. */
export async function removeRowFromGoogle(userId: string, googleEventId: string | null): Promise<void> {
  if (!googleEventId) return;
  try {
    const account = await prisma.googleAccount.findUnique({ where: { userId } });
    if (!account) return;
    await gDelete(account, googleEventId);
  } catch (err) {
    if (!(err instanceof CalendarApiError && err.status === 404)) {
      console.error('[google] delete mirror failed:', err);
    }
  }
}

// ── Incremental pull loop ───────────────────────────────────────────────

/**
 * Pulls the syncToken delta from Google and merges it. A 410 Gone means Google
 * invalidated the token — fall back to one full resync (bounded to the last 30
 * days by listEvents) and store the fresh token. Concurrent calls for the same
 * user collapse onto the in-flight promise so a burst of webhook pings runs
 * the merge exactly once.
 */
export function pullFromGoogle(userId: string): Promise<PullStats> {
  const existing = inflight.get(userId);
  if (existing) return existing;
  const run = doPull(userId).finally(() => inflight.delete(userId));
  inflight.set(userId, run);
  return run;
}

async function doPull(userId: string): Promise<PullStats> {
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  const stats: PullStats = { imported: 0, updated: 0, deleted: 0 };
  if (!account) return stats;

  let syncToken = account.syncToken;
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  // One retry: the first pass may 410 (expired token), then we resync fully.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      do {
        const page = await listEvents(account, { syncToken, pageToken });
        for (const ev of page.items ?? []) {
          const delta = await mergeGoogleEvent(userId, ev);
          stats.imported += delta.imported;
          stats.updated += delta.updated;
          stats.deleted += delta.deleted;
        }
        pageToken = page.nextPageToken;
        nextSyncToken = page.nextSyncToken ?? (pageToken ? nextSyncToken : syncToken);
      } while (pageToken);

      await prisma.googleAccount.update({
        where: { id: account.id },
        data: { syncToken: nextSyncToken ?? syncToken },
      });
      return stats;
    } catch (err) {
      if (err instanceof CalendarApiError && err.status === 410 && attempt === 0) {
        syncToken = null; // full resync path
        pageToken = undefined;
        continue;
      }
      throw err;
    }
  }
  return stats;
}

// ── Watch channel lifecycle ──────────────────────────────────────────────

/** Public origin Google should ping; the webhook route verifies the channel token itself. */
function webhookAddress(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL?.trim()}/api/google/webhook`;
}

/**
 * Registers (or renews) the push channel. Called after OAuth connect and from
 * the /api/google/watch cron, which fires daily because Google kills channels
 * after at most 7 days. The old channel is stopped first (best-effort) so we
 * don't accumulate zombie channels on Google's side.
 */
export async function ensureWatchChannel(account: GoogleAccount): Promise<void> {
  if (account.channelId && account.channelResourceId) {
    await stopWatch(account, { id: account.channelId, resourceId: account.channelResourceId });
  }
  const channel = await watchEvents(account, { id: randomUUID(), token: randomUUID(), address: webhookAddress() });
  await prisma.googleAccount.update({
    where: { id: account.id },
    data: {
      channelId: channel.id,
      channelResourceId: channel.resourceId,
      channelToken: channel.token,
      channelExpiration: channel.expiration ? new Date(Number(channel.expiration)) : null,
    },
  });
}

/** Drops channel state when the webhook reports the channel is gone (resource_state=not_found). */
export async function clearWatchChannel(accountId: string): Promise<void> {
  await prisma.googleAccount.update({
    where: { id: accountId },
    data: { channelId: null, channelResourceId: null, channelToken: null, channelExpiration: null },
  });
}

