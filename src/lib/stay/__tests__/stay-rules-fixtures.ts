/**
 * @fileoverview Κοινό σκηνικό για τις άγκυρες του Σταδίου Β (ADR-835 §21) — ΟΧΙ test.
 */

import { wholePropertySpace } from '@/lib/spaces/space-ref';
import { stayCalendarOccupancies, type StayOccupancySource } from '@/lib/stay/stay-rules';
import type { StayCalendar } from '@/lib/stay/stay-availability-vocabulary';
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

/** Σήμερα = Τρίτη 1/9/2026, 10:00 ώρα Αθήνας. */
export const CLOCK: StayClock = { today: '2026-09-01', minutes: 600 };

export function listingOf(
  stay: PublicListingStay | null = { minNights: null, maxGuests: 4, nextAvailableFrom: null },
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
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  return { kind: 'booking', booking };
}

export function blockEntry(
  id: string,
  from: string,
  to: string,
  source: StayBlockSource = 'owner',
): StayCalendarEntry {
  const block: StayBlock = {
    id,
    propertyId: PROPERTY,
    authorUserId: 'owner_1',
    covers: [wholePropertySpace(PROPERTY)],
    from,
    to,
    source,
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
): StayCalendar<StayOccupancySource> {
  return {
    kind: 'declared',
    occupied: stayCalendarOccupancies(entries, input.rules.preparationNights),
    rules: input,
  };
}
