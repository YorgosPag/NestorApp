/**
 * **Η ταυτότητα εμπορίου ενός φορέα** — ανάγνωση και αλλαγές, καθαρές (ADR-934 §5.1.2 · Σ1β).
 *
 * Τέσσερα πεδία πλατφόρμας (Google Merchant `brand` · `gtin` · `mpn` · `identifier_exists=false`), **όχι** ιδιότητες του
 * προμηθευτή: η ταύτιση ανάμεσα σε πωλητές χρειάζεται πεδία με **γνωστή** σημασία σε όλους.
 *   - `brand` στο βάθος 0 της αλυσίδας (ρίζα μοντέλου ή απλό προϊόν — Δ1)·
 *   - `gtin` · `mpn` · `noGtinReason` στο φύλλο (SKU = εμπορεύσιμη μονάδα).
 *
 * 🔑 **Ένας αναγνώστης** για παλιά έγγραφα: όσα γράφτηκαν πριν από το Σ1β **δεν** έχουν τα πεδία. Κάθε ανάγνωση περνά από
 *    εδώ (`?? null`) — καμία μαζική μετάπτωση, κανένα «άλλαξε» που δεν έκανε άνθρωπος.
 * 🔑 GTIN και «χωρίς GTIN» **δεν συνυπάρχουν** — το εγγυάται η **κατασκευή** (όπως `writeNoValueReason` του `holder-edit`),
 *    και ο επικυρωτής το απορρίπτει αν έρθει από αλλού (`noValueConflict`).
 *
 * @module subapps/catalog/values/trade-identity
 */

import { gtinDigitsOf } from '@/lib/validation/gtin';
import type { InheritanceLink } from './resolve-inherited';
import type { CatalogTradeIdentity, CatalogValueHolder, NoValueReason } from '../types/product';

/** Το βάθος της αλυσίδας που **κατέχει** τη μάρκα (Δ1): ρίζα μοντέλου ή απλό προϊόν. */
export const BRAND_OWNER_DEPTH = 0;

/** Τα πεδία ταυτότητας του SKU — και οι διαδρομές τους στα ευρήματα (`variants.<id>.<πεδίο>`). */
export const TRADE_IDENTITY_FIELDS = ['gtin', 'mpn', 'noGtinReason'] as const;
export type TradeIdentityField = (typeof TRADE_IDENTITY_FIELDS)[number];

/** Το πεδίο της μάρκας — η διαδρομή του στα ευρήματα. */
export const BRAND_FIELD = 'brand';

/** Κάθε **δημιουργία** ορισμού ξεκινά από εδώ — καμία χειρόγραφη τριάδα `null`. */
export const EMPTY_TRADE_IDENTITY: CatalogTradeIdentity = { gtin: null, mpn: null, noGtinReason: null };
export const EMPTY_BRAND: Pick<CatalogValueHolder, 'brand'> = { brand: null };

/** Η μάρκα ενός φορέα, με ασφαλή προεπιλογή για έγγραφα πριν από το Σ1β. */
export function brandOf(holder: Partial<Pick<CatalogValueHolder, 'brand'>>): string | null {
  return holder.brand ?? null;
}

/** Τα πεδία ταυτότητας ενός SKU, με ασφαλή προεπιλογή για έγγραφα πριν από το Σ1β. */
export function tradeIdentityOf(holder: Partial<CatalogTradeIdentity>): CatalogTradeIdentity {
  return { gtin: holder.gtin ?? null, mpn: holder.mpn ?? null, noGtinReason: holder.noGtinReason ?? null };
}

/** Η μάρκα που **ισχύει** για έναν φορέα: του κατόχου της (βάθος 0). Η παραλλαγή δεν έχει δική της. */
export function brandOfChain(chain: readonly InheritanceLink[]): string | null {
  const owner = chain[BRAND_OWNER_DEPTH];
  return owner ? brandOf(owner.holder) : null;
}

/** Κείμενο του ανθρώπου → τιμή πεδίου: χωρίς περιττά κενά· κενό ⇒ `null` (κανένα «κενό αλλά δηλωμένο»). */
function textOrNull(text: string | null): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * Ό,τι πληκτρολόγησε ο άνθρωπος → η τιμή του `gtin`: τα ψηφία χωρίς διαχωριστικά όταν είναι **μόνο** ψηφία (η κανονική
 * μορφή)· αλλιώς το κείμενο ως έχει, ώστε ο επικυρωτής να πει **τι** φταίει (`gtinInvalid`) αντί να χαθεί σιωπηλά.
 */
export function gtinInputOf(text: string | null): string | null {
  const trimmed = textOrNull(text);
  return trimmed === null ? null : gtinDigitsOf(trimmed) ?? trimmed;
}

export function writeBrand<H extends Pick<CatalogValueHolder, 'brand'>>(holder: H, text: string | null): H {
  return { ...holder, brand: textOrNull(text) };
}

export function writeMpn<H extends CatalogTradeIdentity>(holder: H, text: string | null): H {
  return { ...holder, mpn: textOrNull(text) };
}

/** Γράψε (ή σβήσε) το GTIN — ένα GTIN **σβήνει** τη δήλωση «χωρίς GTIN». */
export function writeGtin<H extends CatalogTradeIdentity>(holder: H, text: string | null): H {
  const gtin = gtinInputOf(text);
  return { ...holder, gtin, noGtinReason: gtin === null ? holder.noGtinReason : null };
}

/**
 * Δήλωσε (ή άρε με `null`) «χωρίς GTIN» — σβήνει το GTIN. Η **άρση** επαναφέρει το GTIN του `saved` (ο διακόπτης
 * αντιστρέφεται, ίδιο μάθημα με το `writeNoValueReason`: αλλιώς η αποθήκευση θα έσβηνε οριστικά τον κωδικό).
 */
export function writeNoGtinReason<H extends CatalogTradeIdentity>(holder: H, reason: NoValueReason | null, saved: Partial<CatalogTradeIdentity> | null): H {
  if (reason !== null) return { ...holder, gtin: null, noGtinReason: reason };
  const restored = holder.gtin ?? (saved ? tradeIdentityOf(saved).gtin : null);
  return { ...holder, gtin: restored, noGtinReason: null };
}
