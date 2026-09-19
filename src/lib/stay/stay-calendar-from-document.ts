/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ** — αποθηκευμένο έγγραφο →
 *   κεφαλή / block / κράτηση, ή **ρητό «δεν διαβάζεται»**.
 * @related ADR-835 §20 (Στάδιο Α) · §6.4 · CHECK 3.74 · types/stay-calendar.ts ·
 *   types/stay-booking.ts · lib/calendar/date-key.ts
 * @module lib/stay/stay-calendar-from-document
 *
 * 🔴 **ΑΥΣΤΗΡΟ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΑΝΤΙΘΕΤΟ ΤΟΥ `owner-property-from-document`, ΕΠΙΤΗΔΕΣ.**
 * Εκεί ένα ελλιπές ακίνητο *«εξακολουθεί να είναι ακίνητο»* και ο κάτοχος δικαιούται
 * να το δει. Εδώ ένα ελλιπές block **δεν μπορεί να κριθεί** — και ό,τι δεν κρίνεται,
 * αν σιωπούσε, θα γινόταν **«ελεύθερο»**, δηλαδή overbooking (§6.4). Άρα ό,τι δεν
 * διαβάζεται επιστρέφει `null` και ο αναγνώστης το μετρά ως `unreadable` —
 * **ποτέ** δεν το πετά.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { isDateKey } from '@/lib/calendar/date-key';
import { isRecord } from '@/lib/type-guards';
import { isDeclaredPetCount } from '@/lib/offers/offer-amount';
import { stayBookingPriceFrom } from '@/lib/stay/stay-quote-record';
import { stayDayRuleFrom, stayRulesFrom } from '@/lib/stay/stay-rules-shape';
import { STAY_RULES_NONE, type StayCalendarMonth, type StayDayRule } from '@/types/stay-rules';
import type { SpaceRef } from '@/lib/spaces/space-ref';
import {
  isStayBookingChannel,
  isStayBookingLifecycle,
  STAY_EXPIRY_REASONS,
  stayGuestUserIdOf,
  type StayBooking,
  type StayBookingHolder,
  type StayBookingLifecycle,
  type StayExpiryReason,
  type StayHold,
  type StayResolution,
} from '@/types/stay-booking';
import {
  STAY_HOLD_BOUNDS,
  STAY_HOLD_TIERS,
  type StayHoldBound,
  type StayHoldTier,
} from '@/lib/stay/stay-hold-deadline';
import {
  isStayBlockSource,
  STAY_CALENDAR_TIMEZONE,
  type StayBlock,
  type StayBlockChannelRef,
  type StayCalendarHead,
} from '@/types/stay-calendar';
import {
  isStayChannelFailure,
  isStayChannelKind,
  STAY_CHANNEL_STATUS_NEW,
  type StayChannelFailureRecord,
  type StayChannelFeed,
  type StayChannelFeedStatus,
  type StayChannels,
} from '@/types/stay-channels';

type Stored = Readonly<Record<string, unknown>>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function textOrNull(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : undefined;
}

function spaceRefsOf(value: unknown, propertyId: string): readonly SpaceRef[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const spaces: SpaceRef[] = [];
  for (const item of value) {
    if (!isRecord(item) || item.propertyId !== propertyId) return null;
    // `null` = ολόκληρο (§4.12)· οτιδήποτε άλλο πρέπει να είναι ταυτότητα χώρου.
    const spaceId = item.spaceId === null ? null : text(item.spaceId);
    if (item.spaceId !== null && spaceId === null) return null;
    spaces.push({ propertyId, spaceId });
  }
  return spaces;
}

/** Ημι-ανοιχτό `[from, to)` με **τουλάχιστον μία** νύχτα — αλλιώς δεν είναι κατάληψη. */
function nightsRange(from: unknown, to: unknown): { from: string; to: string } | null {
  if (!isDateKey(from) || !isDateKey(to)) return null;
  return from < to ? { from, to } : null;
}

/** **Η κεφαλή.** `null` = αδιάβαστη — ο αναγνώστης την κρίνει `unreadable`, όχι `undeclared`. */
export function stayCalendarHeadFromDocument(raw: unknown, propertyId: string): StayCalendarHead | null {
  if (!isRecord(raw)) return null;
  const stored: Stored = raw;
  const authorUserId = text(stored.authorUserId);
  const declaredAt = textOrNull(stored.declaredAt);
  const createdAt = text(stored.createdAt);
  const updatedAt = text(stored.updatedAt);
  const version = stored.version;
  if (authorUserId === null || declaredAt === undefined || createdAt === null || updatedAt === null) {
    return null;
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return null;
  // Κεφαλή πριν το Στάδιο Β: χωρίς πεδίο ⇒ ρητά «κανένας κανόνας». Παρόν αλλά άκυρο ⇒ χαλασμένη.
  const rules = stored.rules === undefined ? STAY_RULES_NONE : stayRulesFrom(stored.rules);
  if (rules === null) return null;
  return {
    propertyId,
    authorUserId,
    declaredAt,
    rules,
    version,
    timezone: STAY_CALENDAR_TIMEZONE,
    createdAt,
    updatedAt,
  };
}

/** **Κλεισμένες νύχτες.** Ταυτότητα από το έγγραφο, όπως στο ADR-839 — ποτέ από το περιεχόμενο. */
export function stayBlockFromDocument(raw: unknown, id: string): StayBlock | null {
  if (!isRecord(raw)) return null;
  const stored: Stored = raw;
  const propertyId = text(stored.propertyId);
  const authorUserId = text(stored.authorUserId);
  const createdBy = text(stored.createdBy);
  const createdAt = text(stored.createdAt);
  const updatedAt = text(stored.updatedAt);
  const note = textOrNull(stored.note);
  if (propertyId === null || authorUserId === null || createdBy === null) return null;
  if (createdAt === null || updatedAt === null || note === undefined) return null;
  if (!isStayBlockSource(stored.source)) return null;
  const covers = spaceRefsOf(stored.covers, propertyId);
  const range = nightsRange(stored.from, stored.to);
  if (covers === null || range === null) return null;
  const channel = channelRefOf(stored.channel);
  // 🔴 `external` ⇔ πηγή: εξωτερικό χωρίς πηγή δεν σβήνεται ποτέ· δικό μας **με** πηγή θα
  // σβηνόταν από feed που δεν το γέννησε. Και τα δύο είναι νύχτες χαμένες σιωπηλά.
  if (channel === undefined || (stored.source === 'external') !== (channel !== null)) return null;
  return {
    id, propertyId, authorUserId, covers, ...range,
    source: stored.source, channel, note, createdBy, createdAt, updatedAt,
  };
}

/** `undefined` = χαλασμένη πηγή (⇒ `unreadable`)· `null` = δεν υπάρχει πηγή (block ιδιοκτήτη). */
function channelRefOf(value: unknown): StayBlockChannelRef | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return undefined;
  const feedId = text(value.feedId);
  const externalUid = text(value.externalUid);
  return feedId === null || externalUid === null ? undefined : { feedId, externalUid };
}

function holderOf(value: unknown): StayBookingHolder | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'user') {
    const userId = text(value.userId);
    const displayName = textOrNull(value.displayName);
    return userId === null || displayName === undefined ? null : { kind: 'user', userId, displayName };
  }
  if (value.kind === 'offline') {
    const label = text(value.label);
    return label === null ? null : { kind: 'offline', label };
  }
  return null;
}

/** Άκυρη στιγμή ISO ⇒ `null`. */
function instantOf(value: unknown): string | null {
  const raw = text(value);
  return raw !== null && Number.isFinite(Date.parse(raw)) ? raw : null;
}

/** `undefined` = χαλασμένο (⇒ `unreadable`)· `null` = δεν υπάρχει (κάθε έγγραφο πριν το Στάδιο Δ). */
function holdOf(value: unknown): StayHold | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return undefined;
  const expiresAt = instantOf(value.expiresAt);
  const respondentUserId = text(value.respondentUserId);
  const { tier, bound } = value;
  if (expiresAt === null || respondentUserId === null) return undefined;
  if (!(STAY_HOLD_TIERS as readonly unknown[]).includes(tier)) return undefined;
  if (!(STAY_HOLD_BOUNDS as readonly unknown[]).includes(bound)) return undefined;
  return { expiresAt, tier: tier as StayHoldTier, bound: bound as StayHoldBound, respondentUserId };
}

/** `undefined` = χαλασμένο· `null` = δεν υπάρχει. Ο λόγος ανήκει **μόνο** στη λήξη. */
function resolutionOf(value: unknown): StayResolution | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return undefined;
  const at = instantOf(value.at);
  if (at === null) return undefined;
  switch (value.lifecycle) {
    case 'declined':
    case 'withdrawn':
      return { lifecycle: value.lifecycle, at };
    case 'expired':
      return (STAY_EXPIRY_REASONS as readonly unknown[]).includes(value.reason)
        ? { lifecycle: 'expired', at, reason: value.reason as StayExpiryReason }
        : undefined;
    default:
      return undefined;
  }
}

/**
 * 🔴 **Οι αναλλοίωτες του Σταδίου Δ** (§23.1) — fail-closed, γιατί κάθε παραβίαση **αλλάζει κατάληψη**:
 *
 * - `requested` **χωρίς** hold ⇒ άκυρο: δεν ξέρουμε ως πότε κρατά νύχτες, και ένα «δεν κρατά» θα
 *   ήταν overbooking ενώ ένα «κρατά για πάντα» θα ήταν οι μέρες-φυλακή του Airbnb.
 * - η επίλυση υπάρχει **αν και μόνο αν** η κατάσταση είναι επίλυση, και **είναι η ίδια**.
 * - το `guestUserId` είναι **παράγωγο** του κατόχου — διαφωνία = δύο αλήθειες για τον ίδιο άνθρωπο.
 */
function stageDInvariantsHold(
  lifecycle: StayBookingLifecycle,
  hold: StayHold | null,
  resolution: StayResolution | null,
  guestUserId: string | null,
  holder: StayBookingHolder,
): boolean {
  if (lifecycle === 'requested' && hold === null) return false;
  const resolved = lifecycle === 'declined' || lifecycle === 'expired' || lifecycle === 'withdrawn';
  if (resolved !== (resolution !== null)) return false;
  if (resolution !== null && resolution.lifecycle !== lifecycle) return false;
  return guestUserId === stayGuestUserIdOf(holder);
}

/**
 * Κατοικίδια κράτησης (ADR-777 §8.60.21.7): απόν/`null` ⇒ `null` («δεν ρωτήθηκε» — κράτηση πριν τη
 * Φ5)· παρόν ⇒ `0..5`, αλλιώς `undefined` (χαλασμένο, ποτέ σιωπηλό «κανένα»).
 */
function bookingPetsOf(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined) return null;
  return isDeclaredPetCount(raw) ? raw : undefined;
}

/** **Η κράτηση.** Χωρίς αναγνώσιμο κάτοχο, διάστημα ή κατάσταση ⇒ `null` (δες κεφαλίδα). */
export function stayBookingFromDocument(raw: unknown, id: string): StayBooking | null {
  if (!isRecord(raw)) return null;
  const stored: Stored = raw;
  const propertyId = text(stored.propertyId);
  const authorUserId = text(stored.authorUserId);
  const createdAt = text(stored.createdAt);
  const updatedAt = text(stored.updatedAt);
  const riskDisclosedAt = textOrNull(stored.riskDisclosedAt);
  const holder = holderOf(stored.holder);
  const guests = stored.guests;
  if (propertyId === null || authorUserId === null || holder === null) return null;
  if (createdAt === null || updatedAt === null || riskDisclosedAt === undefined) return null;
  if (stored.offerKind !== 'leaseShort') return null;
  if (!isStayBookingChannel(stored.channel) || !isStayBookingLifecycle(stored.lifecycle)) return null;
  if (typeof guests !== 'number' || !Number.isInteger(guests) || guests < 1) return null;
  const covers = spaceRefsOf(stored.covers, propertyId);
  const range = nightsRange(stored.checkIn, stored.checkOut);
  if (covers === null || range === null) return null;
  const hold = holdOf(stored.hold);
  const resolution = resolutionOf(stored.resolution);
  const guestUserId = textOrNull(stored.guestUserId);
  if (hold === undefined || resolution === undefined || guestUserId === undefined) return null;
  const pets = bookingPetsOf(stored.pets);
  const price = stayBookingPriceFrom(stored.price);
  if (pets === undefined || price === undefined) return null;
  if (!stageDInvariantsHold(stored.lifecycle, hold, resolution, guestUserId, holder)) return null;
  return {
    id, propertyId, offerKind: 'leaseShort', covers,
    checkIn: range.from, checkOut: range.to,
    holder, channel: stored.channel, authorUserId, guests, pets, price,
    lifecycle: stored.lifecycle, riskDisclosedAt, hold, resolution, guestUserId, createdAt, updatedAt,
  };
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * **Οι κανόνες ανά ημερομηνία ενός μήνα** (ADR-835 §21) — ΑΥΣΤΗΡΑ. Κάθε μέρα πρέπει να ανήκει
 * στον μήνα του εγγράφου· μία άκυρη μέρα ⇒ όλο το έγγραφο `null` ⇒ ημερολόγιο `unreadable`
 * (μια τιμή ή ένα CTA που δεν διαβάστηκε **δεν** είναι «κανένας κανόνας»).
 */
export function stayCalendarMonthFromDocument(raw: unknown, id: string): StayCalendarMonth | null {
  if (!isRecord(raw) || id.length === 0) return null;
  const stored: Stored = raw;
  const propertyId = text(stored.propertyId);
  const authorUserId = text(stored.authorUserId);
  const updatedAt = text(stored.updatedAt);
  const month = stored.month;
  if (propertyId === null || authorUserId === null || updatedAt === null) return null;
  if (typeof month !== 'string' || !MONTH_KEY.test(month) || !isRecord(stored.days)) return null;
  const days: Record<string, StayDayRule> = {};
  for (const [dateKey, value] of Object.entries(stored.days)) {
    if (!isDateKey(dateKey) || !dateKey.startsWith(`${month}-`)) return null;
    const rule = stayDayRuleFrom(value);
    if (rule === null) return null;
    days[dateKey] = rule;
  }
  return { propertyId, authorUserId, month, days, updatedAt };
}

// =============================================================================
// ΤΑ ΚΑΝΑΛΙΑ (ADR-835 §22, Στάδιο Γ)
// =============================================================================

function number(value: unknown, minimum: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum ? value : null;
}

function failureRecordOf(value: unknown): StayChannelFailureRecord | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return undefined;
  const at = text(value.at);
  const httpStatus = value.httpStatus === null || value.httpStatus === undefined
    ? null
    : number(value.httpStatus, 0);
  if (at === null || httpStatus === undefined || !isStayChannelFailure(value.failure)) return undefined;
  return { at, failure: value.failure, httpStatus };
}

function feedStatusOf(value: unknown): StayChannelFeedStatus | null {
  if (value === undefined) return STAY_CHANNEL_STATUS_NEW;
  if (!isRecord(value)) return null;
  const lastAttemptAt = textOrNull(value.lastAttemptAt);
  const lastSuccessAt = textOrNull(value.lastSuccessAt);
  const etag = textOrNull(value.etag);
  const lastModified = textOrNull(value.lastModified);
  const nextPollAt = text(value.nextPollAt);
  const consecutiveFailures = number(value.consecutiveFailures, 0);
  const eventCount = number(value.eventCount, 0);
  const lastFailure = failureRecordOf(value.lastFailure);
  if (lastAttemptAt === undefined || lastSuccessAt === undefined || etag === undefined) return null;
  if (lastModified === undefined || nextPollAt === null || lastFailure === undefined) return null;
  if (consecutiveFailures === null || eventCount === null) return null;
  return {
    lastAttemptAt, lastSuccessAt, lastFailure, consecutiveFailures,
    eventCount, etag, lastModified, nextPollAt,
  };
}

function pendingRemovalsOf(value: unknown): Readonly<Record<string, string>> | null {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return null;
  const out: Record<string, string> = {};
  for (const [blockId, at] of Object.entries(value)) {
    const stamp = text(at);
    if (stamp === null) return null;
    out[blockId] = stamp;
  }
  return out;
}

function feedOf(value: unknown): StayChannelFeed | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const label = text(value.label);
  const url = text(value.url);
  const createdAt = text(value.createdAt);
  const createdBy = text(value.createdBy);
  const status = feedStatusOf(value.status);
  const pendingRemovals = pendingRemovalsOf(value.pendingRemovals);
  if (id === null || label === null || url === null || createdAt === null) return null;
  if (createdBy === null || status === null || pendingRemovals === null) return null;
  if (!isStayChannelKind(value.channel)) return null;
  return { id, label, url, channel: value.channel, status, pendingRemovals, createdAt, createdBy };
}

/**
 * **Τα κανάλια ενός ακινήτου** (ADR-835 §22) — ΑΥΣΤΗΡΑ: μία χαλασμένη πηγή ⇒ `null` ⇒
 * ημερολόγιο `unreadable`.
 *
 * 🔴 **Γιατί ΤΟΣΟ αυστηρά**: πηγή που δεν διαβάστηκε είναι πηγή που **δεν
 * δημοσκοπείται** και **δεν φυλάει** νύχτες. Ένα «διάβασα τις άλλες τρεις» θα σήμαινε
 * «οι νύχτες της τέταρτης είναι ελεύθερες» — ακριβώς το overbooking του §6.4.
 */
export function stayChannelsFromDocument(raw: unknown, propertyId: string): StayChannels | null {
  if (!isRecord(raw)) return null;
  const stored: Stored = raw;
  const authorUserId = text(stored.authorUserId);
  const createdAt = text(stored.createdAt);
  const updatedAt = text(stored.updatedAt);
  const nextPollAt = text(stored.nextPollAt);
  const exportGeneration = number(stored.exportGeneration, 0);
  if (authorUserId === null || createdAt === null || updatedAt === null) return null;
  if (nextPollAt === null || exportGeneration === null || !Array.isArray(stored.feeds)) return null;
  const feeds: StayChannelFeed[] = [];
  for (const item of stored.feeds) {
    const feed = feedOf(item);
    if (feed === null) return null;
    feeds.push(feed);
  }
  return { propertyId, authorUserId, exportGeneration, feeds, nextPollAt, createdAt, updatedAt };
}
