/**
 * @fileoverview **Τα σχήματα των δοκιμών της προσφοράς** — γραμμένα μία φορά.
 * @related ADR-777 §7 (Α14) · types/owner-property.ts
 *
 * 🔑 **Εξήχθησαν από την πρώτη στιγμή, όχι μετά**: τρεις σουίτες (invariants ·
 * μετάφραση φόρμας · προβολή) χτίζουν την **ίδια** αγγελία, και τρία αντίγραφα θα
 * ήταν κλώνος που μπλοκάρει το **CHECK 3.28** — το ίδιο μάθημα που πλήρωσε η Α9 με
 * τα `demand-fixtures.ts`.
 */

import type {
  OwnerProperty,
  OwnerPropertyDraft,
  OwnerPropertyMedia,
} from '@/types/owner-property';
import { DEFAULT_LISTING_AGREEMENT } from '@/types/listing-agreement';
import {
  CUSTOMARY_COMMISSION_PERCENTAGE,
  OWNER_CONSENT,
  type BrokeredListingMandate,
  nextMandateExpiry,
} from '@/types/owner-property-mandate';
import type { OfferKind, OfferLifecycle, PropertyOffer } from '@/types/property-offers';

/** Μια διάθεση με ρητό ποσό — **μία** γεννήτρια για τα τέσσερα είδη. */
export function offerOf(
  kind: OfferKind,
  amount: number | null,
  lifecycle: OfferLifecycle = 'active',
  id = `offr_${kind}`,
): PropertyOffer {
  switch (kind) {
    case 'sell':
      return { id, kind, lifecycle, askingPrice: amount };
    case 'leaseOut':
      return { id, kind, lifecycle, rentPrice: amount };
    case 'exchange':
      return { id, kind, lifecycle, percentage: amount };
    // ⚠️ Οι δύο όροι διαμονής μένουν `null`: η γεννήτρια δίνει **το ποσό**, και ένα
    // προεπιλεγμένο `minNights` θα έκανε κάθε δοκιμή να κρίνει τιμή που δεν έβαλε.
    case 'leaseShort':
      return { id, kind, lifecycle, nightlyRate: amount, minNights: null, maxGuests: null };
  }
}

export const SAMPLE_MEDIA: OwnerPropertyMedia = {
  storagePath: 'owner_properties/user-1/ownp_a/katopsi.pdf',
  fileName: 'katopsi.pdf',
  sizeBytes: 128_000,
  uploadedAt: '2026-08-11T09:00:00.000Z',
};

/**
 * Ένα **έγκυρο** προσχέδιο — η βάση κάθε δοκιμής.
 *
 * ⚠️ Έχει **δηλωμένη** θέση με `accuracy`, ώστε η προβολή να μπορεί να αποδείξει ότι
 * η προέλευση γίνεται `geocoded`. Ένα προσχέδιο χωρίς αυτήν θα έκανε τη σχετική
 * δοκιμή πράσινη επειδή **δεν υπάρχει τι να κριθεί**.
 */
export function validDraft(
  overrides: Partial<OwnerPropertyDraft> = {},
): OwnerPropertyDraft {
  return {
    title: 'Διαμέρισμα 92 τ.μ.',
    type: 'apartment',
    areaSqm: 92,
    floor: 3,
    bedrooms: 2,
    offers: [offerOf('sell', 210_000)],
    place: {
      kind: 'declared',
      point: { lat: 40.63, lng: 22.95 },
      label: 'Εγνατίας 147, Θεσσαλονίκη',
      accuracy: 'exact',
      // Ο δεσμός προς το επίπεδο Α είναι **προαιρετικός**: το προεπιλεγμένο
      // στιγμιότυπο τον αφήνει κενό, ώστε οι υπάρχουσες άγκυρες να μετρούν ό,τι
      // μετρούσαν — και όποια τον χρειάζεται τον δηλώνει ρητά.
      link: null,
    },
    media: [SAMPLE_MEDIA],
    ...overrides,
  };
}

/** Μια **έγκυρη** αγγελία — προσχέδιο + τα γεγονότα του συστήματος. */
export function validOwnerProperty(
  overrides: Partial<OwnerProperty> = {},
): OwnerProperty {
  return {
    id: 'ownp_a',
    authorUserId: 'user-1',
    authorCompanyId: null,
    // ADR-832: κενός πίνακας ΕΙΝΑΙ το παλιό `{ kind: 'self' }`.
    mandates: [],
    mandatesExpireAt: null,
    ...validDraft(),
    lifecycle: 'listed',
    createdAt: '2026-08-11T09:00:00.000Z',
    updatedAt: '2026-08-11T09:00:00.000Z',
    ...overrides,
  };
}

/**
 * **Μία εντολή μεσίτη** — ο χτίστης, ξεχωριστά από την αγγελία που την κρατά.
 *
 * 🔑 **Εξήχθη επειδή ο πληθυντικός τη χρειάζεται ΜΟΝΗ ΤΗΣ** (ADR-832): μια αγγελία
 * μπορεί πλέον να κρατά **δεύτερη, ξένη** κατάληψη, και οι σουίτες που τη σπέρνουν
 * δεν θέλουν ολόκληρη αγγελία. Χωρίς την εξαγωγή, κάθε μία θα ξανάγραφε τα δεκατρία
 * πεδία — κλώνος που το **CHECK 3.28** μπλοκάρει, και σωστά.
 *
 * ⚠️ **Οι προεπιλογές είναι η ΑΥΣΤΗΡΗ περίπτωση επίτηδες**: `pending` + μελλοντική
 * λήξη. Μια «βολική» προεπιλογή `confirmed` θα έκανε κάθε άγκυρα που ξεχνά να δηλώσει
 * την έγκριση να **περνά κατά λάθος** — δηλαδή θα έκρυβε ακριβώς το ελάττωμα που ο
 * φρουρός υπάρχει για να πιάνει. Ο κριτής σύγκρουσης ζητά ρητά `confirmed`
 * (`bindingMandates` → `isMandateAttributable`).
 */
export function brokeredMandate(
  mandate: Partial<BrokeredListingMandate> = {},
): BrokeredListingMandate {
  return {
    kind: 'brokered',
    clientContactId: 'cont_kostas',
    confirmation: 'pending',
    confirmedByUserId: null,
    proof: { via: OWNER_CONSENT },
    agreement: DEFAULT_LISTING_AGREEMENT,
    compensation: {
      type: 'percentage',
      percentage: CUSTOMARY_COMMISSION_PERCENTAGE,
      vatIncluded: false,
    },
    decidedAt: null,
    notifiedAt: null,
    notifyOutcome: null,
    viewedAt: null,
    consentNonce: null,
    expiresAt: '2027-08-11T09:00:00.000Z',
    agencyRevokedAt: null,
    // ── ADR-832 ─────────────────────────────────────────────────────────────
    agencyCompanyId: 'comp_alfa',
    startsAt: '2026-08-11T09:00:00.000Z',
    scope: ['sell'],
    ...mandate,
  };
}

/**
 * Μια αγγελία **γραφείου** — εντολή μεσίτη, με ρητή έγκριση και ρητή λήξη.
 *
 * ⚠️ **Οι προεπιλογές είναι η ΑΥΣΤΗΡΗ περίπτωση επίτηδες**: `pending` + μελλοντική
 * λήξη. Μια «βολική» προεπιλογή `confirmed` θα έκανε κάθε άγκυρα που ξεχνά να δηλώσει
 * την έγκριση να **περνά κατά λάθος**, δηλαδή θα έκρυβε ακριβώς το ελάττωμα που ο
 * φρουρός υπάρχει για να πιάνει.
 */
export function brokeredOwnerProperty(
  mandate: Partial<BrokeredListingMandate> = {},
  overrides: Partial<OwnerProperty> = {},
): OwnerProperty {
  const built = brokeredMandate(mandate);

  return validOwnerProperty({
    authorCompanyId: 'comp_alfa',
    mandates: [built],
    // ⚠️ **Παράγεται από τις εντολές**, ποτέ δηλωμένο χωριστά — αλλιώς το fixture θα
    //    γεννούσε έγγραφο που ο σαρωτής λήξης δεν θα έβρισκε ποτέ.
    mandatesExpireAt: nextMandateExpiry([built]),
    ...overrides,
  });
}
