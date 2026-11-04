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
let mockPricingAllowed = true;
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), hasPermission: async () => mockPricingAllowed }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createCatalogAttributeGroup } from '../attribute-group-writer.server';
import { createCatalogAttribute } from '../attribute-writer.server';
import { createCatalogCategory, deleteCatalogCategory, moveCatalogCategory, updateCatalogCategory } from '../category-writer.server';
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
  it('Σ6 ΦΠΑ: η οθόνη γράφει συντελεστή ή «κληρονομείται» (null) · αλλαγή χωρίς το πεδίο τον κρατά', async () => {
    const hvac = await category('hvac', null);
    const declared = await updateCatalogCategory(ARIES, hvac.id, hvac.revision, { labels: { el: 'hvac' }, mappings: { atoeCode: null }, vatRate: 13 });
    expect(read(hvac.id).vatRate).toBe(13);
    const kept = await updateCatalogCategory(ARIES, hvac.id, declared.revision, { labels: { el: 'Κλιματισμός' }, mappings: { atoeCode: null } });
    expect(read(hvac.id)).toEqual(expect.objectContaining({ vatRate: 13, labels: { el: 'Κλιματισμός' } }));
    await updateCatalogCategory(ARIES, hvac.id, kept.revision, { labels: { el: 'Κλιματισμός' }, mappings: { atoeCode: null }, vatRate: null });
    expect(read(hvac.id).vatRate).toBeNull();
  });

  it('Χ4: αλλαγή συντελεστή χωρίς δικαίωμα τιμολόγησης ⇒ άρνηση · ίδιος συντελεστής ⇒ η ετικέτα αποθηκεύεται', async () => {
    const hvac = await category('hvac', null);
    const declared = await updateCatalogCategory(ARIES, hvac.id, hvac.revision, { labels: { el: 'hvac' }, mappings: { atoeCode: null }, vatRate: 24 });
    mockPricingAllowed = false;
    try {
      const refused = await rejectionOf(updateCatalogCategory(ARIES, hvac.id, declared.revision, { labels: { el: 'hvac' }, mappings: { atoeCode: null }, vatRate: 13 }));
      expect(refused.issues).toEqual([{ code: 'vatRatePricingAuthority', path: 'vatRate' }]);
      await updateCatalogCategory(ARIES, hvac.id, declared.revision, { labels: { el: 'Κλιματισμός' }, mappings: { atoeCode: null }, vatRate: 24 });
      expect(read(hvac.id)).toEqual(expect.objectContaining({ vatRate: 24, labels: { el: 'Κλιματισμός' } }));
      const create = await rejectionOf(createCatalogCategory(ARIES, { code: 'food', labels: { el: 'food' }, parentId: null, orderKey: 'a1', mappings: { atoeCode: null }, vatRate: 13 }));
      expect(create.issues).toEqual([{ code: 'vatRatePricingAuthority', path: 'vatRate' }]);
    } finally {
      mockPricingAllowed = true;
    }
  });

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

  it('Μ-1 (Χ4): μετακίνηση που αλλάζει τον ΕΝΕΡΓΟ συντελεστή κόμβου ή απογόνου θέλει τιμολόγηση · ίδιος ενεργός ⇒ περνά', async () => {
    const vat = (code: string, vatRate: 13 | 24, orderKey: string) =>
      createCatalogCategory(ARIES, { code, labels: { el: code }, parentId: null, orderKey, mappings: { atoeCode: null }, vatRate });
    const food = await vat('food', 13, 'a0');
    const tools = await vat('tools', 24, 'a1');
    const alsoFood = await vat('food2', 13, 'a2');
    const snacks = await category('snacks', food.id);
    const chips = await category('chips', snacks.id);
    mockPricingAllowed = false;
    try {
      const refused = await rejectionOf(moveCatalogCategory(ARIES, snacks.id, snacks.revision, { parentId: tools.id, orderKey: 'a0' }));
      expect(refused.issues).toEqual([{ code: 'vatRatePricingAuthority', path: 'parentId' }]);
      expect(read(snacks.id).parentId).toBe(food.id);
      expect(read(chips.id).ancestorIds).toEqual([food.id, snacks.id]);
      // Ίδιος ενεργός (13 → 13): η αναδιάταξη του δέντρου δεν θέλει τιμολόγηση.
      await moveCatalogCategory(ARIES, snacks.id, snacks.revision, { parentId: alsoFood.id, orderKey: 'a0' });
      expect(read(chips.id).ancestorIds).toEqual([alsoFood.id, snacks.id]);
    } finally {
      mockPricingAllowed = true;
    }
  });

  it('Μ-1: δικός συντελεστής κόμβου προστατεύει το υποδέντρο · απόγονος που φεύγει μόνος χάνει την κληρονομιά ⇒ άρνηση', async () => {
    const food = await createCatalogCategory(ARIES, { code: 'food', labels: { el: 'food' }, parentId: null, orderKey: 'a0', mappings: { atoeCode: null }, vatRate: 13 });
    const bare = await category('bare', null, 'a1');
    const mid = await category('mid', food.id);
    const leaf = await category('leaf', mid.id);
    const declared = await updateCatalogCategory(ARIES, mid.id, mid.revision, { labels: { el: 'mid' }, mappings: { atoeCode: null }, vatRate: 13 });
    // Ο mid δηλώνει 13 ⇒ ο ίδιος και ο leaf μένουν 13 κάτω από τον bare: περνά χωρίς τιμολόγηση.
    mockPricingAllowed = false;
    try {
      await moveCatalogCategory(ARIES, mid.id, declared.revision, { parentId: bare.id, orderKey: 'a0' });
      expect(read(leaf.id).ancestorIds).toEqual([bare.id, mid.id]);
      // Ο leaf ξαναμπαίνει απευθείας κάτω από τον bare: από 13 (κληρονομιά) σε κανέναν ⇒ άρνηση.
      const refused = await rejectionOf(moveCatalogCategory(ARIES, leaf.id, read(leaf.id).revision, { parentId: bare.id, orderKey: 'a1' }));
      expect(refused.issues.map((issue) => issue.code)).toEqual(['vatRatePricingAuthority']);
    } finally {
      mockPricingAllowed = true;
    }
    await moveCatalogCategory(ARIES, leaf.id, read(leaf.id).revision, { parentId: bare.id, orderKey: 'a1' });
    expect(read(leaf.id).ancestorIds).toEqual([bare.id]);
  });

  it('Δ-1 (Χ4): διαγραφή κατηγορίας που φέρει ενεργό ΦΠΑ θέλει τιμολόγηση · χωρίς ενεργό ΦΠΑ σβήνεται ελεύθερα', async () => {
    const declared = (code: string, vatRate: 13 | 24, orderKey: string) =>
      createCatalogCategory(ARIES, { code, labels: { el: code }, parentId: null, orderKey, mappings: { atoeCode: null }, vatRate });
    // Σενάριο 1: SKU σε A(13%) + B(24%) = αντίφαση ⇒ «Κατόπιν προσφοράς»· η διαγραφή του B θα έδινε σιωπηλά 13%.
    await declared('a', 13, 'a0');
    const b = await declared('b', 24, 'a1');
    // Σενάριο 2: φύλλο που κληρονομεί 13% ως μόνη κατηγορία SKU· η διαγραφή του θα έδινε «Κατόπιν προσφοράς».
    const food = await declared('food', 13, 'a2');
    const leaf = await category('leaf', food.id);
    const bare = await category('bare', null, 'a3');
    mockPricingAllowed = false;
    try {
      for (const target of [b, leaf]) {
        const refused = await rejectionOf(deleteCatalogCategory(ARIES, target.id, target.revision));
        expect(refused.issues).toEqual([{ code: 'vatRatePricingAuthority', path: 'vatRate' }]);
        expect(read(target.id)).toEqual(expect.objectContaining({ isDeleted: false }));
      }
      expect((await deleteCatalogCategory(ARIES, bare.id, bare.revision)).isDeleted).toBe(true);
    } finally {
      mockPricingAllowed = true;
    }
    expect((await deleteCatalogCategory(ARIES, b.id, b.revision)).isDeleted).toBe(true);
    expect((await deleteCatalogCategory(ARIES, leaf.id, leaf.revision)).isDeleted).toBe(true);
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
