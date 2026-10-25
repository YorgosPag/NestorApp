/**
 * Γραφείς δέντρου κατηγοριών και οικογενειών μέτρησης του χώρου (ADR-923 §5.2) πάνω στο επαληθευμένο ψεύτικο
 * Firestore. Η μετακίνηση κλάδου ξαναγράφει ΟΛΟΚΛΗΡΟ το υποδέντρο σε μία συναλλαγή· οι μονάδες σε χρήση είναι
 * append-only.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { AuthContext } from '@/lib/auth';
import type { CatalogCategoryDefinition } from '@/subapps/catalog/types/category';
import type { WorkspaceMeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import { NO_MAPPINGS } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';

const fake = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: async () => undefined }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createCatalogAttributeGroup } from '../attribute-group-writer.server';
import { createCatalogAttribute } from '../attribute-writer.server';
import { createCatalogCategory, deleteCatalogCategory, moveCatalogCategory } from '../category-writer.server';
import {
  createCatalogMeasurementFamily,
  deleteCatalogMeasurementFamily,
  updateCatalogMeasurementFamily,
} from '../measurement-family-writer.server';
import { CatalogWriteError } from '../catalog-write-error';
/* eslint-enable import/first */

const ARIES: AuthContext = {
  uid: 'user-aries', email: 'admin@aries.gr', companyId: 'comp-aries', globalRole: 'company_admin', mfaEnrolled: false,
  isAuthenticated: true,
};

async function rejectionOf(promise: Promise<unknown>): Promise<CatalogWriteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CatalogWriteError) return error;
    throw error;
  }
  throw new Error('expected a CatalogWriteError');
}

const category = (code: string, parentId: string | null, orderKey = 'a0') =>
  createCatalogCategory(ARIES, { code, labels: { el: code }, parentId, orderKey, mappings: { atoeCode: null } });

const read = (id: string) => fake.getData('catalog_categories', id) as CatalogCategoryDefinition & { revision: number };

beforeEach(() => fake.reset());

describe('δέντρο κατηγοριών', () => {
  it('ο γραφέας υπολογίζει τους προγόνους από τον γονέα', async () => {
    const hvac = await category('hvac', null);
    const split = await category('split', hvac.id);
    const wall = await category('wall', split.id);
    expect(wall.ancestorIds).toEqual([hvac.id, split.id]);
  });

  it('μετακίνηση κλάδου ξαναγράφει ΟΛΟ το υποδέντρο, και ανεβάζει την αναθεώρηση κάθε απογόνου', async () => {
    const hvac = await category('hvac', null);
    const solar = await category('solar', null, 'a1');
    const split = await category('split', hvac.id);
    const wall = await category('wall', split.id);
    await moveCatalogCategory(ARIES, split.id, split.revision, { parentId: solar.id, orderKey: 'a0' });
    expect(read(split.id)).toEqual(expect.objectContaining({ parentId: solar.id, ancestorIds: [solar.id] }));
    expect(read(wall.id)).toEqual(expect.objectContaining({ ancestorIds: [solar.id, split.id], revision: 2 }));
  });

  it('κύκλος και ανύπαρκτος γονέας απορρίπτονται πριν από κάθε εγγραφή', async () => {
    const hvac = await category('hvac', null);
    const split = await category('split', hvac.id);
    const cycle = await rejectionOf(moveCatalogCategory(ARIES, hvac.id, 1, { parentId: split.id, orderKey: 'a0' }));
    expect(cycle.issues.map((issue) => issue.code)).toEqual(['categoryCycle']);
    const orphan = await rejectionOf(category('orphan', 'ccat_ghost'));
    expect(orphan.issues.map((issue) => issue.code)).toEqual(['categoryParentUnknown']);
    expect(read(hvac.id).parentId).toBeNull();
  });

  it('διαγραφή κόμβου με παιδιά ⇒ inUse· φύλλο ⇒ soft delete', async () => {
    const hvac = await category('hvac', null);
    const split = await category('split', hvac.id);
    expect((await rejectionOf(deleteCatalogCategory(ARIES, hvac.id, 1))).kind).toBe('inUse');
    expect((await deleteCatalogCategory(ARIES, split.id, 1)).isDeleted).toBe(true);
  });
});

describe('οικογένειες μέτρησης του χώρου', () => {
  const efficacy: WorkspaceMeasurementFamilyDefinition = {
    code: 'luminous_efficacy',
    labels: { el: 'Φωτεινή απόδοση' },
    standardUnitCode: 'lm_W',
    singleUnit: false,
    units: [{ code: 'lm_W', symbol: 'lm/W', factor: 1 }, { code: 'klm_W', symbol: 'klm/W', factor: 1000 }],
  };

  async function useFamily(): Promise<void> {
    const group = await createCatalogAttributeGroup(ARIES, { code: 'optics', labels: { el: 'Οπτικά' }, orderKey: 'a0' });
    await createCatalogAttribute(ARIES, {
      code: 'efficacy', groupId: group.id, labels: { el: 'Απόδοση' }, description: {}, localizable: false, scopable: false,
      unique: false, orderKey: 'a0', mappings: NO_MAPPINGS, type: 'measurement',
      config: { measurementFamilyCode: 'luminous_efficacy', defaultUnitCode: 'lm_W', min: 0, max: null, decimals: 0, negativeAllowed: false },
    });
  }

  it('ο κωδικός της πλατφόρμας είναι δεσμευμένος', async () => {
    const error = await rejectionOf(createCatalogMeasurementFamily(ARIES, { ...efficacy, code: 'power' }));
    expect(error.issues.map((issue) => issue.code)).toContain('reservedPlatformCode');
  });

  it('όσο τη χρησιμοποιεί ιδιότητα: προσθήκη μονάδας ✅ · αλλαγή συντελεστή ⛔ · διαγραφή ⛔', async () => {
    const created = await createCatalogMeasurementFamily(ARIES, efficacy);
    await useFamily();
    const grown = await updateCatalogMeasurementFamily(ARIES, created.id, 1, {
      ...efficacy, units: [...efficacy.units, { code: 'mlm_W', symbol: 'mlm/W', factor: 0.001 }],
    });
    expect(grown.revision).toBe(2);
    const redefined = await rejectionOf(updateCatalogMeasurementFamily(ARIES, created.id, 2, {
      ...efficacy, units: [efficacy.units[0], { ...efficacy.units[1], factor: 999 }],
    }));
    expect(redefined.issues.map((issue) => issue.code)).toContain('unitLockedInUse');
    expect((await rejectionOf(deleteCatalogMeasurementFamily(ARIES, created.id, 2))).kind).toBe('inUse');
  });

  it('χωρίς χρήση: ελεύθερη αλλαγή και διαγραφή', async () => {
    const created = await createCatalogMeasurementFamily(ARIES, efficacy);
    const changed = await updateCatalogMeasurementFamily(ARIES, created.id, 1, { ...efficacy, standardUnitCode: 'lm_W' });
    expect((await deleteCatalogMeasurementFamily(ARIES, created.id, changed.revision)).isDeleted).toBe(true);
  });
});
