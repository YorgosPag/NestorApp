/**
 * buildEnvelope — ΣΥΝΟΛΙΚΗ ΣΥΜΠΕΡΙΦΟΡΑ
 *
 * Οι τρεις μη διαπραγματεύσιμοι κανόνες του ADR-734 §6.3 ελέγχονται εδώ από
 * άκρη σε άκρη, μαζί με τη «σιωπηλή» απαίτηση που τους στηρίζει: ο φάκελος να
 * μη λέει ψέματα για ετερογενή σύνολα.
 */

import type { AllocationWarning } from '@/services/measurements/cost-engine';
import type { EnvelopeIssue, EnvelopeWarningCode } from '@/types/vqe';
import { VQE_SCHEMA_VERSION } from '@/types/vqe';
import { buildEnvelope } from '../build-envelope';
import { allocationIssues } from '../derived';
import { FIXED_NOW, makeItem } from './vqe-test-fixtures';

const ACTIVITY = 'cost-engine.computeBuildingSummary';

function codesOf(warnings: readonly { source: string }[]): readonly EnvelopeWarningCode[] {
  return warnings
    .filter((warning): warning is EnvelopeIssue => warning.source === 'envelope')
    .map((warning) => warning.code);
}

describe('κανόνας 3 — ο φάκελος τυλίγει, δεν μετασχηματίζει', () => {
  it('το value περνά ΑΥΤΟΥΣΙΟ, ίδια αναφορά', () => {
    const payload = { totalEstimatedCost: 1234.56, categories: [] };
    const envelope = buildEnvelope({
      value: payload,
      sourceItems: [makeItem()],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });
    expect(envelope.value).toBe(payload);
  });

  it('δηλώνει την έκδοση σχήματος', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [makeItem()],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });
    expect(envelope.schemaVersion).toBe(VQE_SCHEMA_VERSION);
  });
});

describe('ντετερμινισμός', () => {
  it('ίδιες είσοδοι ⇒ πανομοιότυπος φάκελος', () => {
    const items = [makeItem({ id: 'b' }), makeItem({ id: 'a' })];
    const build = () =>
      buildEnvelope({
        value: { total: 1 },
        sourceItems: items,
        computedBy: ACTIVITY,
        computedAt: FIXED_NOW,
        params: new Map([['OIK-2', 'name']]),
      });
    expect(build()).toEqual(build());
  });

  it('η σειρά των items δεν αλλάζει το inputsHash', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
    const common = { value: null, computedBy: ACTIVITY, computedAt: FIXED_NOW } as const;
    const forward = buildEnvelope({ ...common, sourceItems: items });
    const backward = buildEnvelope({ ...common, sourceItems: [...items].reverse() });
    expect(forward.integrity.inputsHash).toBe(backward.integrity.inputsHash);
  });

  it('το ρολόι είναι ενέσιμο και δεν συμμετέχει στο hash', () => {
    const common = { value: null, sourceItems: [makeItem()], computedBy: ACTIVITY } as const;
    const early = buildEnvelope({ ...common, computedAt: '2026-01-01T00:00:00.000Z' });
    const late = buildEnvelope({ ...common, computedAt: '2027-01-01T00:00:00.000Z' });

    expect(early.provenance.computedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(early.integrity.inputsHash).toBe(late.integrity.inputsHash);
  });

  it('χωρίς ένεση ρολογιού γράφει έγκυρο ISO 8601', () => {
    const envelope = buildEnvelope({ value: null, sourceItems: [], computedBy: ACTIVITY });
    expect(envelope.provenance.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });
});

describe('βάση μέτρησης — παράγεται, δεν δηλώνεται', () => {
  it('ομοιογενές σύνολο δίνει πλήρη βάση', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [makeItem({ id: 'a' }), makeItem({ id: 'b' })],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
      icmsCode: '02.010',
    });

    expect(envelope.basis).toEqual({
      atoeCategoryCode: 'OIK-2',
      unit: 'm3',
      scope: 'building',
      wasteFactorApplied: 0.05,
      costAllocationMethod: 'by_area',
      icmsCode: '02.010',
    });
  });

  it('ετερογενείς μονάδες δίνουν null + προειδοποίηση αντί για ψευδή ενιαία μονάδα', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [makeItem({ id: 'a', unit: 'm3' }), makeItem({ id: 'b', unit: 'kg' })],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });

    expect(envelope.basis.unit).toBeNull();
    expect(codesOf(envelope.provenance.warnings)).toContain('non_uniform_measurement_basis');
  });

  it('κενό σύνολο δίνει βάση χωρίς τιμές και επισημαίνεται', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });
    expect(envelope.basis.unit).toBeNull();
    expect(codesOf(envelope.provenance.warnings)).toContain('no_source_items');
  });
});

describe('προέλευση', () => {
  it('τα sourceItemIds είναι μοναδικά και ταξινομημένα', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [makeItem({ id: 'z' }), makeItem({ id: 'a' }), makeItem({ id: 'z' })],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });
    expect(envelope.provenance.sourceItemIds).toEqual(['a', 'z']);
    expect(codesOf(envelope.provenance.warnings)).toContain('duplicate_source_items');
  });

  it('συλλέγει τα BIM entity ids (prov:wasDerivedFrom)', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [
        makeItem({ id: 'a', sourceEntityId: 'wall-9' }),
        makeItem({ id: 'b', sourceEntityId: null }),
        makeItem({ id: 'c', sourceEntityId: 'wall-1' }),
      ],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });
    expect(envelope.provenance.sourceEntityIds).toEqual(['wall-1', 'wall-9']);
  });

  it('επισημαίνει μη πεπερασμένη ποσότητα χωρίς να αγγίζει το value', () => {
    const payload = { total: 0 };
    const envelope = buildEnvelope({
      value: payload,
      sourceItems: [makeItem({ id: 'a', estimatedQuantity: NaN })],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });

    expect(codesOf(envelope.provenance.warnings)).toContain('non_finite_quantity');
    expect(envelope.value).toBe(payload);
  });

  it('ενσωματώνει τις προειδοποιήσεις επιμερισμού χωρίς να τις αντιγράφει', () => {
    const allocation: AllocationWarning = { type: 'no_area_fallback_to_equal' };
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [makeItem()],
      computedBy: 'cost-engine.allocateCost',
      computedAt: FIXED_NOW,
      warnings: allocationIssues([allocation]),
    });

    expect(envelope.provenance.warnings).toContainEqual({
      source: 'allocation',
      detail: allocation,
    });
  });
});

describe('απόκλιση baseline (ADR-674)', () => {
  it('null όταν ΚΑΝΕΝΑ item δεν παρακολουθείται', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [makeItem({ id: 'a' })],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });
    expect(envelope.governance.baselineDrift).toBeNull();
  });

  it('«ελέγχθηκε, καθαρό» ΔΕΝ μοιάζει με «δεν κοίταξε κανείς»', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [makeItem({ id: 'a', estimatedQuantity: 100, liveQuantity: 100 })],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });

    expect(envelope.governance.baselineDrift).not.toBeNull();
    expect(envelope.governance.baselineDrift?.trackedItemCount).toBe(1);
    expect(envelope.governance.baselineDrift?.driftedItemCount).toBe(0);
    expect(codesOf(envelope.provenance.warnings)).not.toContain('baseline_drift_present');
  });

  it('συνοψίζει την απόκλιση και την επισημαίνει', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [
        makeItem({ id: 'a', estimatedQuantity: 100, liveQuantity: 110 }),
        makeItem({ id: 'b', estimatedQuantity: 50, liveQuantity: 50 }),
      ],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });

    const drift = envelope.governance.baselineDrift;
    expect(drift?.trackedItemCount).toBe(2);
    expect(drift?.driftedItemCount).toBe(1);
    expect(drift?.maxAbsPercent).toBeCloseTo(10);
    expect(drift?.worstItemId).toBe('a');
    expect(drift?.netQuantityDelta).toBe(10);
    expect(codesOf(envelope.provenance.warnings)).toContain('baseline_drift_present');
  });

  it('ΔΕΝ αθροίζει ποσότητες όταν οι μονάδες διαφέρουν', () => {
    const envelope = buildEnvelope({
      value: null,
      sourceItems: [
        makeItem({ id: 'a', unit: 'm3', estimatedQuantity: 100, liveQuantity: 110 }),
        makeItem({ id: 'b', unit: 'kg', estimatedQuantity: 50, liveQuantity: 80 }),
      ],
      computedBy: ACTIVITY,
      computedAt: FIXED_NOW,
    });

    expect(envelope.basis.unit).toBeNull();
    expect(envelope.governance.baselineDrift?.netQuantityDelta).toBeNull();
    expect(envelope.governance.baselineDrift?.driftedItemCount).toBe(2);
  });
});
