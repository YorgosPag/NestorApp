/**
 * @fileoverview **ΑΠΟ ΠΟΤΕ ΕΙΝΑΙ ΔΙΑΘΕΣΙΜΗ ΜΙΑ ΑΓΓΕΛΙΑ** — τρεις καταστάσεις, καμία διφορούμενη.
 * @related ADR-777 §8.99.4 (Δ2 · Δ4) · ADR-919 · `lib/listings/availability-window.ts`
 * @module types/listing-availability
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΝΩΣΗ ΚΑΙ ΟΧΙ `{ from, to }`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το προηγούμενο σχήμα ήταν `{ from: string | null; to: string | null } | null`. Το
 * `from: null` σήμαινε **δύο** πράγματα: «διαθέσιμο ήδη» **ή** «άγνωστη αρχή». Μια μηχανή που
 * δεν ξεχωρίζει τα δύο είτε υπόσχεται ό,τι δεν ξέρει είτε κρύβει ό,τι ξέρει. Εδώ κάθε
 * κατάσταση έχει όνομα:
 *
 * | `kind` | Σημαίνει | Πηγή (ADR-777 §8.99.4) |
 * |---|---|---|
 * | `ready` | **ρητά** διαθέσιμο τώρα, άρα ταιριάζει σε κάθε διάστημα | ολοκληρωμένο κτίριο / μονάδα (Δ4) |
 * | `scheduled` | διαθέσιμο **μέσα** σε δηλωμένο διάστημα (τρίμηνο / μήνας / ημέρα) | δήλωση της εταιρείας (Δ1, Δ2) |
 * | `unknown` | **δεν ξέρουμε**, και η μηχανή το λέει ονομαστικά (`availability-unknown`) | — |
 *
 * ⚠️ **Δεν υπάρχει «λήξη διαθεσιμότητας» (`to`)**: κανένας παραγωγός δεν την έγραφε, και ούτε
 * το RESO (`AvailabilityDate`) ούτε idealista/ImmoScout24 την έχουν. Ό,τι γίνει διαθέσιμο
 * μένει διαθέσιμο μέχρι να αποσυρθεί η αγγελία, και η απόσυρση είναι άλλος άξονας.
 *
 * ⚠️ **Το διάστημα του `scheduled` ΔΕΝ χτίζεται με το χέρι.** Το φτιάχνει το
 * `scheduledAvailability()`, ώστε το `window` να συμφωνεί πάντα με την `precision`.
 */

/** Οι τρεις καταστάσεις — κλειστό σύνολο. */
export const LISTING_AVAILABILITY_KINDS = ['ready', 'scheduled', 'unknown'] as const;

export type ListingAvailabilityKind = (typeof LISTING_AVAILABILITY_KINDS)[number];

/**
 * Πόσο ακριβής είναι η δήλωση (Δ2). Η **σειρά** είναι από το χονδρό στο λεπτό, και η
 * προεπιλογή είναι το **τρίμηνο**: πρακτική idealista («3er trimestre 2027»).
 */
export const AVAILABILITY_PRECISIONS = ['quarter', 'month', 'day'] as const;

export type AvailabilityPrecision = (typeof AVAILABILITY_PRECISIONS)[number];

export const DEFAULT_AVAILABILITY_PRECISION: AvailabilityPrecision = 'quarter';

/** Κλειστό ημερολογιακό διάστημα, ISO `YYYY-MM-DD` και στα δύο άκρα (`start ≤ end`). */
export interface AvailabilityWindow {
  readonly start: string;
  readonly end: string;
}

export type ListingAvailability =
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'scheduled';
      readonly precision: AvailabilityPrecision;
      readonly window: AvailabilityWindow;
    }
  | { readonly kind: 'unknown' };

/** Η μία τιμή «δεν ξέρουμε» — ονομασμένη, ώστε κάθε παραγωγός που ακόμη δεν ξέρει να φαίνεται στο grep. */
export const LISTING_AVAILABILITY_UNKNOWN: ListingAvailability = { kind: 'unknown' };

/** Η μία τιμή «διαθέσιμο τώρα». */
export const LISTING_AVAILABILITY_READY: ListingAvailability = { kind: 'ready' };
