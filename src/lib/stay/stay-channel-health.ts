/**
 * @fileoverview **ΠΟΣΟ ΕΜΠΙΣΤΕΥΟΜΑΣΤΕ ΜΙΑ ΠΗΓΗ** — βαθμίδα φρεσκάδας, επόμενη
 *   δημοσκόπηση, και η αναγνώριση του καναλιού από το URL.
 * @related ADR-835 §22 (Στάδιο Γ) · §6.4 · types/stay-channels.ts ·
 *   lib/stay/stay-calendar-of.ts
 * @module lib/stay/stay-channel-health
 *
 * 🔴 **Η ΒΑΘΜΙΔΑ ΕΙΝΑΙ Η ΑΠΑΝΤΗΣΗ ΣΤΟ «ΕΛΕΥΘΕΡΟ;» ΟΤΑΝ ΤΟ ΚΑΝΑΛΙ ΣΩΠΑΣΕ.** Το §6.4
 * λέει: *«αν το εξωτερικό ημερολόγιο δεν διαβάστηκε, η απάντηση είναι undetermined, όχι
 * ελεύθερο — γιατί ένα ελεύθερο εκεί ΕΙΝΑΙ το overbooking»*. Εδώ γίνεται μετρήσιμο:
 * **πότε** σταματά να ισχύει η τελευταία επιτυχής ανάγνωση.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O. Η στιγμή δίνεται πάντα από τον καλούντα.
 */

import {
  STAY_CHANNEL_BACKOFF_MINUTES,
  STAY_CHANNEL_FRESH_MINUTES,
  STAY_CHANNEL_PAUSE_FAILURES,
  STAY_CHANNEL_PAUSE_MINUTES,
  STAY_CHANNEL_POLL_MINUTES,
  STAY_CHANNEL_TRUST_MINUTES,
  STAY_FRESHNESS_TRUSTED,
  type StayChannelFeed,
  type StayChannelFeedStatus,
  type StayChannelFreshness,
  type StayChannelKind,
} from '@/types/stay-channels';

const MS_PER_MINUTE = 60_000;

/** Λεπτά από το `from` ως το `to` — `null` αν κάποιο δεν είναι στιγμή. */
export function minutesBetweenInstants(from: string, to: string): number | null {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return (end - start) / MS_PER_MINUTE;
}

/** Η στιγμή `minutes` λεπτά μετά — για `nextPollAt`. */
export function instantAfterMinutes(from: string, minutes: number): string {
  const base = new Date(from).getTime();
  const anchor = Number.isNaN(base) ? Date.now() : base;
  return new Date(anchor + minutes * MS_PER_MINUTE).toISOString();
}

// =============================================================================
// 1. ΠΟΙΟ ΚΑΝΑΛΙ ΕΙΝΑΙ — ΑΠΟ ΤΟ URL, ΠΟΤΕ ΑΠΟ ΤΟΝ ΑΝΘΡΩΠΟ
// =============================================================================

const CHANNEL_HOSTS: ReadonlyArray<readonly [StayChannelKind, readonly string[]]> = [
  ['airbnb', ['airbnb.com', 'airbnb.gr', 'airbnb.co.uk', 'muscache.com']],
  ['booking', ['booking.com', 'admin.booking.com']],
  ['vrbo', ['vrbo.com', 'homeaway.com', 'abritel.fr', 'vrbo.co.uk']],
];

/**
 * **Το κανάλι μιας διεύθυνσης.** Ταιριάζει σε **κατάληξη** host (`ical.airbnb.com` ⇒
 * `airbnb`), ώστε ένα `airbnb.com.evil.example` να **μη** περάσει ως Airbnb.
 */
export function stayChannelKindOfUrl(raw: string): StayChannelKind {
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  for (const [kind, hosts] of CHANNEL_HOSTS) {
    if (hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) return kind;
  }
  return 'other';
}

// =============================================================================
// 2. Η ΒΑΘΜΙΔΑ
// =============================================================================

/**
 * **Η βαθμίδα μιας πηγής τη στιγμή `now`.**
 *
 * 🔑 **Πηγή που δεν πέτυχε ΠΟΤΕ είναι `stale`, όχι `fresh`**: «δεν διαβάστηκε ποτέ» δεν
 * είναι «όλα ελεύθερα» — ίδια διάκριση με το `declaredAt: null ⇒ undeclared` της
 * κεφαλής. (Γι' αυτό η προσθήκη πηγής **απαιτεί** επιτυχή πρώτη ανάγνωση: αλλιώς ένα
 * τυπογραφικό θα έσβηνε την αγγελία από την αγορά.)
 */
export function stayChannelFreshnessAt(status: StayChannelFeedStatus, now: string): StayChannelFreshness {
  if (status.consecutiveFailures >= STAY_CHANNEL_PAUSE_FAILURES) return 'paused';
  if (status.lastSuccessAt === null) return 'stale';
  const age = minutesBetweenInstants(status.lastSuccessAt, now);
  // Στιγμή που δεν διαβάζεται ⇒ fail-closed. Ρολόι που πήγε πίσω (αρνητική ηλικία) ⇒ φρέσκο.
  if (age === null) return 'stale';
  if (age >= STAY_CHANNEL_PAUSE_MINUTES) return 'paused';
  if (age >= STAY_CHANNEL_TRUST_MINUTES) return 'stale';
  return age >= STAY_CHANNEL_FRESH_MINUTES ? 'lagging' : 'fresh';
}

/**
 * **Υπόσχονται όλες οι πηγές διαθεσιμότητα;** Μία `stale` πηγή αρκεί για να πάψουμε να
 * υποσχόμαστε — δεν ξέρουμε **ποιες** νύχτες πρόλαβε να δώσει το κανάλι από τότε.
 */
export function stayChannelsTrustedAt(feeds: readonly StayChannelFeed[], now: string): boolean {
  return feeds.every((feed) => STAY_FRESHNESS_TRUSTED[stayChannelFreshnessAt(feed.status, now)]);
}

// =============================================================================
// 3. Η ΕΠΟΜΕΝΗ ΔΗΜΟΣΚΟΠΗΣΗ
// =============================================================================

/**
 * **Πότε ξαναρωτάμε.** Επιτυχία ⇒ βασικό διάστημα· αποτυχία ⇒ υποχώρηση κατά
 * `consecutiveFailures` με πλαφόν.
 *
 * ⚠️ Η υποχώρηση **δεν** σταματά ποτέ: ακόμη και `paused` πηγή ξαναδοκιμάζεται ανά 3h,
 * γιατί ένα κανάλι που επανήλθε πρέπει να **ξεκλειδώσει** την αγγελία χωρίς να περιμένει
 * τον άνθρωπο. (Η Guesty απαιτεί χειροκίνητη επανασύνδεση — εμείς όχι.)
 */
export function nextPollAtFor(consecutiveFailures: number, now: string): string {
  if (consecutiveFailures <= 0) return instantAfterMinutes(now, STAY_CHANNEL_POLL_MINUTES);
  const index = Math.min(consecutiveFailures - 1, STAY_CHANNEL_BACKOFF_MINUTES.length - 1);
  return instantAfterMinutes(now, STAY_CHANNEL_BACKOFF_MINUTES[index] ?? STAY_CHANNEL_POLL_MINUTES);
}

/** Το **ελάχιστο** `nextPollAt` των πηγών — το πεδίο που ερωτά το cron. Χωρίς πηγές: «ποτέ». */
export function earliestPollAt(feeds: readonly StayChannelFeed[]): string {
  const never = '9999-12-31T00:00:00.000Z';
  return feeds.reduce((soonest, feed) => (feed.status.nextPollAt < soonest ? feed.status.nextPollAt : soonest), never);
}
