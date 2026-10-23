/**
 * @fileoverview **ΤΟ ΙΣΤΟΡΙΚΟ ΤΗΣ ΔΗΜΟΣΙΑΣ ΥΠΟΣΧΕΣΗΣ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ** — μόνο τύποι.
 * @related ADR-919 §10 · ADR-777 §8.99.4 (Δ3) · lib/listings/availability-history.ts · types/price-history.ts
 * @module types/availability-history
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΤΥΠΟΙ, ΔΥΟ ΑΚΡΟΑΤΗΡΙΑ — δίδυμο του `types/price-history.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Τύπος | Πού ζει | Ποιος τον βλέπει |
 * |---|---|---|
 * | {@link AvailabilityObservation} | `properties/{id}` · `owner_properties/{id}` (`availabilityHistory`) | **μόνο** ο διακομιστής |
 * | {@link AvailabilityTrack} | `public_listings/{id}.availabilityTrack` | ο **κόσμος** |
 *
 * ⛔ **ΙΔΙΩΤΙΚΟΤΗΤΑ (ADR-777 §8.99.4)**: καταγράφεται **μόνο** η τιμή που είδε το κοινό (`PublicListing.availability`
 * αγγελίας που περνά το `isPubliclyListed`). Ποτέ φάσεις, `ConstructionBaseline`, πρόβλεψη (`forecastCompletion`) ή το
 * εσωτερικό `completionDate`. Ο κόσμος μαθαίνει **συμπέρασμα** (αρχική υπόσχεση · πλήθος μεταθέσεων · τελευταία αλλαγή),
 * όχι τη διαδρομή.
 *
 * ⚠️ **Ζει στη ΜΟΝΑΔΑ, όχι στο κτίριο** (ADR-919 §10): «μετατέθηκε 1 φορά» λέει τι υποσχέθηκε **αυτή η αγγελία**.
 * Στο κτίριο θα καταγράφονταν αλλαγές που το κοινό δεν είδε ποτέ, και θα χάνονταν οι δηλώσεις της μονάδας.
 */

import type { ListingAvailability } from './listing-availability';

/**
 * **Μία στιγμή της δημόσιας υπόσχεσης**: από το `at` και μέχρι την επόμενη παρατήρηση, η αγγελία έλεγε αυτό.
 *
 * 🔑 **Καμία `null` παρατήρηση** (αντίθετα με την τιμή): μια αγγελία εκτός αγοράς δεν **υπόσχεται** τίποτα, άρα δεν
 * καταγράφεται τίποτα. Η επόμενη δημόσια τιμή συγκρίνεται με την τελευταία δημόσια — ό,τι είδε το κοινό.
 */
export interface AvailabilityObservation {
  /** ISO στιγμή — η **ίδια** με το `projectedAt` του περάσματος που την κατέγραψε. */
  readonly at: string;
  readonly availability: ListingAvailability;
}

/** Ένα `scheduled` του λεξιλογίου, ονομασμένο: η αρχική υπόσχεση είναι πάντα διάστημα. */
export type ScheduledAvailability = Extract<ListingAvailability, { kind: 'scheduled' }>;

/**
 * **Τι είδους αλλαγή** ήταν μια νέα δημόσια τιμή, σε σχέση με την προηγούμενη. Κρίνεται με το **τέλος** του
 * διαστήματος (Δ2): το ίδιο κριτήριο με το `timingBlockers`.
 *
 * | Είδος | από → σε | Μετάθεση; |
 * |---|---|---|
 * | `slipped` | scheduled → scheduled, τέλος **αργότερα** | ✅ |
 * | `advanced` | scheduled → scheduled, τέλος νωρίτερα | — |
 * | `refined` | scheduled → scheduled, **ίδιο** τέλος (τρίμηνο → Σεπτέμβριος) | — εξειδίκευση |
 * | `delivered` | → ready | — παράδοση |
 * | `withdrawn` | scheduled → unknown | — απόσυρση υπόσχεσης |
 * | `promised` | ready/unknown → scheduled | — νέα υπόσχεση |
 */
export const AVAILABILITY_REVISION_KINDS = [
  'slipped',
  'advanced',
  'refined',
  'delivered',
  'withdrawn',
  'promised',
] as const;

export type AvailabilityRevisionKind = (typeof AVAILABILITY_REVISION_KINDS)[number];

/** **Η τελευταία αλλαγή της δημόσιας τιμής** — ό,τι χρειάζεται η ειδοποίηση για να ρωτήσει τη μηχανή «πριν/τώρα». */
export interface AvailabilityChange {
  readonly kind: AvailabilityRevisionKind;
  /** Η δημόσια τιμή **πριν** την αλλαγή — με αυτήν ξανακρίνει η μηχανή το «ταίριαζε;». */
  readonly from: ListingAvailability;
  /** Η στιγμή της αλλαγής — ταυτότητα της έκδοσης της δήλωσης (idempotency της ειδοποίησης). */
  readonly at: string;
}

/**
 * **Η δημόσια ιστορία μιας υπόσχεσης**, όπως τη βλέπει ο κόσμος: «αρχικά Β' τρ. 2027 · μετατέθηκε 1 φορά».
 *
 * 🔑 Ένα **επεισόδιο** ξεκινά στην πρώτη δημόσια `scheduled` και κλείνει με το `ready` (παράδοση). Το `slips` μετρά τις
 * αλλαγές με τέλος αργότερα από την **προηγούμενη scheduled** του επεισοδίου, ακόμη και πάνω από ένα `unknown`.
 */
export interface AvailabilityTrack {
  /** Η πρώτη δημόσια υπόσχεση του επεισοδίου. */
  readonly originally: ScheduledAvailability;
  /** Πόσες φορές μετατέθηκε **αργότερα** — ποτέ αρνητικό, ποτέ οι επισπεύσεις. */
  readonly slips: number;
  /** Η τελευταία αλλαγή — `null` όταν η υπόσχεση δεν άλλαξε ποτέ. */
  readonly lastChange: AvailabilityChange | null;
}
