/**
 * @fileoverview **ΑΝΑΓΝΩΣΗ ΤΩΝ ΕΝΑΛΛΑΚΤΙΚΩΝ** — `seeks` αποθηκευμένο → `DemandSeek[]`, ή όνομα.
 * @related ADR-777 §8.60.15 · §8.60.17 · §8.60.19 · lib/demand/property-demand-from-document.ts · scripts/migrations/migrate-demand-seek-prices.ts
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
  NO_NIGHTS_RANGE,
  demandSeek,
  exchangeSeek,
  isAmountRangeSet,
  isPricedSeek,
  shortStaySeek,
  type DemandAmountRange,
  type DemandSeek,
  type StayParty,
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

/** Αντικείμενο αποθηκευμένο — όχι πίνακας, όχι `null`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Η παρέα — απούσα ⇒ `null` (καμία)· χαλασμένη ⇒ `undefined`. Το **νόημα** το κρίνουν τα αναλλοίωτα. */
function partyFrom(value: unknown): StayParty | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return undefined;
  const [adults, children, infants] = [value.adults, value.children, value.infants].map(amountOrNull);
  if (adults == null || children == null || infants == null) return undefined;
  return { adults, children, infants };
}

/** Το εύρος νυχτών — απόν ⇒ χωρίς όριο· χαλασμένο ⇒ `null`. */
function nightsFrom(value: unknown): DemandAmountRange | null {
  if (value === null || value === undefined) return NO_NIGHTS_RANGE;
  return isRecord(value) ? rangeFrom(value.min, value.max) : null;
}

/**
 * Οι όροι διαμονής (ADR-777 §8.60.19). **Απόντες = καμία συνθήκη**: τα έγγραφα πριν από την ερώτηση
 * είναι σωστά ως έχουν — **καμία μετανάστευση**. Χαλασμένοι ⇒ ολόκληρη η εναλλακτική αδιάβαστη.
 */
function shortStayFrom(range: DemandAmountRange, stored: Record<string, unknown>): DemandSeek | null {
  const nights = nightsFrom(stored.nights);
  const party = partyFrom(stored.party);
  return nights === null || party === undefined ? null : shortStaySeek(range, nights, party);
}

/** Μία εναλλακτική του **νέου** σχήματος — `null` όταν δεν διαβάζεται. */
function seekFrom(value: unknown): DemandSeek | null {
  if (!isRecord(value)) return null;
  const { kind, price, landownerShareMax } = value;
  if (!isOfferKind(kind)) return null;
  if (kind === 'exchange') {
    // ADR-777 §8.60.17 — η οροφή ποσοστού οικοπεδούχου. **Απούσα = καμία οροφή**: τα έγγραφα πριν
    // από την ερώτηση είναι σωστά ως έχουν (καμία μετανάστευση). Χαλασμένη ⇒ ολόκληρη αδιάβαστη.
    const share = amountOrNull(landownerShareMax);
    return share === undefined ? null : exchangeSeek(share);
  }
  if (!isRecord(price)) return null;
  const range = rangeFrom(price.min, price.max);
  if (range === null) return null;
  return kind === 'leaseShort' ? shortStayFrom(range, value) : demandSeek(kind, range);
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
