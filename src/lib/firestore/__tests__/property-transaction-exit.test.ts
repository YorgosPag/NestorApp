/**
 * ⚓ ADR-777 §8.60.20 · ADR-249 — ΕΞΟΔΟΣ ΑΠΟ ΣΥΝΑΛΛΑΓΗ ΜΟΝΟ ΑΠΟ ΤΗ ΔΙΚΗ ΤΗΣ ΠΡΑΞΗ (PATCH ακινήτου).
 *
 * Το κενό (μετρημένο 2026-09-18): το `RESERVED_LOCKED_FIELDS` κλειδώνει μόνο `code`/`type`/`name`,
 * άρα ένα PATCH `reserved → for-rent` περνούσε και το ακίνητο έβγαινε από την κράτηση **με τον
 * αγοραστή ακόμη γραμμένο**. Ίδιος κανόνας με τους χώρους (`mapSpaceCommercialFields`).
 */

import { ApiError } from '@/lib/api/ApiErrorHandler';
import {
  validatePropertyFieldLockingUnlessRevert,
  validateTransactionExit,
} from '../property-field-locking';

function statusOf(run: () => void): number | 'ok' {
  try {
    run();
    return 'ok';
  } catch (error) {
    if (error instanceof ApiError) return error.statusCode;
    throw error;
  }
}

describe('ΕΞΟΔΟΣ ΑΠΟ ΣΥΝΑΛΛΑΓΗ', () => {
  it.each(['for-rent', 'unavailable', 'for-sale-and-rent'])(
    '🔴 1 — το κενό: `reserved → %s` από φόρμα ⇒ 409',
    (target) => {
      expect(statusOf(() => validatePropertyFieldLockingUnlessRevert('reserved', { commercialStatus: target }))).toBe(409);
    },
  );

  it('2 — η επίσημη ακύρωση (`reserved → for-sale`, μόνο εμπορικά πεδία) περνά', () => {
    expect(statusOf(() => validatePropertyFieldLockingUnlessRevert('reserved', { commercialStatus: 'for-sale', commercial: {} })))
      .toBe('ok');
  });

  it('3 — συναλλαγή → συναλλαγή (`reserved → sold`) δεν είναι δουλειά αυτού του φρουρού', () => {
    expect(statusOf(() => validateTransactionExit('reserved', { commercialStatus: 'sold' }))).toBe('ok');
  });

  it('4 — ιδεμπότητα: ίδια κατάσταση (π.χ. αλλαγή τιμής σε κρατημένο) περνά', () => {
    expect(statusOf(() => validateTransactionExit('reserved', { commercialStatus: 'reserved' }))).toBe('ok');
    expect(statusOf(() => validateTransactionExit('reserved', { commercial: { askingPrice: 1 } }))).toBe('ok');
  });

  it('5 — μονάδα στην αγορά αλλάζει διάθεση ελεύθερα', () => {
    expect(statusOf(() => validatePropertyFieldLockingUnlessRevert('for-sale', { commercialStatus: 'for-rent' }))).toBe('ok');
  });

  it('6 — πωλημένο: το ADR-249 απαντά ΠΡΩΤΟ (403), όπως πάντα', () => {
    expect(statusOf(() => validatePropertyFieldLockingUnlessRevert('sold', { commercialStatus: 'for-rent' }))).toBe(403);
  });
});
