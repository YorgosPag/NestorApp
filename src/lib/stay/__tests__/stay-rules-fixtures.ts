/**
 * @fileoverview Κοινό σκηνικό για τις άγκυρες του Σταδίου Β (ADR-835 §21) — ΟΧΙ test.
 */

import { wholePropertySpace } from '@/lib/spaces/space-ref';
import { stayCalendarOccupancies, type StayOccupancySource } from '@/lib/stay/stay-rules';
import { stayOccupancyHeldUntil } from '@/lib/stay/stay-calendar-of';
import type { StayCalendar, StayChannelTrust } from '@/lib/stay/stay-availability-vocabulary';
import type { OfferKind } from '@/types/property-offers';
import type { PublicListing, PublicListingStay } from '@/types/public-listing';
import type { StayBooking } from '@/types/stay-booking';
import type { StayBlock, StayBlockSource, StayCalendarEntry } from '@/types/stay-calendar';
import {
  STAY_RULES_NONE,
  type StayClock,
  type StayDayRules,
  type StayRules,
  type StayRulesInput,
} from '@/types/stay-rules';

export const PROPERTY = 'prop_stage_b';
const STAMP = '2026-09-01T00:00:00.000Z';

/** Σήμερα = Τρίτη 1/9/2026, 10:00 ώρα Αθήνας (θερινή, UTC+3 ⇒ 07:00Z). */
export const CLOCK: StayClock = { today: '2026-09-01', minutes: 600, instant: '2026-09-01T07:00:00.000Z' };

export function listingOf(
  stay: PublicListingStay | null = { minNights: null, maxGuests: 4, pets: null, nextAvailableFrom: null },
  offerKinds: readonly OfferKind[] = ['leaseShort'],
  nightlyRate: number | null = 80,
): PublicListing {
  return {
    id: PROPERTY,
    commercialStatus: 'for-rent',
    commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate },
    stay,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: 60,
    offerKinds,
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    floor: 1,
    bedrooms: 2,
    authorship: 'owner-declared',
    agencyName: null,
    agencyId: null,
    title: 'Κατάλυμα',
    legality: [],
    projectedAt: STAMP,
    listedAt: { kind: 'unknown', reason: 'predates-record' },
    priceReduction: null,
  } as PublicListing;
}

export function bookingEntry(id: string, checkIn: string, checkOut: string): StayCalendarEntry {
  const booking: StayBooking = {
    id,
    propertyId: PROPERTY,
    offerKind: 'leaseShort',
    covers: [wholePropertySpace(PROPERTY)],
    checkIn,
    checkOut,
    holder: { kind: 'offline', label: 'Επισκέπτης' },
    channel: 'direct',
    authorUserId: 'owner_1',
    guests: 2,
    lifecycle: 'confirmed',
    riskDisclosedAt: null,
    pets: null,
    price: null,
    hold: null,
    resolution: null,
    guestUserId: null,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  return { kind: 'booking', booking };
}

/**
 * **Αίτημα επισκέπτη σε αναμονή** (Στάδιο Δ, §23) — `requested` με hold που λήγει στο `expiresAt`.
 * Ζωντανό ή νεκρό το κρίνει η **στιγμή** της ερώτησης, όχι το fixture.
 */
export function requestEntry(
  id: string,
  checkIn: string,
  checkOut: string,
  expiresAt: string,
  guestUserId = 'guest_1',
): StayCalendarEntry {
  const base = bookingEntry(id, checkIn, checkOut);
  if (base.kind !== 'booking') throw new Error('bookingEntry');
  const booking: StayBooking = {
    ...base.booking,
    holder: { kind: 'user', userId: guestUserId, displayName: 'Μαρία' },
    channel: 'platform',
    lifecycle: 'requested',
    hold: { expiresAt, tier: 'upcoming', bound: 'response-hours', respondentUserId: 'owner_1' },
    guestUserId,
  };
  return { kind: 'booking', booking };
}

/** Η προεπιλεγμένη πηγή ενός εξωτερικού block στις άγκυρες (ADR-835 §22). */
export const FEED = 'schf_test_feed';

export function blockEntry(
  id: string,
  from: string,
  to: string,
  source: StayBlockSource = 'owner',
  feedId: string = FEED,
): StayCalendarEntry {
  const block: StayBlock = {
    id,
    propertyId: PROPERTY,
    authorUserId: 'owner_1',
    covers: [wholePropertySpace(PROPERTY)],
    from,
    to,
    source,
    // Το σύνορο ανάγνωσης επιβάλλει `external` ⇔ πηγή — οι άγκυρες κρατούν το ίδιο.
    channel: source === 'external' ? { feedId, externalUid: `uid-${id}` } : null,
    note: null,
    createdBy: 'owner_1',
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  return { kind: 'block', block };
}

export function rulesInput(
  rules: Partial<StayRules> = {},
  days: StayDayRules = {},
  clock: StayClock = CLOCK,
): StayRulesInput {
  return { rules: { ...STAY_RULES_NONE, ...rules }, days, clock };
}

/** Δηλωμένο ημερολόγιο από εγγραφές, με την προετοιμασία των κανόνων. */
export function calendarOf(
  entries: readonly StayCalendarEntry[],
  input: StayRulesInput = rulesInput(),
  channels: StayChannelTrust = 'synced',
): StayCalendar<StayOccupancySource> {
  return {
    kind: 'declared',
    occupied: stayCalendarOccupancies(entries, input.rules.preparationNights, input.clock.instant),
    rules: input,
    // Στάδιο Γ (§22): οι άγκυρες του Β κρίνουν ημερολόγιο **με τα κανάλια συγχρονισμένα**.
    channels,
    // Στάδιο Δ (§23.5): η **ίδια** ερώτηση «ζωντανό αίτημα;» με τη σύνθεση του διακομιστή.
    heldUntilOf: (source) => stayOccupancyHeldUntil(source, input.clock.instant),
  };
}
