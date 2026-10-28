/**
 * @fileoverview Ζωντανές αλλαγές RFQ — **καθαρή** λογική (ADR-328 §5.J.5): «τι άλλαξε, από ποιον» και «πόσα toasts».
 *
 * Δύο ερωτήσεις, δύο συναρτήσεις, μηδέν React:
 *  1. `diffQuoteChanges` — από δύο διαδοχικές εικόνες των προσφορών, τα γεγονότα που έκανε **ΑΛΛΟΣ**.
 *     Ο «ποιος» είναι το `updatedBy` (τελευταίος που **έγραψε**), ΠΟΤΕ το `createdBy` (αυτός που **δημιούργησε**).
 *     Χωρίς γνωστό ενεργό ή χωρίς γνωστό τρέχοντα χρήστη ⇒ **κανένα** γεγονός: καλύτερα σιωπή παρά λάθος ειδοποίηση.
 *  2. `coalesceLiveChanges` — από μια ριπή γεγονότων, τα toasts. Η **ανάθεση** είναι το νέο· η επιβεβαίωση του νικητή
 *     και οι απορρίψεις των χαμένων είναι **επακόλουθά** της (ίδιος ενεργός) και δεν φωνάζουν χωριστά.
 *
 * @adr ADR-328 §5.J.5
 */

import type { Quote, QuoteStatus } from '../types/quote';
import { quoteVendorDisplayName } from './quote-vendor-identity';

/** Αλλαγή παλαιότερη από αυτό δεν είναι «ζωντανή» (π.χ. επανασύνδεση που φέρνει παλιές εγγραφές). */
export const LIVE_CHANGE_FRESH_WINDOW_MS = 60_000;
/** Από τόσα γεγονότα και πάνω (ίδιος ενεργός, ή νέες προσφορές) ⇒ ένα συγκεντρωτικό toast. */
export const LIVE_CHANGE_AGGREGATE_THRESHOLD = 3;

export type LiveChangeEventType = 'quote_added' | 'quote_confirmed' | 'quote_awarded' | 'quote_rejected';

export interface LiveChangeEvent {
  readonly type: LiveChangeEventType;
  readonly quoteId: string;
  readonly quoteNumber: string;
  /** `null` = άγνωστος — εμφάνιση μέσω `quoteVendorLabel`. */
  readonly vendor: string | null;
  readonly total: number | null;
  /** `updatedBy`: uid εσωτερικού χρήστη ή `vendor:…` — ποτέ κενό, ποτέ ο τρέχων χρήστης. */
  readonly actorId: string;
}

export type LiveChangeToast =
  | { readonly kind: 'single'; readonly event: LiveChangeEvent }
  | { readonly kind: 'actorBurst'; readonly actorId: string; readonly count: number; readonly focus: LiveChangeEvent }
  | { readonly kind: 'newQuotes'; readonly count: number; readonly focus: LiveChangeEvent };

export interface LiveChangeDiffContext {
  /** `null` όσο φορτώνει η σύνδεση ⇒ δεν ξέρουμε ποιος είσαι ⇒ καμία ειδοποίηση. */
  readonly currentUserId: string | null;
  readonly nowMs: number;
}

const STATUS_EVENT: Partial<Record<QuoteStatus, LiveChangeEventType>> = {
  under_review: 'quote_confirmed',
  accepted: 'quote_awarded',
  rejected: 'quote_rejected',
};

/** Ο ενεργός της τελευταίας εγγραφής, **μόνο** αν είναι γνωστός και **δεν** είσαι εσύ. */
function remoteActorOf(quote: Quote, currentUserId: string | null): string | null {
  const actor = quote.updatedBy;
  if (!actor || !currentUserId || actor === currentUserId) return null;
  return actor;
}

function isFresh(quote: Quote, nowMs: number): boolean {
  const updatedMs = quote.updatedAt?.toMillis?.();
  return typeof updatedMs === 'number' && nowMs - updatedMs < LIVE_CHANGE_FRESH_WINDOW_MS;
}

function eventTypeOf(before: Quote | undefined, quote: Quote): LiveChangeEventType | undefined {
  if (!before) return 'quote_added';
  return before.status === quote.status ? undefined : STATUS_EVENT[quote.status];
}

/** Τα γεγονότα που έκανε **άλλος** ανάμεσα στην προηγούμενη και την τρέχουσα εικόνα. */
export function diffQuoteChanges(
  prev: ReadonlyMap<string, Quote>,
  next: readonly Quote[],
  ctx: LiveChangeDiffContext,
): LiveChangeEvent[] {
  const events: LiveChangeEvent[] = [];
  for (const quote of next) {
    const actorId = remoteActorOf(quote, ctx.currentUserId);
    if (!actorId || !isFresh(quote, ctx.nowMs)) continue;
    const type = eventTypeOf(prev.get(quote.id), quote);
    if (!type) continue;
    events.push({
      type,
      quoteId: quote.id,
      quoteNumber: quote.displayNumber,
      vendor: quoteVendorDisplayName(quote),
      total: quote.totals?.total ?? null,
      actorId,
    });
  }
  return events;
}

function groupByActor(events: readonly LiveChangeEvent[]): Map<string, LiveChangeEvent[]> {
  const groups = new Map<string, LiveChangeEvent[]>();
  for (const event of events) {
    const group = groups.get(event.actorId);
    if (group) group.push(event);
    else groups.set(event.actorId, [event]);
  }
  return groups;
}

const single = (event: LiveChangeEvent): LiveChangeToast => ({ kind: 'single', event });

function actorToasts(actorId: string, group: readonly LiveChangeEvent[], awardEcho: boolean): LiveChangeToast[] {
  const awards = group.filter((e) => e.type === 'quote_awarded');
  // Η ανάθεση απορροφά τα επακόλουθά της: επιβεβαίωση νικητή + απορρίψεις χαμένων του ΙΔΙΟΥ ενεργού.
  if (awards.length > 0) return awards.map(single);
  if (awardEcho) return [];
  if (group.length >= LIVE_CHANGE_AGGREGATE_THRESHOLD) {
    return [{ kind: 'actorBurst', actorId, count: group.length, focus: group[group.length - 1] }];
  }
  return group.map(single);
}

/**
 * Από μια ριπή γεγονότων, τα toasts που αξίζει να δει ο άνθρωπος.
 *
 * @param recentAwardActors ενεργοί που η ανάθεσή τους **μόλις** ανακοινώθηκε — οι απορρίψεις των χαμένων φτάνουν
 *        μία-μία (σειριακές εγγραφές) και μπορεί να πέσουν σε επόμενη ριπή· είναι ηχώ, όχι είδηση.
 */
export function coalesceLiveChanges(
  events: readonly LiveChangeEvent[],
  recentAwardActors: ReadonlySet<string> = new Set(),
): LiveChangeToast[] {
  const added = events.filter((e) => e.type === 'quote_added');
  const toasts: LiveChangeToast[] = added.length >= LIVE_CHANGE_AGGREGATE_THRESHOLD
    ? [{ kind: 'newQuotes', count: added.length, focus: added[added.length - 1] }]
    : added.map(single);
  const changes = events.filter((e) => e.type !== 'quote_added');
  for (const [actorId, group] of groupByActor(changes)) {
    toasts.push(...actorToasts(actorId, group, recentAwardActors.has(actorId)));
  }
  return toasts;
}

/** Ο ενεργός που ονομάζει το toast — `null` όταν το μήνυμα δεν έχει ενεργό (νέα προσφορά). */
export function liveToastActorId(toast: LiveChangeToast): string | null {
  if (toast.kind === 'newQuotes') return null;
  if (toast.kind === 'actorBurst') return toast.actorId;
  return toast.event.type === 'quote_added' ? null : toast.event.actorId;
}
