/**
 * Capability Registry — οι έλεγχοι κατασκευής και η σειρά επιβολής.
 *
 * Το ζητούμενο δεν είναι «ρίχνει σε λάθος όνομα» αλλά **πότε** ρίχνει: κατά τη
 * φόρτωση, δηλαδή στο πρώτο import, όχι στο πρώτο κακό αίτημα. Και ότι η
 * πολιτική κρίνεται **πριν** ο handler δει οτιδήποτε.
 *
 * @module services/agent-capability/registry/__tests__/capability-registry
 * @see ADR-734 §5.2, §5.3, §5.4
 */

import { buildEnvelope } from '../../vqe';
import {
  type AnyCapability,
  type CapabilityContext,
  type CapabilityOutcome,
  createCapabilityRegistry,
  defineCapability,
  defineParams,
} from '../index';

const CTX: CapabilityContext = { companyId: 'co-1', isAdmin: true, requestId: 'req-1' };

const READ_POLICY = { access: 'read', requiresAdmin: false } as const;
const READ_ANNOTATIONS = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

interface OverrideOptions {
  readonly name?: string;
  readonly params?: Parameters<typeof defineParams>[0];
  readonly policy?: { access: 'read' | 'write'; requiresAdmin: boolean };
  readonly annotations?: { readOnlyHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  readonly onCall?: () => void;
}

/** Ελάχιστη έγκυρη δυνατότητα, με σημεία παραλλαγής για κάθε έλεγχο. */
function makeCapability(overrides: OverrideOptions = {}): AnyCapability {
  const { onCall } = overrides;
  return defineCapability({
    name: overrides.name ?? 'boq_probe',
    domain: 'boq',
    title: 'Probe',
    description: 'Test capability.',
    params: overrides.params ?? defineParams({}),
    valueSchema: { type: 'number' },
    policy: overrides.policy ?? READ_POLICY,
    annotations: overrides.annotations ?? READ_ANNOTATIONS,
    handler() {
      onCall?.();
      return Promise.resolve({
        ok: true,
        envelope: buildEnvelope({ value: 1, sourceItems: [], computedBy: 'boq-service.search' }),
      });
    },
  });
}

// ============================================================================

describe('έλεγχοι κατασκευής — ρίχνουν στο import, όχι στο αίτημα', () => {
  it('απορρίπτει όνομα εκτός μορφής', () => {
    expect(() => createCapabilityRegistry([makeCapability({ name: 'BOQ-Get-Summary' })])).toThrow(/invalid capability name/);
  });

  it('απορρίπτει όνομα χωρίς πρόθεμα τομέα (§5.3)', () => {
    expect(() => createCapabilityRegistry([makeCapability({ name: 'get_summary' })])).toThrow(/domain prefix/);
  });

  it('απορρίπτει διπλό όνομα', () => {
    expect(() => createCapabilityRegistry([makeCapability(), makeCapability()])).toThrow(/duplicate capability/);
  });

  it.each(['companyId', 'tenantId', 'organizationId'])(
    'απορρίπτει δυνατότητα που δηλώνει «%s» ως παράμετρο (§7 διόρθωση 2)',
    (paramName) => {
      const params = defineParams({ [paramName]: { kind: 'string', description: 'x' } });
      expect(() => createCapabilityRegistry([makeCapability({ params })])).toThrow(/tenant identity comes from CapabilityContext/);
    },
  );

  it('απορρίπτει readOnlyHint που αντιφάσκει με την επιβαλλόμενη πολιτική (§5.4)', () => {
    expect(() =>
      createCapabilityRegistry([
        makeCapability({
          policy: { access: 'write', requiresAdmin: true },
          annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
        }),
      ]),
    ).toThrow(/must not contradict the enforced policy/);
  });

  it('δέχεται συνεπή write δυνατότητα (η υπόδειξη ακολουθεί την πολιτική)', () => {
    expect(() =>
      createCapabilityRegistry([
        makeCapability({
          policy: { access: 'write', requiresAdmin: true },
          annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
        }),
      ]),
    ).not.toThrow();
  });
});

describe('κατάλογος', () => {
  it('επιστρέφει ταξινομημένα κατά όνομα — σταθερή σειρά μεταξύ εκτελέσεων', () => {
    const registry = createCapabilityRegistry([
      makeCapability({ name: 'boq_zeta' }),
      makeCapability({ name: 'boq_alpha' }),
    ]);
    expect(registry.list().map((c) => c.name)).toEqual(['boq_alpha', 'boq_zeta']);
  });

  it('φιλτράρει κατά access — υποδομή για progressive disclosure', () => {
    const registry = createCapabilityRegistry([
      makeCapability({ name: 'boq_read_one' }),
      makeCapability({
        name: 'boq_write_one',
        policy: { access: 'write', requiresAdmin: true },
        annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
      }),
    ]);
    expect(registry.list({ access: 'read' }).map((c) => c.name)).toEqual(['boq_read_one']);
  });
});

describe('invoke — σειρά επιβολής', () => {
  it('άγνωστο όνομα ⇒ NOT_FOUND', async () => {
    const registry = createCapabilityRegistry([makeCapability()]);
    const outcome = await registry.invoke('boq_missing', {}, CTX);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('NOT_FOUND');
  });

  it('η ταυτοποίηση προηγείται της εξουσιοδότησης', async () => {
    const registry = createCapabilityRegistry([
      makeCapability({ policy: { access: 'read', requiresAdmin: true } }),
    ]);
    const outcome = await registry.invoke('boq_probe', {}, { companyId: '', isAdmin: false, requestId: 'r' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('UNAUTHENTICATED');
  });

  it('η εξουσιοδότηση προηγείται του ελέγχου ορισμάτων — κακά ορίσματα δεν αποκαλύπτουν σχήμα', async () => {
    let called = false;
    const registry = createCapabilityRegistry([
      makeCapability({
        policy: { access: 'read', requiresAdmin: true },
        params: defineParams({ itemId: { kind: 'string', description: 'x' } }),
        onCall: () => { called = true; },
      }),
    ]);

    const outcome = await registry.invoke('boq_probe', { itemId: 42 }, { ...CTX, isAdmin: false });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('PERMISSION_DENIED');
    expect(called).toBe(false);
  });

  it('δυνατότητα εγγραφής απορρίπτεται fail-closed όσο η Φάση 4 δεν έχει ανοίξει', async () => {
    let called = false;
    const registry = createCapabilityRegistry([
      makeCapability({
        policy: { access: 'write', requiresAdmin: false },
        annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
        onCall: () => { called = true; },
      }),
    ]);

    const outcome = await registry.invoke('boq_probe', {}, CTX);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.message).toMatch(/Write capabilities are not enabled/);
    expect(called).toBe(false);
  });

  it('κακά ορίσματα ⇒ INVALID_ARGUMENT χωρίς να τρέξει ο handler', async () => {
    let called = false;
    const registry = createCapabilityRegistry([
      makeCapability({
        params: defineParams({ itemId: { kind: 'string', description: 'x' } }),
        onCall: () => { called = true; },
      }),
    ]);

    const outcome = await registry.invoke('boq_probe', {}, CTX);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('INVALID_ARGUMENT');
    expect(called).toBe(false);
  });

  it('εξαίρεση handler ⇒ INTERNAL, χωρίς διαρροή μηνύματος υποδομής', async () => {
    const leaky = defineCapability({
      name: 'boq_leaky',
      domain: 'boq',
      title: 'Leaky',
      description: 'Throws.',
      params: defineParams({}),
      valueSchema: { type: 'number' },
      policy: READ_POLICY,
      annotations: READ_ANNOTATIONS,
      handler(): Promise<CapabilityOutcome<number>> {
        throw new Error('FIRESTORE_CONNECTION_STRING=secret');
      },
    });

    const registry = createCapabilityRegistry([leaky]);
    const outcome = await registry.invoke('boq_leaky', {}, CTX);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('INTERNAL');
    expect(outcome.error.message).not.toMatch(/secret/);
  });

  it('επιτυχία ⇒ πάντα φάκελος VQE', async () => {
    const registry = createCapabilityRegistry([makeCapability()]);
    const outcome = await registry.invoke('boq_probe', {}, CTX);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.envelope.integrity.inputsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.envelope.schemaVersion).toBeTruthy();
  });
});
