/**
 * ADR-923 κύμα 3 Λ5β — η ανάκληση συνδέσμου κοινοποίησης PO.
 *
 * Κάτοχος ενός συνδέσμου είναι ο κάτοχος της PO του: η σύγκριση γίνεται με το `poId` του
 * συνδέσμου (η PO έχει ήδη περάσει τον φράχτη `findOwnedPO` στο route), ΟΧΙ με το `companyId` που
 * γράφτηκε πάνω του — εκείνο ήταν η εταιρεία του δημιουργού, και οι παλιοί σύνδεσμοι του
 * υπερδιαχειριστή έγραφαν τη δική του.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/services/enterprise-id.service', () => ({ generateShareId: jest.fn(() => 'share_x') }));

var stored: Record<string, unknown> | null = null;
var update = jest.fn(async () => undefined);
jest.mock('@/lib/firebaseAdmin', () => ({
  FieldValue: { increment: jest.fn() },
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: stored !== null, data: () => stored }),
        update,
      }),
    }),
  }),
}));

import { revokePOShare } from '../po-share-service';

beforeEach(() => {
  jest.clearAllMocks();
  stored = null;
});

describe('revokePOShare — ο κάτοχος της PO ανακαλεί τους συνδέσμους της', () => {
  it('share of this PO → revoked', async () => {
    stored = { id: 's1', poId: 'po_1', companyId: 'comp_1', isActive: true };
    await expect(revokePOShare({ shareId: 's1', poId: 'po_1' })).resolves.toBe('revoked');
    expect(update).toHaveBeenCalledWith({ isActive: false });
  });

  it('old super-admin share stamped with ANOTHER company, same PO → the PO owner can still revoke it', async () => {
    stored = { id: 's1', poId: 'po_1', companyId: 'comp_superadmin', isActive: true };
    await expect(revokePOShare({ shareId: 's1', poId: 'po_1' })).resolves.toBe('revoked');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('share of ANOTHER PO → not_found, nothing written', async () => {
    stored = { id: 's9', poId: 'po_other', companyId: 'comp_1', isActive: true };
    await expect(revokePOShare({ shareId: 's9', poId: 'po_1' })).resolves.toBe('not_found');
    expect(update).not.toHaveBeenCalled();
  });

  it('missing share → not_found, nothing written', async () => {
    await expect(revokePOShare({ shareId: 'nope', poId: 'po_1' })).resolves.toBe('not_found');
    expect(update).not.toHaveBeenCalled();
  });

  it('empty poId on both sides never matches (empty is absence, not an id)', async () => {
    stored = { id: 's1', poId: '', companyId: 'comp_1', isActive: true };
    await expect(revokePOShare({ shareId: 's1', poId: '' })).resolves.toBe('not_found');
    expect(update).not.toHaveBeenCalled();
  });
});
