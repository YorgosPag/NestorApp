/**
 * ADR-898 §21 · ADR-239 — **τοποθέτηση ≠ μετακίνηση**: το κλείδωμα του πωλημένου χώρου απαγορεύει να ΦΥΓΕΙ από κτίριο,
 * όχι να τοποθετηθεί από το κενό. Και το `recordLinkChange` (μετάπτωση) δίνει τον ΙΔΙΟ cascade + το ΙΔΙΟ ίχνος με το
 * `linkEntity`, και τα ΠΕΡΙΜΕΝΕΙ — αλλιώς το `process.exit` του script θα τα έκοβε.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: jest.fn(() => Promise.resolve()) }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(() => Promise.resolve('aud_1')) } }));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('../cascade-propagation.service', () => ({
  propagateChildBuildingLink: jest.fn(() => Promise.resolve({})),
  propagatePropertyBuildingLink: jest.fn(),
  propagateBuildingProjectLink: jest.fn(),
  propagateProjectCompanyLink: jest.fn(),
}));

import type { AuthContext } from '@/lib/auth';
import { EntityAuditService } from '@/services/entity-audit.service';

import { propagateChildBuildingLink } from '../cascade-propagation.service';
import { linkEntity, recordLinkChange } from '../entity-linking.service';

const ctx = { uid: 'u1', email: 'g@x', companyId: 'c1' } as AuthContext;

beforeEach(() => jest.clearAllMocks());

describe('linkEntity — κλείδωμα πωλημένου χώρου', () => {
  it('πωλημένος χώρος ΧΩΡΙΣ κτίριο ⇒ τοποθετείται (cascade + ίχνος «linked»)', async () => {
    const result = await linkEntity('parking:buildingId', { auth: ctx, entityId: 'p1', newLinkValue: 'A', existingDoc: { status: 'sold' } });
    expect(result.changed).toBe(true);
    expect(propagateChildBuildingLink).toHaveBeenCalledWith('parking_spots', 'p1', 'A');
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({ action: 'linked', entityId: 'p1' }));
  });

  it('πωλημένος χώρος ΣΕ κτίριο ⇒ η μετακίνηση μένει κλειδωμένη (403)', async () => {
    await expect(
      linkEntity('parking:buildingId', { auth: ctx, entityId: 'p1', newLinkValue: 'B', existingDoc: { status: 'sold', buildingId: 'A' } }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(propagateChildBuildingLink).not.toHaveBeenCalled();
  });
});

describe('recordLinkChange', () => {
  it('ΙΔΙΟΣ cascade + ΙΔΙΟ ίχνος με τον εκτελεστή του συστήματος — και τα περιμένει', async () => {
    let auditDone = false;
    (EntityAuditService.recordChange as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => { auditDone = true; resolve('aud_2'); }, 5)),
    );
    await recordLinkChange('storage:buildingId', {
      entityId: 's1', existingDoc: { name: 'Α-1' }, oldValue: null, newValue: 'A',
      performedBy: 'system', performedByName: 'System', companyId: 'c1',
    });
    expect(auditDone).toBe(true);
    expect(propagateChildBuildingLink).toHaveBeenCalledWith('storage_units', 's1', 'A');
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityName: 'Α-1', action: 'linked', performedBy: 'system', companyId: 'c1',
      changes: [{ field: 'buildingId', oldValue: null, newValue: 'A', label: 'buildingId' }],
    }));
  });

  it('καμία αλλαγή ⇒ τίποτα · αποτυχία ίχνους ⇒ ποτέ δεν απορρίπτεται', async () => {
    await recordLinkChange('parking:buildingId', {
      entityId: 'p1', existingDoc: {}, oldValue: 'A', newValue: 'A', performedBy: 'system', performedByName: null, companyId: 'c1',
    });
    expect(propagateChildBuildingLink).not.toHaveBeenCalled();
    (EntityAuditService.recordChange as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('down')));
    await expect(recordLinkChange('parking:buildingId', {
      entityId: 'p1', existingDoc: {}, oldValue: null, newValue: 'A', performedBy: 'system', performedByName: null, companyId: 'c1',
    })).resolves.toBeUndefined();
  });
});
