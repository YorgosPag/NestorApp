/**
 * @fileoverview **Ποια πεδία της ΦΟΡΜΑΣ τροφοδοτούν κάθε πεδίο του ΠΡΟΣΧΕΔΙΟΥ** — ο χάρτης πίσω από το «Φόρτωσε τις
 * νέες» του διαλόγου σύγκρουσης (ADR-953 §3.5).
 * @related owner-property-form-values.ts (`ownerPropertyDraftFrom` · `ownerPropertyFormFrom`) · owner-property-edit.ts
 * @module lib/owner-property/owner-property-form-fields
 *
 * 🔑 **Γιατί χρειάζεται**: η σύγκρουση ονομάζει πεδία του **εγγράφου** (`offers`, `place`), ενώ ο άνθρωπος βλέπει
 * πεδία της **φόρμας**, που είναι επίπεδη (τρία ποσά δίπλα-δίπλα, πέντε κομμάτια θέσης). Για να πάρει η φόρμα την
 * τιμή του άλλου σε **ένα** πεδίο του εγγράφου χωρίς να χάσει ό,τι έγραψε ο άνθρωπος στα υπόλοιπα, πρέπει να ξέρει
 * ποια δικά της κλειδιά το συνθέτουν.
 *
 * ⚠️ **`Record<OwnerPropertyDraftField, …>`**: νέο πεδίο προσχεδίου δεν μεταγλωττίζεται χωρίς γραμμή εδώ.
 */

import type { OwnerPropertyDraftField } from '@/lib/owner-property/owner-property-edit';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';

type FormKey = keyof OwnerPropertyFormValues;

const FORM_KEYS_OF_DRAFT_FIELD: Record<OwnerPropertyDraftField, readonly FormKey[]> = {
  title: ['title'],
  type: ['type'],
  areaSqm: ['areaSqm'],
  // Όροφος και είδος στάθμης είναι **ένας** επιλογέας στη φόρμα (`floorLevel`).
  floor: ['floorLevel'],
  floorKind: ['floorLevel'],
  unitNumber: ['unitNumber'],
  bedrooms: ['bedrooms'],
  offers: [
    'offerKinds', 'askingPrice', 'rentPrice', 'exchangePercentage',
    'nightlyRate', 'minNights', 'maxGuests',
    'petsAccepts', 'maxPets', 'petFeeAmount', 'petFeePer',
  ],
  place: ['placeAnswer', 'placeQuery', 'placePoint', 'placeAccuracy', 'placeRef', 'placeAreaId'],
  media: ['media'],
  publishedFileIds: ['publishedFileIds'],
  publishedFileFocalPoints: ['publishedFileFocalPoints'],
  publishedFileCaptureSpots: ['publishedFileCaptureSpots'],
  publishedFileFloorplanNorth: ['publishedFileFloorplanNorth'],
  publishedFileCaptions: ['publishedFileCaptions'],
};

/**
 * **Η φόρμα μου, με τις τιμές του διακομιστή στα δοσμένα πεδία του εγγράφου** — ό,τι άλλαξα αλλού μένει.
 *
 * @param mine — οι τρέχουσες τιμές της φόρμας.
 * @param server — η φόρμα όπως προκύπτει από το **φρέσκο** έγγραφο (`ownerPropertyFormFrom`).
 * @param fields — τα πεδία του εγγράφου όπου κερδίζει ο διακομιστής (τα συγκρουόμενα).
 */
export function withServerFormFields(
  mine: OwnerPropertyFormValues,
  server: OwnerPropertyFormValues,
  fields: readonly OwnerPropertyDraftField[],
): OwnerPropertyFormValues {
  const keys = new Set(fields.flatMap((field) => FORM_KEYS_OF_DRAFT_FIELD[field]));
  const taken = Object.fromEntries(Object.entries(server).filter(([key]) => keys.has(key as FormKey)));
  return { ...mine, ...taken };
}
