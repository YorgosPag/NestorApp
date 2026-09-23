/**
 * @fileoverview **Η αποθήκευση αγγελίας — καθαρή λογική** (χωρίς I/O, χωρίς ρολόι): η τιμή τότε και τώρα,
 * και ο αναγνώστης του εγγράφου.
 * @related ADR-777 §8.74 · types/saved-listing.ts · lib/listings/saved-listing-routes.ts
 * @module lib/listings/saved-listing
 *
 * 🔑 Οι **διαδρομές** ζουν χωριστά (`saved-listing-routes.ts`): τις εισάγει και η πλαϊνή μπάρα, και δεν
 * πρέπει να κουβαλά μαζί της zod και τον κριτή τιμής.
 */

import { z } from 'zod';

import { marketPriceOf, marketPriceShape } from '@/lib/listings/price-history';
import type { PriceAtSave, PriceSinceSave, SavedListing } from '@/types/saved-listing';
import type { PublicListing } from '@/types/public-listing';

// ============================================================================
// Η ΤΙΜΗ — ΤΟΤΕ ΚΑΙ ΤΩΡΑ
// ============================================================================

/**
 * **Η τιμή που βλέπει ο κόσμος σε αυτή την αγγελία** — από τον **ίδιο** κριτή με το ιστορικό
 * τιμής (`marketPriceOf` → `price-resolver`). Η αγγελία υπάρχει στο `public_listings`, άρα είναι
 * δημόσια εξ ορισμού.
 */
export function priceAtSaveOf(listing: PublicListing): PriceAtSave {
  return marketPriceOf(listing, true);
}

/**
 * **Τι έγινε η τιμή από τότε που την κράτησες.**
 *
 * ⚠️ **Αλλαγή ρόλου ≠ μείωση** (ίδιος κανόνας με το `listingPriceEvents`): 900 €/μήνα δεν είναι
 * «−99,7%» από 300.000 €. Άλλος ρόλος ή τιμή που λείπει ⇒ `not-comparable`, ποτέ αριθμός.
 */
export function priceSinceSave(atSave: PriceAtSave, now: PriceAtSave): PriceSinceSave {
  if (atSave === null || now === null || atSave.role !== now.role) return { kind: 'not-comparable' };
  if (now.amount === atSave.amount) return { kind: 'unchanged' };
  const change = { from: atSave.amount, to: now.amount };
  return now.amount < atSave.amount ? { kind: 'reduced', ...change } : { kind: 'raised', ...change };
}

// ============================================================================
// Ο ΑΝΑΓΝΩΣΤΗΣ ΤΟΥ ΕΓΓΡΑΦΟΥ
// ============================================================================

const savedListingShape = z.object({
  id: z.string().min(1),
  saverUserId: z.string().min(1),
  listingId: z.string().min(1),
  savedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  // 🔑 Ο **ίδιος** κριτής μορφής με το ιστορικό τιμής — όχι δεύτερος χειρόγραφος έλεγχος.
  priceAtSave: marketPriceShape.nullable(),
});

/**
 * **Το έγγραφο, όπως το γράφει ο ένας γραφέας** — ή `null` αν δεν είναι αυτό.
 * Ποτέ εμπιστοσύνη στο ωμό σχήμα: ένα χαλασμένο έγγραφο λείπει από τη λίστα, δεν τη ρίχνει.
 */
export function readSavedListing(raw: unknown): SavedListing | null {
  const parsed = savedListingShape.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
