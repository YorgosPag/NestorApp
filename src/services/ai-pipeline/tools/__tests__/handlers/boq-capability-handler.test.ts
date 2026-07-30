/**
 * `BoqCapabilityHandler` — η γέφυρα πράκτορα → Capability Registry (ADR-734 Φ3)
 *
 * Τρεις ισχυρισμοί που, αν σπάσουν, δεν φαίνονται πουθενά αλλού:
 *   1. τα ονόματα εργαλείων **παράγονται** από το registry (καμία χειρόγραφη λίστα
 *      που θα αποκλίνει),
 *   2. ο tenant έρχεται **αποκλειστικά** από το `AgenticContext` — ο πράκτορας δεν
 *      έχει κανάλι να προτείνει πελάτη,
 *   3. το αποτέλεσμα **δεν περικόπτεται** — περικομμένη λίστα που αθροίζεται είναι
 *      σφάλμα τιμής.
 *
 * @module services/ai-pipeline/tools/__tests__/handlers/boq-capability-handler
 * @see ADR-734 §7, §8.3
 */

import type { BOQItem } from '@/types/boq';
import type { IBOQReadService } from '@/services/measurements/boq-read-contract';
import { makeItem } from '@/services/agent-capability/vqe/__tests__/vqe-test-fixtures';
import { createFakeBoqService } from '@/services/agent-capability/capabilities/boq/__tests__/fake-boq-service';
import type { AgenticContext } from '../../executor-shared';

const OWNER = 'co-1';
const INTRUDER = 'co-2';
const BUILDING = 'bld-1';

const ownerItems: readonly BOQItem[] = [
  makeItem({ id: 'boq-1', companyId: OWNER, buildingId: BUILDING, categoryCode: 'OIK-2' }),
  makeItem({ id: 'boq-2', companyId: OWNER, buildingId: BUILDING, categoryCode: 'OIK-3' }),
];

const backing: IBOQReadService = createFakeBoqService({ items: ownerItems }).service;

jest.mock('@/services/measurements/admin/boq-admin-read-service', () => ({
  getBoqAdminReadService: () => backing,
}));

// Η εισαγωγή γίνεται ΜΕΤΑ το mock: το module χτίζει το registry κατά τη φόρτωση.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { BOQ_CAPABILITY_TOOL_DEFINITIONS, BoqCapabilityHandler } from '../../handlers/boq-capability-handler';

const agenticContext = (companyId: string, isAdmin = true): AgenticContext => ({
  companyId,
  isAdmin,
  channel: 'telegram',
  channelSenderId: 'sender-1',
  requestId: 'req-1',
});

const handler = new BoqCapabilityHandler();

// ============================================================================
// ΚΑΤΑΛΟΓΟΣ
// ============================================================================

describe('toolNames — παράγονται, δεν γράφονται', () => {
  it('εκθέτει ακριβώς τα επτά εργαλεία του ADR-734 §7', () => {
    expect([...handler.toolNames].sort()).toEqual([
      'boq_get_baseline_drift',
      'boq_get_item',
      'boq_get_statistics',
      'boq_get_summary',
      'boq_get_variance',
      'boq_list_categories',
      'boq_search_items',
    ]);
  });

  it('οι ορισμοί που βλέπει το μοντέλο αντιστοιχούν 1:1 στα ονόματα', () => {
    expect(BOQ_CAPABILITY_TOOL_DEFINITIONS.map((d) => d.function.name).sort()).toEqual(
      [...handler.toolNames].sort(),
    );
  });

  it('κάθε ορισμός είναι strict — το μοντέλο δεν μπορεί να στείλει άγνωστο κλειδί', () => {
    for (const definition of BOQ_CAPABILITY_TOOL_DEFINITIONS) {
      expect(definition.function.strict).toBe(true);
    }
  });
});

// ============================================================================
// TENANT
// ============================================================================

describe('ο tenant έρχεται ΜΟΝΟ από το context', () => {
  it('κανένας ορισμός δεν δηλώνει παράμετρο companyId', () => {
    for (const definition of BOQ_CAPABILITY_TOOL_DEFINITIONS) {
      const properties = (definition.function.parameters as { properties?: Record<string, unknown> })
        .properties ?? {};

      expect(Object.keys(properties)).not.toContain('companyId');
    }
  });

  it('companyId στα ορίσματα απορρίπτεται — δεν αγνοείται σιωπηλά', async () => {
    const result = await handler.execute(
      'boq_get_statistics',
      { buildingId: BUILDING, companyId: OWNER },
      agenticContext(INTRUDER),
    );

    // Σιωπηλή αγνόηση θα ήταν επίσης ασφαλής, αλλά θα έκρυβε από το μοντέλο ότι
    // η κλήση του ήταν λάθος — και θα το άφηνε να πιστεύει ότι διάλεξε πελάτη.
    expect(result.success).toBe(false);
    expect(result.error).toContain('INVALID_ARGUMENT');
  });

  it('άλλος tenant δεν βλέπει τις γραμμές — μηδενικά, όχι σφάλμα', async () => {
    const result = await handler.execute(
      'boq_get_statistics',
      { buildingId: BUILDING },
      agenticContext(INTRUDER),
    );

    expect(result.success).toBe(true);
    expect((result.data as { value: { total: number } }).value.total).toBe(0);
  });

  it('γραμμή άλλου πελάτη επιστρέφει NOT_FOUND, όχι PERMISSION_DENIED', async () => {
    const result = await handler.execute('boq_get_item', { itemId: 'boq-1' }, agenticContext(INTRUDER));

    // PERMISSION_DENIED θα επιβεβαίωνε ότι το id υπάρχει (μαντείο ύπαρξης).
    expect(result.error).toContain('NOT_FOUND');
    expect(result.error).not.toContain('PERMISSION_DENIED');
  });

  it('μη διαχειριστής απορρίπτεται', async () => {
    const result = await handler.execute(
      'boq_get_statistics',
      { buildingId: BUILDING },
      agenticContext(OWNER, false),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('PERMISSION_DENIED');
  });
});

// ============================================================================
// ΑΠΟΤΕΛΕΣΜΑ
// ============================================================================

describe('το αποτέλεσμα είναι ΦΑΚΕΛΟΣ, πλήρης', () => {
  it('επιστρέφει τον φάκελο VQE, όχι ωμό αριθμό', async () => {
    const result = await handler.execute(
      'boq_get_statistics',
      { buildingId: BUILDING },
      agenticContext(OWNER),
    );
    const envelope = result.data as Record<string, unknown>;

    expect(result.success).toBe(true);
    for (const key of ['schemaVersion', 'value', 'basis', 'provenance', 'governance', 'integrity']) {
      expect(envelope).toHaveProperty(key);
    }
  });

  it('το count αντιστοιχεί στις γραμμές που στηρίζουν τον αριθμό', async () => {
    const result = await handler.execute(
      'boq_get_statistics',
      { buildingId: BUILDING },
      agenticContext(OWNER),
    );

    expect(result.count).toBe(ownerItems.length);
  });

  it('ο φάκελος ΔΕΝ περικόπτεται σε συμβολοσειρά', async () => {
    const result = await handler.execute(
      'boq_search_items',
      { buildingId: BUILDING },
      agenticContext(OWNER),
    );

    // Οι υπόλοιποι handlers περνούν από truncateResult(). Εδώ θα κατέστρεφε τον
    // φάκελο και θα έκανε τον πράκτορα να αθροίζει λειψή λίστα.
    expect(typeof result.data).toBe('object');
    expect(String(JSON.stringify(result.data))).not.toContain('truncated');
  });

  it('άγνωστο εργαλείο επιστρέφει NOT_FOUND χωρίς να ρίξει', async () => {
    const result = await handler.execute('boq_nope', {}, agenticContext(OWNER));

    expect(result.success).toBe(false);
    expect(result.error).toContain('NOT_FOUND');
  });
});
