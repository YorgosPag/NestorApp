/**
 * Τα επτά εργαλεία BOQ (ADR-734 §7) — συμπεριφορά, όχι μόνο σχήμα.
 *
 * Το βάρος πέφτει στο **tenant isolation** του `getById` (§7): ελέγχεται ότι και
 * οι τρεις διαδρομές που περνούν από εκεί μπλοκάρουν, και ότι μπλοκάρουν με
 * μήνυμα **ταυτόσημο** με του ανύπαρκτου id — αλλιώς το σφάλμα γίνεται μαντείο
 * ύπαρξης.
 *
 * ⚠️ Από 2026-07-31 ο tenant είναι μέρος της **υπογραφής** (`getById(companyId,
 * id)`) και η άμυνα ζει στο service. Τα tests εδώ ελέγχουν πλέον **δύο** πράγματα
 * που πριν ήταν ένα: ότι ο tenant του context ταξιδεύει ως όρισμα, και ότι η
 * δεύτερη ζώνη του `fetchOwnedBoqItem` κρατά όταν μια υλοποίηση τον αγνοήσει.
 *
 * @module services/agent-capability/capabilities/boq/__tests__/boq-capabilities
 * @see ADR-734 §7
 */

import type { BOQCategory, BOQItem } from '@/types/boq';
import type { CapabilityContext, CapabilityOutcome } from '../../../registry';
import { createBoqCapabilityRegistry } from '../index';
import { makeItem } from '../../../vqe/__tests__/vqe-test-fixtures';
import { createFakeBoqService } from './fake-boq-service';

const OWNER = 'co-1';
const INTRUDER = 'co-2';
const BUILDING = 'bld-1';

const ADMIN_CTX: CapabilityContext = { companyId: OWNER, isAdmin: true, requestId: 'req-1' };
const INTRUDER_CTX: CapabilityContext = { companyId: INTRUDER, isAdmin: true, requestId: 'req-2' };

const EXPECTED_NAMES = [
  'boq_get_baseline_drift',
  'boq_get_item',
  'boq_get_statistics',
  'boq_get_summary',
  'boq_get_variance',
  'boq_list_categories',
  'boq_search_items',
];

const ownerItem = makeItem({
  id: 'boq-owner',
  companyId: OWNER,
  buildingId: BUILDING,
  status: 'certified',
  actualQuantity: 120,
  liveQuantity: 110,
  liveQuantitySyncedAt: '2026-07-01T00:00:00.000Z',
});

const foreignItem = makeItem({ id: 'boq-foreign', companyId: INTRUDER, buildingId: 'bld-9' });

const ownerCategory: BOQCategory = {
  id: 'cat-1',
  companyId: OWNER,
  code: 'OIK-2',
  nameEL: 'Σκυροδέματα',
  nameEN: 'Concrete',
  description: null,
  level: 'group',
  parentId: null,
  sortOrder: 1,
  defaultWasteFactor: 0.05,
  allowedUnits: ['m3'],
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function buildRegistry(items: readonly BOQItem[], extras: { categories?: readonly BOQCategory[]; summaryFails?: boolean } = {}) {
  const fake = createFakeBoqService({ items, ...extras });
  return { registry: createBoqCapabilityRegistry({ boq: fake.service }), fake };
}

function expectOk<V>(outcome: CapabilityOutcome<V>): V {
  if (!outcome.ok) throw new Error(`expected success, got ${outcome.error.code}: ${outcome.error.message}`);
  return outcome.envelope.value;
}

// ============================================================================

describe('BOQ capability catalogue (ADR-734 §7)', () => {
  it('εκθέτει ακριβώς τα επτά εργαλεία του §7', () => {
    const { registry } = buildRegistry([ownerItem]);
    expect(registry.list().map((c) => c.name)).toEqual(EXPECTED_NAMES);
  });

  it('όλα δηλώνονται read-only και admin-only', () => {
    const { registry } = buildRegistry([ownerItem]);
    for (const capability of registry.list()) {
      expect(capability.policy).toEqual({ access: 'read', requiresAdmin: true });
      expect(capability.annotations.readOnlyHint).toBe(true);
    }
  });

  it('καμία δυνατότητα δεν δέχεται companyId ως παράμετρο', () => {
    const { registry } = buildRegistry([ownerItem]);
    for (const capability of registry.list()) {
      expect(Object.keys(capability.params)).not.toContain('companyId');
    }
  });
});

describe('tenant isolation — ο tenant είναι πια μέρος της υπογραφής (ADR-734 §7)', () => {
  const itemTools = ['boq_get_item', 'boq_get_variance', 'boq_get_baseline_drift'];

  it('το companyId που φτάνει στο getById είναι του context, όχι των ορισμάτων', async () => {
    const { registry, fake } = buildRegistry([ownerItem]);
    await registry.invoke('boq_get_item', { itemId: ownerItem.id }, ADMIN_CTX);

    // Η απόδειξη ότι ο tenant ταξιδεύει: αν το service αγνοούσε τη νέα παράμετρο,
    // ο έλεγχος θα ξαναγύριζε σιωπηλά στον guard.
    expect(fake.calls.getById).toEqual([{ companyId: OWNER, itemId: ownerItem.id }]);
  });

  it('υλοποίηση που ΑΓΝΟΕΙ τον tenant δεν διαρρέει — η δεύτερη ζώνη κρατά', async () => {
    // Το σύστημα τύπων εγγυάται ότι το companyId **περνιέται**· δεν μπορεί να
    // εγγυηθεί ότι κάθε υλοποίηση το **τιμά**. Αυτός ο απείθαρχος ψεύτης είναι ο
    // μόνος τρόπος να αποδειχθεί ότι ο έλεγχος του `fetchOwnedBoqItem` δουλεύει.
    const { fake } = buildRegistry([ownerItem, foreignItem]);
    const rogue = { ...fake.service, getById: () => Promise.resolve(foreignItem) };
    const registry = createBoqCapabilityRegistry({ boq: rogue });

    const outcome = await registry.invoke('boq_get_item', { itemId: foreignItem.id }, ADMIN_CTX);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('NOT_FOUND');
  });

  it.each(itemTools)('%s: item άλλου πελάτη ⇒ NOT_FOUND', async (tool) => {
    const { registry } = buildRegistry([ownerItem, foreignItem]);
    const outcome = await registry.invoke(tool, { itemId: ownerItem.id }, INTRUDER_CTX);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('NOT_FOUND');
  });

  it.each(itemTools)('%s: το μήνυμα είναι ταυτόσημο με ανύπαρκτο id (κανένα μαντείο ύπαρξης)', async (tool) => {
    const { registry } = buildRegistry([ownerItem]);

    const foreign = await registry.invoke(tool, { itemId: ownerItem.id }, INTRUDER_CTX);
    const missing = await registry.invoke(tool, { itemId: 'boq-does-not-exist' }, INTRUDER_CTX);

    expect(foreign.ok).toBe(false);
    expect(missing.ok).toBe(false);
    if (foreign.ok || missing.ok) return;

    // Ίδιος κωδικός, ίδιο σχήμα μηνύματος: η μόνη διαφορά είναι το id που
    // έστειλε ο ίδιος ο καλών — καμία πληροφορία για το τι υπάρχει.
    expect(foreign.error.code).toBe(missing.error.code);
    expect(foreign.error.message.replace(ownerItem.id, 'X')).toBe(
      missing.error.message.replace('boq-does-not-exist', 'X'),
    );
  });

  it('αναζήτηση δεν επιστρέφει ποτέ γραμμές άλλου πελάτη', async () => {
    const { registry } = buildRegistry([ownerItem, foreignItem]);
    const items = expectOk(await registry.invoke('boq_search_items', { buildingId: BUILDING }, INTRUDER_CTX));
    expect(items).toEqual([]);
  });

  it('το companyId που φτάνει στο service είναι του context, όχι των ορισμάτων', async () => {
    const { registry, fake } = buildRegistry([ownerItem]);
    await registry.invoke('boq_search_items', { buildingId: BUILDING }, ADMIN_CTX);
    expect(fake.calls.search).toEqual([{ companyId: OWNER, buildingId: BUILDING, filters: {} }]);
  });
});

describe('boq_get_item', () => {
  it('επιστρέφει τη γραμμή μαζί με υπολογισμένο κόστος, τυλιγμένα σε φάκελο', async () => {
    const { registry } = buildRegistry([ownerItem]);
    const outcome = await registry.invoke('boq_get_item', { itemId: ownerItem.id }, ADMIN_CTX);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const value = outcome.envelope.value as { item: BOQItem; cost: { grossQuantity: number } };
    expect(value.item.id).toBe(ownerItem.id);
    // 100 × (1 + 0.05) — η μηχανή κόστους, όχι ο πράκτορας, κάνει τον υπολογισμό.
    expect(value.cost.grossQuantity).toBeCloseTo(105, 10);

    expect(outcome.envelope.provenance.computedBy).toBe('cost-engine.computeItemCost');
    expect(outcome.envelope.provenance.sourceItemIds).toEqual([ownerItem.id]);
    expect(outcome.envelope.governance.effectiveStatus).toBe('certified');
    expect(outcome.envelope.integrity.inputsHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('boq_get_variance / boq_get_baseline_drift', () => {
  it('variance: null όταν λείπει η πραγματική ποσότητα — και είναι επιτυχία, όχι σφάλμα', async () => {
    const noActual = makeItem({ id: 'boq-na', companyId: OWNER, buildingId: BUILDING, actualQuantity: null });
    const { registry } = buildRegistry([noActual]);

    const outcome = await registry.invoke('boq_get_variance', { itemId: noActual.id }, ADMIN_CTX);
    expect(outcome.ok).toBe(true);
    expect(expectOk(outcome)).toBeNull();
  });

  it('baseline drift: εκθέτει την απόκλιση ζωντανού μοντέλου (ADR-674)', async () => {
    const { registry } = buildRegistry([ownerItem]);
    const drift = expectOk(await registry.invoke('boq_get_baseline_drift', { itemId: ownerItem.id }, ADMIN_CTX));
    expect(drift).toMatchObject({ baseline: 100, live: 110, delta: 10 });
  });
});

describe('boq_get_summary', () => {
  it('κτίριο χωρίς γραμμές ⇒ value null και προειδοποίηση, ΟΧΙ ψεύτικο μηδέν', async () => {
    const { registry, fake } = buildRegistry([]);
    const outcome = await registry.invoke('boq_get_summary', { buildingId: BUILDING }, ADMIN_CTX);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.envelope.value).toBeNull();
    expect(outcome.envelope.provenance.warnings.some((w) => w.source === 'envelope' && w.code === 'no_source_items')).toBe(true);
    // Δεν ζητήθηκε καν σύνοψη: το κενό διαγνώστηκε από τις γραμμές.
    expect(fake.calls.getByBuilding).toHaveLength(1);
  });

  it('γραμμές υπάρχουν αλλά η σύνοψη αποτυγχάνει ⇒ INTERNAL, όχι φάκελος με null', async () => {
    const { registry } = buildRegistry([ownerItem], { summaryFails: true });
    const outcome = await registry.invoke('boq_get_summary', { buildingId: BUILDING }, ADMIN_CTX);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('INTERNAL');
  });

  it('η χαμηλότερη κατάσταση του συνόλου κυβερνά τον φάκελο', async () => {
    const draftItem = makeItem({ id: 'boq-draft', companyId: OWNER, buildingId: BUILDING, status: 'draft' });
    const { registry } = buildRegistry([ownerItem, draftItem]);

    const outcome = await registry.invoke('boq_get_summary', { buildingId: BUILDING }, ADMIN_CTX);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.envelope.governance.effectiveStatus).toBe('draft');
    expect(outcome.envelope.governance.isSignable).toBe(false);
  });

  it('ΤΟ ΡΟΛΟΪ ΤΗΣ ΣΥΝΟΨΗΣ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟ inputsHash (ADR-734 §6.6)', async () => {
    const { registry } = buildRegistry([ownerItem]);

    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-07-30T10:00:00.000Z'));
      const first = await registry.invoke('boq_get_summary', { buildingId: BUILDING }, ADMIN_CTX);

      jest.setSystemTime(new Date('2027-01-01T00:00:00.000Z'));
      const second = await registry.invoke('boq_get_summary', { buildingId: BUILDING }, ADMIN_CTX);

      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;

      const firstValue = first.envelope.value as { lastUpdated: string };
      const secondValue = second.envelope.value as { lastUpdated: string };

      // Το ρολόι ΟΝΤΩΣ κύλησε μέσα στην έξοδο…
      expect(firstValue.lastUpdated).not.toBe(secondValue.lastUpdated);
      // …και παρ' όλα αυτά το αποτύπωμα εισόδων έμεινε ίδιο.
      expect(first.envelope.integrity.inputsHash).toBe(second.envelope.integrity.inputsHash);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('boq_search_items', () => {
  it('προωθεί τα φίλτρα αυτούσια στο service', async () => {
    const { registry, fake } = buildRegistry([ownerItem]);
    await registry.invoke(
      'boq_search_items',
      { buildingId: BUILDING, categoryCode: 'OIK-2', status: 'certified', scope: 'building', searchText: 'fixture' },
      ADMIN_CTX,
    );

    expect(fake.calls.search[0].filters).toEqual({
      categoryCode: 'OIK-2',
      status: 'certified',
      scope: 'building',
      searchText: 'fixture',
    });
  });

  it('πολύ μεγάλο αποτέλεσμα ⇒ σφάλμα με οδηγία, ΠΟΤΕ σιωπηλή περικοπή', async () => {
    const many = Array.from({ length: 201 }, (_unused, index) =>
      makeItem({ id: `boq-${index}`, companyId: OWNER, buildingId: BUILDING }));
    const { registry } = buildRegistry(many);

    const outcome = await registry.invoke('boq_search_items', { buildingId: BUILDING }, ADMIN_CTX);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('INVALID_ARGUMENT');
    expect(outcome.error.details?.matched).toBe('201');
  });

  it('ακριβώς στο όριο επιστρέφει κανονικά', async () => {
    const many = Array.from({ length: 200 }, (_unused, index) =>
      makeItem({ id: `boq-${index}`, companyId: OWNER, buildingId: BUILDING }));
    const { registry } = buildRegistry(many);

    const items = expectOk(await registry.invoke('boq_search_items', { buildingId: BUILDING }, ADMIN_CTX));
    expect(items).toHaveLength(200);
  });
});

describe('boq_get_statistics / boq_list_categories', () => {
  it('τα στατιστικά φέρουν προέλευση από τις πραγματικές γραμμές', async () => {
    const { registry } = buildRegistry([ownerItem]);
    const outcome = await registry.invoke('boq_get_statistics', { buildingId: BUILDING }, ADMIN_CTX);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.envelope.value).toMatchObject({ total: 1, certified: 1 });
    expect(outcome.envelope.provenance.sourceItemIds).toEqual([ownerItem.id]);
    expect(outcome.envelope.provenance.computedBy).toBe('boq-service.getStatistics');
  });

  it('οι κατηγορίες είναι αναφορικά δεδομένα — κενή προέλευση, μη υπογράψιμες', async () => {
    const { registry } = buildRegistry([], { categories: [ownerCategory] });
    const outcome = await registry.invoke('boq_list_categories', {}, ADMIN_CTX);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.envelope.value).toEqual([ownerCategory]);
    expect(outcome.envelope.provenance.sourceItemIds).toEqual([]);
    expect(outcome.envelope.governance.isSignable).toBe(false);
  });
});

describe('πολιτική — επιβάλλεται πριν τον handler (ADR-734 §5.4)', () => {
  it.each(EXPECTED_NAMES)('%s: μη διαχειριστής ⇒ PERMISSION_DENIED', async (tool) => {
    const { registry, fake } = buildRegistry([ownerItem]);
    const outcome = await registry.invoke(tool, { itemId: ownerItem.id, buildingId: BUILDING }, {
      ...ADMIN_CTX,
      isAdmin: false,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('PERMISSION_DENIED');
    // Ούτε ένα ερώτημα δεν έφυγε προς τα δεδομένα.
    expect(fake.calls.getById).toEqual([]);
    expect(fake.calls.getByBuilding).toEqual([]);
    expect(fake.calls.search).toEqual([]);
  });

  it('χωρίς tenant ⇒ UNAUTHENTICATED πριν από κάθε άλλο έλεγχο', async () => {
    const { registry } = buildRegistry([ownerItem]);
    const outcome = await registry.invoke('boq_get_item', { itemId: 'anything' }, {
      companyId: '   ',
      isAdmin: false,
      requestId: 'req-3',
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('UNAUTHENTICATED');
  });
});
