/**
 * @jest-environment node
 *
 * @fileoverview **Ο δεσμός υλικού ↔ SKU πωλητή** (ADR-923 §5.8): το υλικό δείχνει, δεν αντιγράφει.
 *
 * Κ1 ο διακομιστής γράφει ό,τι έκρινε ο αναγνώστης, ποτέ το σώμα · Κ2 άρνηση = μία ονομασμένη απάντηση και καμία εγγραφή ·
 * Κ3 `null` αποσυνδέει · Κ4 `undefined` δεν αγγίζει · Κ5 η αλλαγή δεσμού γράφεται στο ιστορικό · Κ6 το σχήμα πετά `catalogRef` από το σώμα.
 */

jest.mock('server-only', () => ({}));

const mockResolve = jest.fn();
jest.mock('@/server/supply-relationships/supply-foreign-quote.server', () => ({
  resolveForeignSku: (...args: unknown[]) => mockResolve(...args),
}));

jest.mock('firebase-admin', () => ({ firestore: { Timestamp: { now: jest.fn(() => ({ seconds: 1, nanoseconds: 0 })) } } }));
jest.mock('@/utils/firestore-sanitize', () => ({ sanitizeForFirestore: jest.fn((x: unknown) => x) }));
jest.mock('@/services/enterprise-id.service', () => ({ generateMaterialId: jest.fn(() => 'mat_1') }));
const mockAudit = jest.fn().mockResolvedValue(null);
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: (...args: unknown[]) => mockAudit(...args) } }));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) }));
jest.mock('@/config/boq-categories', () => ({ ATOE_MASTER_CATEGORIES: [{ code: 'OIK-1' }] }));
jest.mock('@/lib/safe-fire-and-forget', () => ({ safeFireAndForget: (promise: Promise<unknown>) => promise }));

const mockCurrent = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue(undefined);
jest.mock('../procurement-owned-doc', () => ({
  PROCUREMENT_RESOURCE: { MATERIAL: 'material' },
  loadOwnedProcurementDoc: jest.fn(async () => ({ ref: { update: mockUpdate }, current: mockCurrent() })),
  readOwnedProcurementDoc: jest.fn(),
  softDeleteOwnedProcurementDoc: jest.fn(),
}));

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({ set: mockSet })),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [] }),
  })),
};
jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: jest.fn(async (op: (db: typeof mockDb) => Promise<unknown>) => op(mockDb)),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθεί η υπηρεσία */
import type { AuthContext } from '@/lib/auth';
import { createMaterial, updateMaterial } from '../material-service';
import { MaterialValidationError } from '../../types/material';
/* eslint-enable import/first */

const ctx = { uid: 'u1', companyId: 'co1' } as AuthContext;
const LINK = { relationshipId: 'srel_1', variantId: 'var_1' };
const SKU = { supplierCompanyId: 'comp-aries', variantId: 'var_1' };
const BASE = { code: 'CEM-1', name: 'Τσιμέντο', unit: 'pcs', atoeCategoryCode: 'OIK-1' } as const;

beforeEach(() => {
  jest.clearAllMocks();
  mockResolve.mockResolvedValue(SKU);
  mockCurrent.mockReturnValue({ ...BASE, id: 'mat_1', companyId: 'co1', isDeleted: false, catalogRef: null });
});

describe('createMaterial', () => {
  it('Κ1 γράφει τον δεσμό που έκρινε ο αναγνώστης, από τον χώρο του καλούντος', async () => {
    const material = await createMaterial(ctx, { ...BASE, catalogLink: LINK });
    expect(mockResolve).toHaveBeenCalledWith(ctx, LINK);
    expect(material.catalogRef).toEqual(SKU);
  });

  it('Κ1α χωρίς δεσμό: καμία ανάγνωση ξένου καταλόγου', async () => {
    expect((await createMaterial(ctx, BASE)).catalogRef).toBeNull();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('Κ2 🔴 άρνηση ⇒ ονομασμένο σφάλμα και καμία εγγραφή', async () => {
    mockResolve.mockResolvedValue(null);
    await expect(createMaterial(ctx, { ...BASE, catalogLink: LINK })).rejects.toBeInstanceOf(MaterialValidationError);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('updateMaterial', () => {
  it('Κ2α άρνηση ⇒ καμία εγγραφή', async () => {
    mockResolve.mockResolvedValue(null);
    await expect(updateMaterial(ctx, 'mat_1', { catalogLink: LINK })).rejects.toBeInstanceOf(MaterialValidationError);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('Κ3 `null` αποσυνδέει, χωρίς ανάγνωση', async () => {
    mockCurrent.mockReturnValue({ ...BASE, id: 'mat_1', isDeleted: false, catalogRef: SKU });
    expect((await updateMaterial(ctx, 'mat_1', { catalogLink: null })).catalogRef).toBeNull();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('Κ4 `undefined` δεν αγγίζει το πεδίο · υλικό παλιότερο από το πεδίο διαβάζεται κανονικά', async () => {
    mockCurrent.mockReturnValue({ ...BASE, id: 'mat_1', isDeleted: false });
    await updateMaterial(ctx, 'mat_1', { name: 'Άλλο' });
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('catalogRef');
    expect(mockAudit.mock.calls[0][0].changes).toEqual([]);
  });

  it('Κ5 η αλλαγή δεσμού φαίνεται στο ιστορικό· η επανάληψη της ίδιας όχι', async () => {
    await updateMaterial(ctx, 'mat_1', { catalogLink: LINK });
    expect(mockAudit.mock.calls[0][0].changes).toEqual([{ field: 'catalogRef', oldValue: null, newValue: 'comp-aries/var_1' }]);
    mockCurrent.mockReturnValue({ ...BASE, id: 'mat_1', isDeleted: false, catalogRef: SKU });
    await updateMaterial(ctx, 'mat_1', { catalogLink: LINK });
    expect(mockAudit.mock.calls[1][0].changes).toEqual([]);
  });
});

describe('σχήμα εισόδου', () => {
  it('Κ6 🔴 το σώμα δεν γράφει `catalogRef`: το σχήμα το πετά', () => {
    const { CreateMaterialSchema, UpdateMaterialSchema } = jest.requireActual('@/app/api/procurement/_shared/material-schema');
    const forged = { ...BASE, catalogRef: { supplierCompanyId: 'evil', variantId: 'v' } };
    expect(CreateMaterialSchema.parse(forged)).not.toHaveProperty('catalogRef');
    expect(UpdateMaterialSchema.parse(forged)).not.toHaveProperty('catalogRef');
  });

  it('Κ6α ο πελάτης δεν ονομάζει χώρο: ο δεσμός θέλει σχέση', () => {
    const { UpdateMaterialSchema } = jest.requireActual('@/app/api/procurement/_shared/material-schema');
    expect(UpdateMaterialSchema.safeParse({ catalogLink: { supplierCompanyId: 'x', variantId: 'v' } }).success).toBe(false);
    expect(UpdateMaterialSchema.safeParse({ catalogLink: null }).success).toBe(true);
  });
});
