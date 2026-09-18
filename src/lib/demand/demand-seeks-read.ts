/**
 * @fileoverview **ΑΝΑΓΝΩΣΗ ΤΩΝ ΕΝΑΛΛΑΚΤΙΚΩΝ** — `seeks` αποθηκευμένο → `DemandSeek[]`, ή όνομα.
 * @related ADR-777 §8.60.15 · lib/demand/property-demand-from-document.ts · scripts/migrations/migrate-demand-seek-prices.ts
 * @module lib/demand/demand-seeks-read
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΣΧΗΜΑΤΑ ΣΤΟΝ ΔΙΣΚΟ, ΕΝΑ ΣΤΗ ΜΝΗΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Σχήμα | `seeks` | τιμή |
 * |---|---|---|
 * | **παλιό** (ως 2026-09-18) | `['sell', 'leaseOut']` | **ένα** `features.priceMin/priceMax`, χωρίς μονάδα |
 * | **νέο** | `[{ kind: 'sell', price: { min, max } }, …]` | **ανά** εναλλακτική, στη μονάδα της |
 *
 * Το παλιό αναβαθμίζεται **στη μνήμη** (Google: «read both, write new»): κάθε ανάγνωση βλέπει το
 * νέο σχήμα από την πρώτη μέρα, και κάθε **επεξεργασία** το γράφει. Η μετανάστευση
 * (`scripts/migrations/migrate-demand-seek-prices.ts`) καλεί **αυτή** τη συνάρτηση — **καμία**
 * δεύτερη λογική αναβάθμισης.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΠΟΤΕ ΜΑΝΤΕΨΙΑ ΜΟΝΑΔΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Παλιό έγγραφο με **πάνω από μία** διάθεση με τιμή **και** εύρος: το ποσό **δεν** ανατίθεται σε
 * καμία — 250.000 δεν ξέρουμε αν ήταν € ή €/μήνα. ⇒ `'ambiguous-price'`, που το σύνορο κάνει
 * **ονομασμένο κενό** (RESO `Incomplete`: ορατή στον κάτοχο, εκτός αγοράς, διορθώνεται με μια
 * επεξεργασία). Μετρημένο 2026-09-18: **0** τέτοια έγγραφα στην παραγωγή — ο κλάδος είναι φρουρός.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Καμία Firestore, καμία React.
 */

import { isOfferKind, type OfferKind } from '@/types/property-offers';
import {
  NO_AMOUNT_RANGE,
  demandSeek,
  isAmountRangeSet,
  isPricedSeek,
  type DemandAmountRange,
  type DemandSeek,
} from '@/types/property-demand';

/** Το αποτέλεσμα — **ονομασμένο**, ποτέ `null` που σημαίνει πολλά. */
export type SeeksRead =
  /** Διαβάστηκε. `legacy` = ήρθε από το παλιό σχήμα (η μετανάστευση γράφει **μόνο** αυτά). */
  | { readonly kind: 'read'; readonly seeks: readonly DemandSeek[]; readonly legacy: boolean }
  /** Παλιό σχήμα, πολλές διαθέσεις με τιμή, ένα αμονάδιστο εύρος — **δεν** μαντεύεται. */
  | { readonly kind: 'ambiguous-price' }
  /** Ούτε το ένα σχήμα ούτε το άλλο (λείπει · άγνωστο είδος · χαλασμένο ποσό). */
  | { readonly kind: 'unreadable' };

const UNREADABLE: SeeksRead = { kind: 'unreadable' };

/** Τα δύο πεδία του παλιού σχήματος — **μόνο** εδώ ονομάζονται (η μετανάστευση τα διαβάζει από εδώ). */
export const LEGACY_PRICE_KEYS: ReadonlySet<string> = new Set(['priceMin', 'priceMax']);

/** Ποσό ή «χωρίς όριο»· `undefined` = **χαλασμένο** (όχι αριθμός, όχι `null`). */
function amountOrNull(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Εύρος από δύο αποθηκευμένες τιμές — `null` όταν κάποια είναι χαλασμένη. */
function rangeFrom(min: unknown, max: unknown): DemandAmountRange | null {
  const low = amountOrNull(min);
  const high = amountOrNull(max);
  return low === undefined || high === undefined ? null : { min: low, max: high };
}

/** Μία εναλλακτική του **νέου** σχήματος — `null` όταν δεν διαβάζεται. */
function seekFrom(value: unknown): DemandSeek | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { kind, price } = value as { kind?: unknown; price?: unknown };
  if (!isOfferKind(kind)) return null;
  if (kind === 'exchange') return demandSeek(kind, NO_AMOUNT_RANGE);
  if (typeof price !== 'object' || price === null) return null;
  const range = rangeFrom((price as { min?: unknown }).min, (price as { max?: unknown }).max);
  return range === null ? null : demandSeek(kind, range);
}

/** Το **παλιό** σχήμα: είδη + ένα αμονάδιστο εύρος στα χαρακτηριστικά. */
function readLegacy(kinds: readonly OfferKind[], features: unknown): SeeksRead {
  const stored = (typeof features === 'object' && features !== null ? features : {}) as {
    priceMin?: unknown;
    priceMax?: unknown;
  };
  const range = rangeFrom(stored.priceMin, stored.priceMax);
  if (range === null) return UNREADABLE;

  const unbounded = kinds.map((kind) => demandSeek(kind, NO_AMOUNT_RANGE));
  const priced = unbounded.filter(isPricedSeek);
  if (!isAmountRangeSet(range) || priced.length === 0) {
    return { kind: 'read', seeks: unbounded, legacy: true };
  }
  if (priced.length > 1) return { kind: 'ambiguous-price' };

  // Μία μόνο διάθεση με τιμή ⇒ η μονάδα είναι **μονοσήμαντη**, όχι μαντεψιά.
  const [owner] = priced;
  return {
    kind: 'read',
    seeks: kinds.map((kind) => demandSeek(kind, kind === owner.kind ? range : NO_AMOUNT_RANGE)),
    legacy: true,
  };
}

/**
 * **Διαβάζει το `seeks` ενός αποθηκευμένου εγγράφου** — νέο σχήμα, παλιό σχήμα, ή όνομα.
 *
 * @param seeks    Το αποθηκευμένο `seeks`.
 * @param features Τα αποθηκευμένα `features` — διαβάζονται **μόνο** για το παλιό εύρος.
 */
export function readStoredSeeks(seeks: unknown, features: unknown): SeeksRead {
  if (!Array.isArray(seeks)) return UNREADABLE;
  if (seeks.every((value) => typeof value === 'string')) {
    return seeks.every(isOfferKind) ? readLegacy(seeks, features) : UNREADABLE;
  }
  const read = seeks.map(seekFrom);
  return read.every((seek): seek is DemandSeek => seek !== null)
    ? { kind: 'read', seeks: read, legacy: false }
    : UNREADABLE;
}

/**
 * Τα χαρακτηριστικά **χωρίς** το παλιό αμονάδιστο εύρος — ώστε κανένα αντικείμενο στη μνήμη να
 * μην κουβαλά ποσό που **κανείς δεν κρίνει** (η τιμή ζει πια στο `seeks`).
 */
export function featuresWithoutLegacyPrice(features: unknown): unknown {
  if (typeof features !== 'object' || features === null) return features;
  return Object.fromEntries(
    Object.entries(features).filter(([key]) => !LEGACY_PRICE_KEYS.has(key)),
  );
}
