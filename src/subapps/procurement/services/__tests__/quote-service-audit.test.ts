/**
 * ΑΓΚΥΡΑ — **η αλλαγή προμηθευτή προσφοράς φτάνει στο Ιστορικό, με ΟΝΟΜΑ** (ADR-327 §8.5 Γ · ADR-195, 2026-10-29).
 *
 * Μετρημένο ζωντανά (QT-0004, 2026-10-28): «Άλλαξε σε MACON ATEE» έγραφε μόνο στο ενσωματωμένο `auditTrail`· η
 * καρτέλα «Ιστορικό» του RFQ (entity audit) δεν έβλεπε τίποτα, γιατί η `updateQuote` έγραφε **χειρόγραφα** μόνο το
 * `status`. Τώρα περνά από τον ΕΝΑ γραφέα (`recordEntityUpdate`) με το μητρώο και τον επιλυτή επαφής του μισθωτή.
 */

/* global describe, it, expect, beforeEach, jest */

import type { AuthContext } from '@/lib/auth';
import { recordEntityUpdate } from '@/services/audit/record-entity-update';
import { ownedContactNameResolver } from '@/server/lib/owned-contact-name-resolver';
import { updateQuote } from '../quote-service';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('firebase-admin', () => ({
  __esModule: true,
  default: { firestore: { Timestamp: { now: () => 'ts_now', fromDate: (d: Date) => d } } },
}));
const fakeDb = { collection: () => ({ doc: () => ({}) }) };
jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: (op: (db: unknown) => unknown) => op(fakeDb),
  getAdminFirestore: () => fakeDb,
  isFirebaseAdminAvailable: () => true,
}));
const update = jest.fn().mockResolvedValue(undefined);
const current = {
  id: 'qt_1', companyId: 'co_owner', displayNumber: 'QT-0004', rfqId: null, status: 'under_review',
  vendorContactId: 'cont_old', lines: [], auditTrail: [], quotedTotal: null,
};
jest.mock('../procurement-owned-doc', () => ({
  PROCUREMENT_RESOURCE: { QUOTE: 'quote' },
  loadOwnedProcurementDoc: async () => ({ ref: { update }, current }),
  readOwnedProcurementDoc: jest.fn(),
}));
jest.mock('../quote-rfq-binding-guard', () => ({ assertPmRfqBinding: jest.fn() }));
jest.mock('../quote-change-stamp', () => ({ quoteChangeStamp: () => ({}) }));
jest.mock('../quote-counters', () => ({ getNextQuoteNumber: jest.fn() }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));
jest.mock('@/services/audit/record-entity-update', () => ({
  recordEntityUpdate: jest.fn().mockResolvedValue({ auditId: 'eaud_1', changes: [] }),
}));
const resolver = jest.fn();
jest.mock('@/server/lib/owned-contact-name-resolver', () => ({ ownedContactNameResolver: jest.fn(() => resolver) }));

const record = recordEntityUpdate as jest.MockedFunction<typeof recordEntityUpdate>;
const resolverFactory = ownedContactNameResolver as jest.MockedFunction<typeof ownedContactNameResolver>;
const ctx = { uid: 'u_1', email: 'a@alpha.gr', companyId: 'co_caller' } as unknown as AuthContext;

beforeEach(() => {
  record.mockClear();
  resolverFactory.mockClear();
});

describe('updateQuote → Ιστορικό', () => {
  it('Π1 — αλλαγή προμηθευτή: ο ΕΝΑΣ γραφέας, με επιλυτή ονόματος ΤΟΥ ΜΙΣΘΩΤΗ ΤΗΣ ΠΡΟΣΦΟΡΑΣ', async () => {
    await updateQuote(ctx, 'qt_1', { vendorContactId: 'cont_new' });

    expect(record).toHaveBeenCalledTimes(1);
    const input = record.mock.calls[0][0];
    expect(input).toMatchObject({ entityType: 'quote', entityId: 'qt_1', entityName: '#QT-0004', action: 'updated' });
    expect(input.before).toMatchObject({ vendorContactId: 'cont_old' });
    expect(input.written).toMatchObject({ vendorContactId: 'cont_new' });
    expect(input.resolvers?.vendorContactId).toBe(resolver);
    expect(resolverFactory).toHaveBeenCalledWith(fakeDb, 'co_owner');
  });

  it('Π2 — αλλαγή κατάστασης: η πράξη μένει `status_changed` (εικονίδιο/φίλτρο του Ιστορικού)', async () => {
    await updateQuote(ctx, 'qt_1', { status: 'accepted' });

    expect(record.mock.calls[0][0]).toMatchObject({ action: 'status_changed', written: { status: 'accepted' } });
  });
});
