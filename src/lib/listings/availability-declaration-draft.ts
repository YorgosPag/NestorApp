/**
 * @fileoverview **ΤΟ ΠΡΟΣΧΕΔΙΟ ΤΗΣ ΔΗΛΩΣΗΣ** — ακρίβεια + περίοδος στην οθόνη ↔ `{ precision, anchor }` (ADR-919 §11).
 * @related lib/listings/availability-window.ts (`scheduledAvailability`) · components/listings/availability-declaration
 * @module lib/listings/availability-declaration-draft
 *
 * 🔑 **Η άγκυρα είναι πάντα η ΠΡΩΤΗ ημέρα της περιόδου.** Ο κατασκευαστής του διαστήματος δέχεται οποιαδήποτε ημέρα
 * μέσα στην περίοδο· η οθόνη γράφει την πρώτη, ώστε δύο δηλώσεις του ίδιου τριμήνου να είναι **ίδιο έγγραφο** (και
 * ο ανιχνευτής αλλαγής του βήματος 5 να μη βλέπει «αλλαγή» εκεί που δεν υπάρχει).
 *
 * 🔑 **Αλλαγή ακρίβειας κρατά την περίοδο που περιέχει την παλιά**: τρίμηνο Γ΄ → μήνας Ιούλιος (η αρχή του), μήνας
 * Σεπτέμβριος → τρίμηνο Γ΄. Ποτέ άλμα σε άσχετη ημερομηνία.
 */

import { availabilityWindowOf } from '@/lib/listings/availability-window';
import type { AvailabilityDeclaration, AvailabilityPrecision } from '@/types/listing-availability';
import { DEFAULT_AVAILABILITY_PRECISION } from '@/types/listing-availability';

/** Πόσα έτη μπροστά προσφέρει ο επιλογέας (οικοδομή ~2–4 έτη· περιθώριο για μεγάλα έργα). */
export const DECLARATION_YEARS_AHEAD = 8;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Το τρίμηνο (1–4) ενός μήνα (1–12). */
export function quarterOfMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

/** Η πρώτη ημέρα της περιόδου που περιέχει την `anchor`, στην ακρίβεια `precision`. */
export function normalizedAnchor(precision: AvailabilityPrecision, anchor: string): string | null {
  const window = availabilityWindowOf(precision, anchor);
  return window === null ? null : window.start;
}

/** Νέα ακρίβεια, ίδια περίοδος. */
export function withPrecision(draft: AvailabilityDeclaration, precision: AvailabilityPrecision): AvailabilityDeclaration {
  return { precision, anchor: normalizedAnchor(precision, draft.anchor) ?? draft.anchor };
}

/** Το έτος της άγκυρας. */
export function yearOfAnchor(anchor: string): number {
  return Number(anchor.slice(0, 4));
}

/** Ο μήνας (1–12) της άγκυρας. */
export function monthOfAnchor(anchor: string): number {
  return Number(anchor.slice(5, 7));
}

/** Ίδια ακρίβεια και περίοδος, άλλο έτος. */
export function withYear(draft: AvailabilityDeclaration, year: number): AvailabilityDeclaration {
  if (draft.precision === 'day') return draft;
  return { ...draft, anchor: `${year}-${pad2(monthOfAnchor(draft.anchor))}-01` };
}

/** Τρίμηνο (1–4) ή μήνας (1–12) μέσα στο ίδιο έτος. */
export function withPeriod(draft: AvailabilityDeclaration, period: number): AvailabilityDeclaration {
  const month = draft.precision === 'quarter' ? (period - 1) * 3 + 1 : period;
  return { ...draft, anchor: `${yearOfAnchor(draft.anchor)}-${pad2(month)}-01` };
}

/** Η περίοδος (τρίμηνο ή μήνας) της άγκυρας στην ακρίβεια του προσχεδίου. */
export function periodOfDraft(draft: AvailabilityDeclaration): number {
  const month = monthOfAnchor(draft.anchor);
  return draft.precision === 'quarter' ? quarterOfMonth(month) : month;
}

/** Το αρχικό προσχέδιο: η υπάρχουσα δήλωση, αλλιώς η πρόταση, αλλιώς το τρέχον τρίμηνο. */
export function initialDraft(
  existing: AvailabilityDeclaration | null,
  proposal: AvailabilityDeclaration | null,
  today: string,
): AvailabilityDeclaration {
  const source = existing ?? proposal ?? { precision: DEFAULT_AVAILABILITY_PRECISION, anchor: today };
  return { precision: source.precision, anchor: normalizedAnchor(source.precision, source.anchor) ?? today };
}

/** Τα έτη του επιλογέα: από το τρέχον (ή το έτος της δήλωσης, αν είναι παλαιότερο) ως `DECLARATION_YEARS_AHEAD`. */
export function selectableYears(today: string, draft: AvailabilityDeclaration): readonly number[] {
  const first = Math.min(yearOfAnchor(today), yearOfAnchor(draft.anchor));
  const last = yearOfAnchor(today) + DECLARATION_YEARS_AHEAD;
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/** Ίδια δήλωση; (για να ξέρει η οθόνη αν υπάρχει κάτι να δημοσιευθεί). */
export function isSameDeclaration(a: AvailabilityDeclaration | null, b: AvailabilityDeclaration | null): boolean {
  if (a === null || b === null) return a === b;
  return a.precision === b.precision && normalizedAnchor(a.precision, a.anchor) === normalizedAnchor(b.precision, b.anchor);
}
