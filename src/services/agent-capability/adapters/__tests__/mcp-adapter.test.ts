/**
 * MCP adapter (ADR-734 Φάση 3, L3) — μορφή πρωτοκόλλου, όχι μόνο «τρέχει»
 *
 * Το βάρος πέφτει σε τρία σημεία που, αν σπάσουν, σπάνε σιωπηλά:
 *   1. το `outputSchema` **δεν** γράφεται από τον adapter (θα ήταν τρίτη πηγή),
 *   2. ο φάκελος που επιστρέφεται **συμμορφώνεται** με το δηλωμένο σχήμα,
 *   3. αστοχία ⇒ `isError: true` **χωρίς** `structuredContent` — φάκελος που δεν
 *      χτίστηκε δεν επιτρέπεται να προσποιηθεί ότι υπάρχει.
 *
 * @module services/agent-capability/adapters/__tests__/mcp-adapter
 * @see ADR-734 §5.1, §5.4, §6
 */

import type { CapabilityContext, CapabilityOutcome, JsonSchema } from '../../registry';
import { capabilityError, capabilityOutputSchema } from '../../registry';
import { createBoqCapabilities, createBoqCapabilityRegistry } from '../../capabilities/boq';
import { makeItem } from '../../vqe/__tests__/vqe-test-fixtures';
import { createFakeBoqService } from '../../capabilities/boq/__tests__/fake-boq-service';
import { toMcpCallToolResult, toMcpTool, toMcpTools } from '../mcp-adapter';

const OWNER = 'co-1';
const BUILDING = 'bld-1';
const ADMIN_CTX: CapabilityContext = { companyId: OWNER, isAdmin: true, requestId: 'req-1' };

const item = makeItem({ id: 'boq-1', companyId: OWNER, buildingId: BUILDING, categoryCode: 'OIK-2' });

function buildRegistry() {
  return createBoqCapabilityRegistry({ boq: createFakeBoqService({ items: [item] }).service });
}

function capabilities() {
  return createBoqCapabilities({ boq: createFakeBoqService({ items: [item] }).service });
}

/** Ελάχιστος έλεγχος συμμόρφωσης: τα `required` κλειδιά υπάρχουν στην τιμή. */
function requiredKeysPresent(schema: JsonSchema, value: unknown): string[] {
  const record = value as Record<string, unknown>;
  const required = (schema as { required?: readonly string[] }).required ?? [];
  return required.filter((key) => !(key in record));
}

// ============================================================================
// ΟΡΙΣΜΟΣ ΕΡΓΑΛΕΙΟΥ
// ============================================================================

describe('toMcpTool — ο ορισμός που ανακοινώνεται στην tools/list', () => {
  it('μεταφέρει όνομα, τίτλο και περιγραφή από τη δυνατότητα', () => {
    const capability = capabilities()[0];
    expect(capability).toBeDefined();
    if (!capability) return;

    const tool = toMcpTool(capability);

    expect(tool.name).toBe(capability.name);
    expect(tool.title).toBe(capability.title);
    expect(tool.description).toBe(capability.description);
  });

  it('δηλώνει outputSchema, και είναι ΤΟ ΙΔΙΟ με του registry', () => {
    for (const capability of capabilities()) {
      // Αν ο adapter έφτιαχνε δικό του σχήμα φακέλου, εδώ θα αποκλίνανε — και θα
      // ήταν τρίτη πηγή αλήθειας δίπλα στο VQE και στο registry.
      expect(toMcpTool(capability).outputSchema).toEqual(capabilityOutputSchema(capability));
    }
  });

  it('το inputSchema έχει ρίζα type:"object" όπως απαιτεί το πρωτόκολλο', () => {
    for (const capability of capabilities()) {
      expect((toMcpTool(capability).inputSchema as { type?: string }).type).toBe('object');
    }
  });

  it('καμία δυνατότητα δεν εκθέτει παράμετρο tenant', () => {
    for (const capability of capabilities()) {
      const properties = (toMcpTool(capability).inputSchema as {
        properties?: Record<string, unknown>;
      }).properties ?? {};

      expect(Object.keys(properties)).not.toContain('companyId');
      expect(Object.keys(properties)).not.toContain('tenantId');
    }
  });
});

describe('annotations — δεν επιβάλλουν, αλλά ΔΕΝ επιτρέπεται να λένε ψέματα', () => {
  it('readOnlyHint συμφωνεί με την επιβαλλόμενη πολιτική', () => {
    for (const capability of capabilities()) {
      expect(toMcpTool(capability).annotations?.readOnlyHint).toBe(capability.policy.access === 'read');
    }
  });

  it('destructiveHint δηλώνεται ΡΗΤΑ, ποτέ δεν παραλείπεται', () => {
    for (const capability of capabilities()) {
      const annotations = toMcpTool(capability).annotations;

      // Η προεπιλογή του προτύπου για μη-read-only είναι `true`. Παράλειψη ⇒ η
      // συμπεριφορά του client καθορίζεται από το πρότυπο, όχι από εμάς.
      expect(annotations?.destructiveHint).toBeDefined();
      expect(annotations?.destructiveHint).toBe(!capability.annotations.readOnlyHint);
    }
  });

  it('idempotentHint / openWorldHint μεταφέρονται αυτούσια', () => {
    for (const capability of capabilities()) {
      const annotations = toMcpTool(capability).annotations;
      expect(annotations?.idempotentHint).toBe(capability.annotations.idempotentHint);
      expect(annotations?.openWorldHint).toBe(capability.annotations.openWorldHint);
    }
  });
});

describe('toMcpTools — σειρά σταθερή μεταξύ εκτελέσεων', () => {
  it('διατηρεί τη σειρά του registry (ταξινομημένη κατά όνομα)', () => {
    const names = toMcpTools(buildRegistry().list()).map((t) => t.name);
    expect(names).toEqual([...names].sort());
  });

  it('εκθέτει και τα επτά εργαλεία', () => {
    expect(toMcpTools(buildRegistry().list())).toHaveLength(7);
  });
});

// ============================================================================
// ΑΠΟΤΕΛΕΣΜΑ ΚΛΗΣΗΣ
// ============================================================================

describe('toMcpCallToolResult — επιτυχία', () => {
  it('βάζει τον φάκελο ΑΥΤΟΥΣΙΟ στο structuredContent', async () => {
    const registry = buildRegistry();
    const outcome = await registry.invoke('boq_get_statistics', { buildingId: BUILDING }, ADMIN_CTX);
    const result = toMcpCallToolResult(outcome);

    expect(result.isError).toBeUndefined();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(result.structuredContent).toBe(outcome.envelope);
  });

  it('ο φάκελος συμμορφώνεται με το outputSchema που δηλώνει το εργαλείο', async () => {
    const registry = buildRegistry();
    // Ορίσματα ανά εργαλείο — τα σχήματα εισόδου είναι αυστηρά, οπότε περιττό
    // κλειδί απορρίπτεται ως `INVALID_ARGUMENT` (και σωστά).
    const argsByTool: Readonly<Record<string, Record<string, unknown>>> = {
      boq_get_statistics: { buildingId: BUILDING },
      boq_get_summary: { buildingId: BUILDING },
      boq_list_categories: {},
      boq_get_item: { itemId: item.id },
      boq_get_variance: { itemId: item.id },
      boq_get_baseline_drift: { itemId: item.id },
    };

    for (const capability of registry.list()) {
      const args = argsByTool[capability.name];
      if (args === undefined) continue;

      const outcome = await registry.invoke(capability.name, args, ADMIN_CTX);
      expect(outcome.ok).toBe(true);

      const result = toMcpCallToolResult(outcome);
      const missing = requiredKeysPresent(capabilityOutputSchema(capability), result.structuredContent);

      // «Αν δηλώνεις outputSchema, κάθε αποτέλεσμα οφείλει να συμμορφώνεται.»
      expect(missing).toEqual([]);
    }
  });

  it('συνοδεύεται ΠΑΝΤΑ από αναγνώσιμο content — δεν είναι προαιρετικό', async () => {
    const registry = buildRegistry();
    const outcome = await registry.invoke('boq_get_statistics', { buildingId: BUILDING }, ADMIN_CTX);
    const result = toMcpCallToolResult(outcome);

    // Client που δεν υποστηρίζει structuredContent πρέπει να δει κάτι.
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');
    expect(result.content[0]?.text.length).toBeGreaterThan(0);
  });

  it('η περίληψη αναφέρει κατάσταση, πηγές και υπογραψιμότητα', async () => {
    const registry = buildRegistry();
    const outcome = await registry.invoke('boq_get_statistics', { buildingId: BUILDING }, ADMIN_CTX);
    const text = toMcpCallToolResult(outcome).content[0]?.text ?? '';

    expect(text).toContain('status=');
    expect(text).toContain('sources=');
    expect(text).toContain('signable=');
    expect(text).toContain('engine=');
  });

  it('η περίληψη ΔΕΝ επαναλαμβάνει τον φάκελο (κόστος tokens)', async () => {
    const registry = buildRegistry();
    const outcome = await registry.invoke('boq_get_statistics', { buildingId: BUILDING }, ADMIN_CTX);
    const result = toMcpCallToolResult(outcome);
    const text = result.content[0]?.text ?? '';

    expect(text.length).toBeLessThan(JSON.stringify(result.structuredContent).length / 2);
  });
});

describe('toMcpCallToolResult — αστοχία', () => {
  const failure: CapabilityOutcome<never> = {
    ok: false,
    error: capabilityError('NOT_FOUND', 'BOQ item not found: x', { resource: 'BOQ item', id: 'x' }),
  };

  it('σημαίνεται με isError, όχι με σφάλμα JSON-RPC', () => {
    expect(toMcpCallToolResult(failure).isError).toBe(true);
  });

  it('ΔΕΝ επιστρέφει structuredContent', () => {
    // Φάκελος που δεν χτίστηκε δεν επιτρέπεται να μοιάζει υπαρκτός: ένας client
    // που κάνει `structuredContent ?? {}` θα διάβαζε «κενή» έγκυρη απάντηση.
    expect(toMcpCallToolResult(failure).structuredContent).toBeUndefined();
  });

  it('το κείμενο φέρει τον κωδικό ώστε το μοντέλο να μπορεί να διορθώσει', () => {
    const text = toMcpCallToolResult(failure).content[0]?.text ?? '';

    expect(text).toContain('NOT_FOUND');
    expect(text).toContain('id=x');
  });

  it('σφάλμα χωρίς details δεν παράγει κενές παρενθέσεις', () => {
    const bare: CapabilityOutcome<never> = {
      ok: false,
      error: capabilityError('INTERNAL', 'Capability failed.'),
    };

    expect(toMcpCallToolResult(bare).content[0]?.text).toBe('INTERNAL: Capability failed.');
  });

  it('άγνωστο εργαλείο περνά ως αστοχία, χωρίς να ρίξει', async () => {
    const outcome = await buildRegistry().invoke('boq_does_not_exist', {}, ADMIN_CTX);
    const result = toMcpCallToolResult(outcome);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('NOT_FOUND');
  });

  it('μη διαχειριστής απορρίπτεται πριν φτάσει σε δεδομένα', async () => {
    const outcome = await buildRegistry().invoke(
      'boq_get_statistics',
      { buildingId: BUILDING },
      { companyId: OWNER, isAdmin: false, requestId: 'req-2' },
    );

    expect(toMcpCallToolResult(outcome).content[0]?.text).toContain('PERMISSION_DENIED');
  });
});
