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
import {
  OWNER_CONSENT,
  type BrokeredListingMandate,
} from '@/types/owner-property-mandate';
import type { OfferKind, OfferLifecycle, PropertyOffer } from '@/types/property-offers';

/** Μια διάθεση με ρητό ποσό — **μία** γεννήτρια για τα τρία είδη. */
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
    mandate: { kind: 'self' },
    ...validDraft(),
    lifecycle: 'listed',
    createdAt: '2026-08-11T09:00:00.000Z',
    updatedAt: '2026-08-11T09:00:00.000Z',
    ...overrides,
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
  return validOwnerProperty({
    authorCompanyId: 'comp_alfa',
    mandate: {
      kind: 'brokered',
      clientContactId: 'cont_kostas',
      confirmation: 'pending',
      confirmedByUserId: null,
      proof: { via: OWNER_CONSENT },
      decidedAt: null,
      notifiedAt: null,
      viewedAt: null,
      consentNonce: null,
      expiresAt: '2027-08-11T09:00:00.000Z',
      ...mandate,
    },
    ...overrides,
  });
}
