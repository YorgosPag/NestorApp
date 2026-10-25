/**
 * Οι γραφείς του σχήματος καταλόγου (ADR-923 §5.9) πάνω στο **επαληθευμένο** ψεύτικο Firestore
 * (`test-utils/fake-firestore` — ίδιο συμβόλαιο με τον emulator). Από άκρη σε άκρη: η οικογένεια MFP χτίζεται
 * μέσα από τους γραφείς, και κάθε αναλλοίωτη του σχήματος δοκιμάζεται στο «επιτρέπεται» ΚΑΙ στο «απαγορεύεται».
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { AuthContext } from '@/lib/auth';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { CatalogFamilyDefinition, FamilyTableRow } from '@/subapps/catalog/types/family';
import { MFP_ATTRIBUTES, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';

const fake = new FakeFirestore();
const recordTrackedEntityWrite = jest.fn(async () => undefined);

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({
  recordTrackedEntityWrite: (...args: unknown[]) => recordTrackedEntityWrite(...(args as [])),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createCatalogAttributeGroup, deleteCatalogAttributeGroup } from '../attribute-group-writer.server';
import { createCatalogAttribute, deleteCatalogAttribute, updateCatalogAttribute } from '../attribute-writer.server';
import { createCatalogFamily, updateCatalogFamily } from '../family-writer.server';
import { CatalogWriteError } from '../catalog-write-error';
/* eslint-enable import/first */

const ctxOf = (companyId: string): AuthContext => ({
  uid: `user-${companyId}`,
  email: `admin@${companyId}.gr`,
  companyId,
  globalRole: 'company_admin',
  mfaEnrolled: false,
  isAuthenticated: true,
});
const ARIES = ctxOf('comp-aries');
const RIVAL = ctxOf('comp-rival');

async function rejectionOf(promise: Promise<unknown>): Promise<CatalogWriteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CatalogWriteError) return error;
    throw error;
  }
  throw new Error('expected a CatalogWriteError');
}

/** Η βιβλιοθήκη του MFP μέσα από τους γραφείς — επιστρέφει κωδικός → id. */
async function seedMfpLibrary(): Promise<Map<string, string>> {
  const groups = new Map<string, string>();
  for (const code of new Set(MFP_ATTRIBUTES.map((attribute) => attribute.groupId))) {
    groups.set(code, (await createCatalogAttributeGroup(ARIES, { code, labels: { el: code }, orderKey: 'a0' })).id);
  }
  const ids = new Map<string, string>();
  for (const attribute of MFP_ATTRIBUTES) {
    const stored = await createCatalogAttribute(ARIES, { ...attribute, groupId: groups.get(attribute.groupId) ?? '' });
    ids.set(attribute.code, stored.id);
  }
  return ids;
}

/** Η οικογένεια MFP του fixture (id = κωδικός) με τα πραγματικά id των γραφέων. */
function mfpFamilyWith(ids: Map<string, string>): CatalogFamilyDefinition {
  const id = (code: string) => ids.get(code) ?? code;
  const row = (r: FamilyTableRow): FamilyTableRow => {
    if (r.kind === 'axis') return { ...r, axisAttributeId: id(r.axisAttributeId) };
    if (r.kind === 'attribute') {
      return { ...r, attributeId: id(r.attributeId), axisFilter: r.axisFilter && { ...r.axisFilter, axisAttributeId: id(r.axisFilter.axisAttributeId) } };
    }
    return r;
  };
  return JSON.parse(JSON.stringify({
    ...MFP_FAMILY,
    attributes: MFP_FAMILY.attributes.map((binding) => ({ ...binding, attributeId: id(binding.attributeId) })),
    labelAttributeId: id('model_code'),
    imageAttributeId: id('photo'),
    variantSchemes: MFP_FAMILY.variantSchemes.map((scheme) => ({
      ...scheme,
      levels: scheme.levels.map((level) => ({ axisAttributeIds: level.axisAttributeIds.map(id), attributeIds: level.attributeIds.map(id) })),
    })),
    tableSpec: MFP_FAMILY.tableSpec && { ...MFP_FAMILY.tableSpec, rows: MFP_FAMILY.tableSpec.rows.map(row) },
    consistencyRules: [{ id: 'rule_unique_code', kind: 'unique', attributeId: id('model_code'), severity: 'error' }],
  })) as CatalogFamilyDefinition;
}

beforeEach(() => {
  fake.reset();
  recordTrackedEntityWrite.mockClear();
});

describe('το κριτήριο εξόδου — η οικογένεια «Fan coil» χτίζεται μέσα από τους γραφείς', () => {
  it('ομάδες + ιδιότητες + οικογένεια, με παράγωγα, αναθεώρηση και ίχνος σε κάθε εγγραφή', async () => {
    const ids = await seedMfpLibrary();
    const family = await createCatalogFamily(ARIES, mfpFamilyWith(ids));

    expect(family.revision).toBe(1);
    expect(family.attributeIds).toEqual(MFP_ATTRIBUTES.map((attribute) => ids.get(attribute.code)));
    const cooling = fake.getData('catalog_attributes', ids.get('cooling_h') ?? '');
    expect(cooling).toEqual(expect.objectContaining({ measurementFamilyCodes: ['power'], companyId: 'comp-aries' }));
    // 4 ομάδες + 11 ιδιότητες + 1 οικογένεια = 16 ίχνη, όλα στο βιβλίο του χώρου.
    expect(recordTrackedEntityWrite).toHaveBeenCalledTimes(16);
  });
});

describe('ταυτότητα και ταυτοχρονισμός', () => {
  it('δεύτερος ίδιος κωδικός ⇒ duplicateCode (το id είναι ντετερμινιστικό)', async () => {
    await createCatalogAttributeGroup(ARIES, { code: 'cooling', labels: { el: 'Ψύξη' }, orderKey: 'a0' });
    const error = await rejectionOf(createCatalogAttributeGroup(ARIES, { code: 'cooling', labels: { el: 'Ψ' }, orderKey: 'a1' }));
    expect(error.kind).toBe('duplicateCode');
  });

  it('ο ΙΔΙΟΣ κωδικός σε ΑΛΛΟ χώρο είναι άλλη οντότητα', async () => {
    const mine = await createCatalogAttributeGroup(ARIES, { code: 'cooling', labels: { el: 'Ψύξη' }, orderKey: 'a0' });
    const theirs = await createCatalogAttributeGroup(RIVAL, { code: 'cooling', labels: { el: 'Ψύξη' }, orderKey: 'a0' });
    expect(theirs.id).not.toBe(mine.id);
  });

  it('μπαγιάτικη αναθεώρηση ⇒ revisionMismatch με την τρέχουσα — ποτέ σιωπηλή αντικατάσταση', async () => {
    const ids = await seedMfpLibrary();
    const id = ids.get('weight') ?? '';
    const weight = MFP_ATTRIBUTES.find((attribute) => attribute.code === 'weight') as CatalogAttributeDefinition;
    const current = fake.getData('catalog_attributes', id) as CatalogAttributeDefinition;
    await updateCatalogAttribute(ARIES, id, 1, { ...current, labels: { el: 'Καθαρό βάρος' } });
    const error = await rejectionOf(updateCatalogAttribute(ARIES, id, 1, { ...weight, groupId: current.groupId }));
    expect(error.kind).toBe('revisionMismatch');
    expect(error.details).toEqual({ currentRevision: 2 });
  });

  it('ο συνάδελφος πρόλαβε ΑΝΑΜΕΣΑ στην ανάγνωση και στο commit ⇒ η συναλλαγή ξαναδιαβάζει και το CAS αρνείται', async () => {
    const ids = await seedMfpLibrary();
    const id = ids.get('weight') ?? '';
    const current = fake.getData('catalog_attributes', id) as CatalogAttributeDefinition & { revision: number };
    fake.interfere = () => fake.write('catalog_attributes', id, { ...current, revision: 2, labels: { el: 'Του συναδέλφου' } });
    const error = await rejectionOf(updateCatalogAttribute(ARIES, id, 1, { ...current, labels: { el: 'Δική μου' } }));
    expect(error.kind).toBe('revisionMismatch');
    expect(fake.getData('catalog_attributes', id)).toEqual(expect.objectContaining({ labels: { el: 'Του συναδέλφου' } }));
  });

  it('ξένος χώρος ≡ ανύπαρκτο (notFound, όχι 403 που θα πρόδιδε την ύπαρξη)', async () => {
    const ids = await seedMfpLibrary();
    const error = await rejectionOf(deleteCatalogAttribute(RIVAL, ids.get('weight') ?? '', 1));
    expect(error.kind).toBe('notFound');
  });

  it('ο κωδικός είναι αμετάβλητος', async () => {
    const ids = await seedMfpLibrary();
    const current = fake.getData('catalog_attributes', ids.get('weight') ?? '') as CatalogAttributeDefinition;
    const error = await rejectionOf(updateCatalogAttribute(ARIES, ids.get('weight') ?? '', 1, { ...current, code: 'mass_kg' }));
    expect(error.kind).toBe('immutable');
  });
});

describe('καμία αλλαγή της βιβλιοθήκης δεν σπάει σιωπηλά οικογένεια', () => {
  it('αλλαγή τύπου σε ιδιότητα που χρησιμοποιεί οικογένεια ⇒ immutable', async () => {
    const ids = await seedMfpLibrary();
    await createCatalogFamily(ARIES, mfpFamilyWith(ids));
    const current = fake.getData('catalog_attributes', ids.get('dimensions') ?? '') as CatalogAttributeDefinition;
    const asNumber: CatalogAttributeDefinition = {
      ...current, type: 'number', config: { min: null, max: null, decimals: 0, negativeAllowed: false },
    };
    const error = await rejectionOf(updateCatalogAttribute(ARIES, ids.get('dimensions') ?? '', 1, asNumber));
    expect(error.kind).toBe('immutable');
    expect(error.issues.map((issue) => issue.code)).toEqual(['typeLockedInUse']);
  });

  it('η ιδιότητα-άξονας δεν μπορεί να γίνει ανά γλώσσα όσο είναι άξονας ⇒ inUse με τα ευρήματα της οικογένειας', async () => {
    const ids = await seedMfpLibrary();
    await createCatalogFamily(ARIES, mfpFamilyWith(ids));
    const size = fake.getData('catalog_attributes', ids.get('size') ?? '') as CatalogAttributeDefinition;
    const error = await rejectionOf(updateCatalogAttribute(ARIES, ids.get('size') ?? '', 1, { ...size, scopable: true }));
    expect(error.kind).toBe('inUse');
    expect(error.issues.map((issue) => issue.code)).toContain('axisLocalizedOrScoped');
  });

  it('διαγραφή ιδιότητας σε χρήση ⇒ inUse· διαγραφή ομάδας με ιδιότητες ⇒ inUse', async () => {
    const ids = await seedMfpLibrary();
    await createCatalogFamily(ARIES, mfpFamilyWith(ids));
    expect((await rejectionOf(deleteCatalogAttribute(ARIES, ids.get('weight') ?? '', 1))).kind).toBe('inUse');
    const weight = fake.getData('catalog_attributes', ids.get('weight') ?? '') as CatalogAttributeDefinition;
    expect((await rejectionOf(deleteCatalogAttributeGroup(ARIES, weight.groupId, 1))).kind).toBe('inUse');
  });

  it('οικογένεια που δείχνει σε διαγραμμένη/ανύπαρκτη ιδιότητα απορρίπτεται στην αποθήκευση', async () => {
    const ids = await seedMfpLibrary();
    const family = mfpFamilyWith(ids);
    const error = await rejectionOf(createCatalogFamily(ARIES, {
      ...family,
      attributes: [...family.attributes, { attributeId: 'cattr_ghost', requiredChannels: [] }],
    }));
    expect(error.kind).toBe('invalid');
    expect(error.issues.map((issue) => issue.code)).toContain('attributeUnknown');
  });

  it('ενημέρωση οικογένειας ξαναγράφει το παράγωγο attributeIds', async () => {
    const ids = await seedMfpLibrary();
    const created = await createCatalogFamily(ARIES, mfpFamilyWith(ids));
    const lean: CatalogFamilyDefinition = {
      ...mfpFamilyWith(ids),
      attributes: mfpFamilyWith(ids).attributes.filter((binding) => binding.attributeId !== ids.get('weight')),
      variantSchemes: [], tableSpec: null,
    };
    const updated = await updateCatalogFamily(ARIES, created.id, created.revision, lean);
    expect(updated.attributeIds).not.toContain(ids.get('weight'));
    expect((await deleteCatalogAttribute(ARIES, ids.get('weight') ?? '', 1)).isDeleted).toBe(true);
  });
});
