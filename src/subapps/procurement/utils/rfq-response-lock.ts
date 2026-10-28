/**
 * **Κλείδωμα ποσότητας/μονάδας** της απάντησης σε γραμμή RFQ (ADR-327 §8.5 Β) — ΟΙ κανόνες, μία φορά, καθαροί
 * (server: `applyRfqLineAuthority` · πύλη: πεδία μόνο-ανάγνωσης · PM: ρύθμιση στη σελίδα RFQ).
 *
 * Πρότυπο Procore «Unit & Quantity Lock» (Feb 2026): ο αναθέτων κλειδώνει ποσότητα και μονάδα, ο προμηθευτής
 * συμπληρώνει **μόνο** τιμή μονάδας ⇒ οι προσφορές συγκρίνονται χωρίς κανονικοποίηση. Πού πάμε πιο πέρα:
 * - **προεπιλογή από την προέλευση**: γραμμές από επιμέτρηση (BOQ) γεννιούνται κλειδωμένες — η ποσότητα είναι
 *   η επιμέτρηση του έργου, όχι εκτίμηση του προμηθευτή· ad-hoc γραμμές μένουν ελεύθερες (στον Procore: πάντα off)·
 * - **κλείδωμα μόνο όπου υπάρχει τιμή να κλειδωθεί**: γραμμή RFQ χωρίς ποσότητα/μονάδα δεν «κλειδώνει» σε κενό·
 * - οι **εναλλακτικές** μένουν πάντα ελεύθερες — είναι άλλο προϊόν, συχνά με άλλη μονάδα.
 *
 * @module subapps/procurement/utils/rfq-response-lock
 * @enterprise ADR-327 §8.5 Β
 */

import type { RFQ, RfqLineSource, RfqResponseLock } from '../types/rfq';
import type { PublicRfqLine } from '../types/rfq-line';

export const UNLOCKED_RESPONSE: RfqResponseLock = Object.freeze({ quantity: false, unit: false });

const LOCKED_RESPONSE: RfqResponseLock = Object.freeze({ quantity: true, unit: true });

/** Η προεπιλογή **κατά τη δημιουργία** του RFQ: επιμέτρηση ⇒ κλειδωμένο· οτιδήποτε άλλο ⇒ ελεύθερο. */
export function defaultResponseLock(linesStorage: RfqLineSource | 'inline_legacy' | null): RfqResponseLock {
  return linesStorage === 'boq' ? { ...LOCKED_RESPONSE } : { ...UNLOCKED_RESPONSE };
}

/** Ο ΜΟΝΟΣ αναγνώστης του `RFQ.responseLock`: έγγραφα πριν το §8.5 Β (χωρίς πεδίο) = ελεύθερα, ποτέ σιωπηλή αλλαγή. */
export function resolveResponseLock(rfq: Pick<RFQ, 'responseLock'>): RfqResponseLock {
  const lock = rfq.responseLock;
  return lock ? { quantity: lock.quantity === true, unit: lock.unit === true } : { ...UNLOCKED_RESPONSE };
}

/** Η τιμή που επιβάλλεται σε κάθε πεδίο — `null` = ελεύθερο πεδίο. */
export interface LockedFields {
  quantity: number | null;
  unit: string | null;
}

/** Τι κλειδώνει **σε αυτή τη γραμμή**: μόνο ό,τι η γραμμή RFQ ορίζει (θετική ποσότητα · μη κενή μονάδα). */
export function lockedFieldsOf(
  lock: RfqResponseLock,
  rfqLine: Pick<PublicRfqLine, 'quantity' | 'unit'>,
): LockedFields {
  const quantity = rfqLine.quantity;
  const unit = rfqLine.unit?.trim();
  return {
    quantity: lock.quantity && typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 ? quantity : null,
    unit: lock.unit && unit ? unit : null,
  };
}

export function sameResponseLock(a: RfqResponseLock, b: RfqResponseLock): boolean {
  return a.quantity === b.quantity && a.unit === b.unit;
}

/** Γραμμή ιστορικού RFQ — σταθερή, μηχανικά αναγνώσιμη (`quantity:on,unit:off`). */
export function describeResponseLock(lock: RfqResponseLock): string {
  return `quantity:${lock.quantity ? 'on' : 'off'},unit:${lock.unit ? 'on' : 'off'}`;
}
