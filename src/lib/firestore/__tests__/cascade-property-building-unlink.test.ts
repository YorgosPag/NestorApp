/**
 * ADR-898 §21.6 Ε6-α — **η αποσύνδεση μονάδας από κτίριο ΔΕΝ αδειάζει το έργο της** (πρότυπο Revit «Not Placed» ·
 * ADR-284). Ως τις 2026-10-05 ο καταρράκτης `property-building` έγραφε `projectId: null` + `linkedCompanyId: null`, και
 * «αποσύνδεση + νέα σύνδεση» άλλαζε έργο σε μονάδα. Η σύνδεση συνεχίζει να γράφει την αλυσίδα του κτιρίου.
 */

jest.mock('server-only', () => ({}));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'NOW' } }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));

const mockUpdates: Array<{ path: string; data: Record<string, unknown> }> = [];
const mockDocs: Record<string, Record<string, Record<string, unknown>>> = {
  buildings: { bld_B: { projectId: 'prj_1', companyId: 'comp_1' } },
  projects: { prj_1: { linkedCompanyId: 'cont_1' } },
};
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: mockDocs[name]?.[id] !== undefined, data: () => mockDocs[name]?.[id] }),
        update: async (data: Record<string, unknown>) => { mockUpdates.push({ path: `${name}/${id}`, data }); },
      }),
    }),
  }),
}));

import { propagatePropertyBuildingLink } from '../cascade-propagation.service';

beforeEach(() => { mockUpdates.length = 0; });

describe('propagatePropertyBuildingLink', () => {
  it('🔴 αποσύνδεση ⇒ ΚΑΜΙΑ γραφή: ούτε `projectId`, ούτε `linkedCompanyId` αδειάζουν', async () => {
    const result = await propagatePropertyBuildingLink('prop_1', null);
    expect(result.success).toBe(true);
    expect(mockUpdates).toEqual([]);
  });

  it('σύνδεση ⇒ η αλυσίδα του κτιρίου γράφεται όπως πριν', async () => {
    await propagatePropertyBuildingLink('prop_1', 'bld_B');
    expect(mockUpdates).toEqual([
      { path: 'properties/prop_1', data: { projectId: 'prj_1', companyId: 'comp_1', linkedCompanyId: 'cont_1', updatedAt: 'NOW' } },
    ]);
  });
});
