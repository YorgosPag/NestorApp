/**
 * @fileoverview Κλείδωμα ποσότητας/μονάδας (ADR-327 §8.5 Β) — οι κανόνες και η επιβολή τους από τον server.
 *
 * Κ1 προεπιλογή από την προέλευση: επιμέτρηση (BOQ) ⇒ κλειδωμένο · ad-hoc / legacy / κενό ⇒ ελεύθερο ·
 * Κ2 έγγραφο χωρίς πεδίο (πριν το §8.5 Β) ⇒ ελεύθερο — ποτέ σιωπηλή αλλαγή συμπεριφοράς ·
 * Κ3 κλειδώνει μόνο ό,τι ορίζει η γραμμή RFQ (θετική ποσότητα · μη κενή μονάδα) ·
 * Κ4 server: η βασική απάντηση παίρνει ποσότητα/μονάδα της γραμμής και ξαναϋπολογίζεται η αξία ·
 * Κ5 server: οι εναλλακτικές και οι πρόσθετες γραμμές μένουν ελεύθερες · χωρίς κλείδωμα τίποτα δεν αλλάζει.
 */

import type { QuoteLine } from '../../types/quote';
import type { PublicRfqLine } from '../../types/rfq-line';
import { applyRfqLineAuthority } from '../rfq-line-binding';
import {
  defaultResponseLock,
  describeResponseLock,
  lockedFieldsOf,
  resolveResponseLock,
  UNLOCKED_RESPONSE,
} from '../rfq-response-lock';

const LOCKED = { quantity: true, unit: true };

const rfqLine = (id: string, quantity: number | null, unit: string | null): PublicRfqLine => ({
  id, description: `RFQ ${id}`, trade: 'demolition', categoryCode: null, quantity, unit, notes: null, displayOrder: 0,
});

const line = (rfqLineId: string | null, quantity: number, unit: string, unitPrice = 10): QuoteLine => ({
  id: `ql-${rfqLineId}`, description: 'vendor text', categoryCode: null, quantity, unit, unitPrice, vatRate: 24,
  lineTotal: quantity * unitPrice, notes: null, rfqLineId,
});

describe('defaultResponseLock / resolveResponseLock', () => {
  it('Κ1 — επιμέτρηση ⇒ κλειδωμένο· όλα τα άλλα ⇒ ελεύθερο', () => {
    expect(defaultResponseLock('boq')).toEqual(LOCKED);
    expect(defaultResponseLock('ad_hoc')).toEqual(UNLOCKED_RESPONSE);
    expect(defaultResponseLock('inline_legacy')).toEqual(UNLOCKED_RESPONSE);
    expect(defaultResponseLock(null)).toEqual(UNLOCKED_RESPONSE);
  });

  it('Κ2 — χωρίς πεδίο ⇒ ελεύθερο· με πεδίο ⇒ αυτό που γράφει', () => {
    expect(resolveResponseLock({})).toEqual(UNLOCKED_RESPONSE);
    expect(resolveResponseLock({ responseLock: null })).toEqual(UNLOCKED_RESPONSE);
    expect(resolveResponseLock({ responseLock: { quantity: true, unit: false } })).toEqual({ quantity: true, unit: false });
  });

  it('γραμμή ιστορικού σταθερή', () => {
    expect(describeResponseLock({ quantity: true, unit: false })).toBe('quantity:on,unit:off');
  });
});

describe('lockedFieldsOf', () => {
  it('Κ3 — κλειδώνει μόνο ό,τι ορίζει η γραμμή', () => {
    expect(lockedFieldsOf(LOCKED, rfqLine('L', 12, 'm2'))).toEqual({ quantity: 12, unit: 'm2' });
    expect(lockedFieldsOf(LOCKED, rfqLine('L', null, null))).toEqual({ quantity: null, unit: null });
    expect(lockedFieldsOf(LOCKED, rfqLine('L', 0, '  '))).toEqual({ quantity: null, unit: null });
    expect(lockedFieldsOf({ quantity: false, unit: true }, rfqLine('L', 12, 'm2'))).toEqual({ quantity: null, unit: 'm2' });
  });
});

describe('applyRfqLineAuthority — §8.5 Β', () => {
  const RFQ = [rfqLine('L1', 12, 'm2')];

  it('Κ4 — η βασική απάντηση παίρνει ποσότητα/μονάδα της γραμμής, η αξία ξαναϋπολογίζεται', () => {
    const out = applyRfqLineAuthority(RFQ, { lines: [line('L1', 99, 'pcs')], alternates: [], scopeResponses: [] }, LOCKED);
    expect(out.lines[0]).toMatchObject({ quantity: 12, unit: 'm2', unitPrice: 10, lineTotal: 120, description: 'RFQ L1' });
  });

  it('Κ5 — εναλλακτικές και πρόσθετες ελεύθερες· χωρίς κλείδωμα καμία αλλαγή', () => {
    const answers = { lines: [line('L1', 99, 'pcs'), line(null, 3, 'kg')], alternates: [line('L1', 7, 'pcs')], scopeResponses: [] };
    const locked = applyRfqLineAuthority(RFQ, answers, LOCKED);
    expect(locked.lines[1]).toMatchObject({ quantity: 3, unit: 'kg', lineTotal: 30 });
    expect(locked.alternates[0]).toMatchObject({ quantity: 7, unit: 'pcs', lineTotal: 70 });
    const free = applyRfqLineAuthority(RFQ, answers);
    expect(free.lines[0]).toMatchObject({ quantity: 99, unit: 'pcs', lineTotal: 990 });
  });
});
