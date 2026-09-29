/**
 * @fileoverview **ΟΙ ΘΟΛΩΜΕΝΕΣ ΠΕΡΙΟΧΕΣ ΜΙΑΣ ΛΗΨΗΣ** (ADR-884 Φ2ζ · §4.15 · Α8) — εντολές, κλειδί πλακιδίων, αναίρεση.
 *
 * - **Ε** — εντολές: πρόθεση (`create`/`replace`), ιδεμποτία, όρια, κανονικοποίηση yaw, αφαίρεση.
 * - **Κ** — υλικό κλειδιού: ανεξάρτητο από σειρά/id/σφραγίδα, ίδιο για ±0 και για yaw ± 2π, αλλάζει με γεωμετρία/πρωτότυπο.
 * - **Ν** — αναίρεση: πιστή στο **ίδιο** id, `null` χωρίς το «πριν».
 */

import { MAX_TOUR_REDACTIONS, TOUR_REDACTION_MAX_RADIUS_RAD, TOUR_REDACTION_MIN_RADIUS_RAD } from '@/constants/spatial-tour-vocabulary';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { TourRedaction, TourRedactionRegion } from '@/types/spatial-tour';

import type { TourGraphCommand } from '../tour-graph-edit';
import { inverseOf } from '../tour-graph-inverse';
import {
  normalizeRedactionRegion,
  originalHashOf,
  planAutoRedactions,
  redactionKeyMaterial,
  removeRedaction,
  upsertRedaction,
} from '../tour-redaction-edit';

const STAMP = { uid: 'boris', at: '2026-09-29T10:00:00.000Z' };
const REGION: TourRedactionRegion = { yawRad: 0.5, pitchRad: 0.1, radiusRad: 0.2 };
const ID = enterpriseIdService.generateTourRedactionId();

function redaction(overrides: Partial<TourRedaction> = {}): TourRedaction {
  return { id: ID, ...REGION, source: 'auto', createdBy: 'system', createdAt: '2026-09-28T10:00:00.000Z', ...overrides };
}

describe('Ε — εντολές', () => {
  it('create ⇒ νέα περιοχή του ανθρώπου αυτής της εντολής', () => {
    expect(upsertRedaction([], { redactionId: ID, mode: 'create', region: REGION }, STAMP)).toEqual({
      kind: 'edited', redactions: [{ id: ID, ...REGION, source: 'manual', createdBy: 'boris', createdAt: STAMP.at }],
    });
  });

  it('επανάληψη create με ίδια γεωμετρία ⇒ unchanged· με άλλη ⇒ redaction-exists', () => {
    const current = [redaction()];
    expect(upsertRedaction(current, { redactionId: ID, mode: 'create', region: REGION }, STAMP)).toEqual({ kind: 'unchanged' });
    expect(upsertRedaction(current, { redactionId: ID, mode: 'create', region: { ...REGION, radiusRad: 0.3 } }, STAMP))
      .toEqual({ kind: 'refused', reason: 'redaction-exists' });
  });

  it('replace υπάρχουσας ⇒ νέα γεωμετρία, πλέον manual· replace ανύπαρκτης ⇒ redaction-absent', () => {
    const edited = upsertRedaction([redaction()], { redactionId: ID, mode: 'replace', region: { ...REGION, radiusRad: 0.3 } }, STAMP);
    expect(edited).toEqual({ kind: 'edited', redactions: [expect.objectContaining({ radiusRad: 0.3, source: 'manual', createdBy: 'boris' })] });
    expect(upsertRedaction([], { redactionId: ID, mode: 'replace', region: REGION }, STAMP)).toEqual({ kind: 'refused', reason: 'redaction-absent' });
  });

  it('id που δεν είναι tred_ ⇒ redaction-invalid', () => {
    const foreign = enterpriseIdService.generateTourSpaceId();
    expect(upsertRedaction([], { redactionId: foreign, mode: 'create', region: REGION }, STAMP)).toEqual({ kind: 'refused', reason: 'redaction-invalid' });
  });

  it('όριο περιοχών ⇒ redaction-limit (μόνο για ΝΕΑ)', () => {
    const full = Array.from({ length: MAX_TOUR_REDACTIONS }, () => redaction({ id: enterpriseIdService.generateTourRedactionId() }));
    expect(upsertRedaction(full, { redactionId: ID, mode: 'create', region: REGION }, STAMP)).toEqual({ kind: 'refused', reason: 'redaction-limit' });
    const first = full[0];
    expect(upsertRedaction(full, { redactionId: first.id, mode: 'replace', region: { ...REGION, radiusRad: 0.4 } }, STAMP).kind).toBe('edited');
  });

  it('αφαίρεση ⇒ λείπει· ανύπαρκτης ⇒ unchanged', () => {
    expect(removeRedaction([redaction()], ID)).toEqual({ kind: 'edited', redactions: [] });
    expect(removeRedaction([], ID)).toEqual({ kind: 'unchanged' });
  });
});

describe('Ε — κανονικοποίηση γεωμετρίας', () => {
  it('yaw στο (−π, π]· πέρα από τους πόλους / εκτός ορίων ακτίνας ⇒ null', () => {
    expect(normalizeRedactionRegion({ ...REGION, yawRad: 2 * Math.PI + 0.5 })?.yawRad).toBeCloseTo(0.5, 12);
    expect(normalizeRedactionRegion({ ...REGION, pitchRad: Math.PI / 2 + 0.01 })).toBeNull();
    expect(normalizeRedactionRegion({ ...REGION, radiusRad: TOUR_REDACTION_MIN_RADIUS_RAD / 2 })).toBeNull();
    expect(normalizeRedactionRegion({ ...REGION, radiusRad: TOUR_REDACTION_MAX_RADIUS_RAD * 1.01 })).toBeNull();
    expect(normalizeRedactionRegion({ ...REGION, yawRad: Number.NaN })).toBeNull();
  });

  it('yaw + 2π σε υπάρχουσα ⇒ ίδια περιοχή ⇒ unchanged', () => {
    const region = { ...REGION, yawRad: REGION.yawRad + 2 * Math.PI };
    expect(upsertRedaction([redaction()], { redactionId: ID, mode: 'replace', region }, STAMP)).toEqual({ kind: 'unchanged' });
  });
});

describe('Κ — υλικό κλειδιού πλακιδίων', () => {
  const HASH = 'a'.repeat(64);

  it('καμία περιοχή ⇒ null (κλειδί = το ίδιο το πρωτότυπο)', () => {
    expect(redactionKeyMaterial(HASH, [])).toBeNull();
  });

  it('σειρά, id και σφραγίδα δεν αλλάζουν pixel ⇒ ούτε το κλειδί', () => {
    const a = redaction({ id: 'tred_a', ...REGION });
    const b = redaction({ id: 'tred_b', yawRad: -1, pitchRad: 0.3, radiusRad: 0.1, createdBy: 'x' });
    expect(redactionKeyMaterial(HASH, [a, b])).toBe(redactionKeyMaterial(HASH, [{ ...b, id: 'tred_c' }, { ...a, source: 'manual' }]));
  });

  it('−0 και 0 ⇒ ίδιο κλειδί', () => {
    expect(redactionKeyMaterial(HASH, [{ ...REGION, pitchRad: -0 }])).toBe(redactionKeyMaterial(HASH, [{ ...REGION, pitchRad: 0 }]));
    expect(redactionKeyMaterial(HASH, [{ ...REGION, pitchRad: -1e-9 }])).toBe(redactionKeyMaterial(HASH, [{ ...REGION, pitchRad: 0 }]));
  });

  it('άλλη γεωμετρία ή άλλο πρωτότυπο ⇒ άλλο κλειδί· φέρει την έκδοση απόδοσης', () => {
    const base = redactionKeyMaterial(HASH, [REGION]);
    expect(redactionKeyMaterial(HASH, [{ ...REGION, radiusRad: 0.21 }])).not.toBe(base);
    expect(redactionKeyMaterial('b'.repeat(64), [REGION])).not.toBe(base);
    expect(base?.startsWith('r1|')).toBe(true);
  });

  it('το hash του πρωτοτύπου: ρητό αν υπάρχει, αλλιώς το κλειδί (λήψη που δεν θολώθηκε ποτέ)', () => {
    const tileset = { state: 'ready' as const, contentHash: 'k'.repeat(64), faceSize: 512 };
    expect(originalHashOf({ tileset })).toBe('k'.repeat(64));
    expect(originalHashOf({ tileset, originalHash: HASH })).toBe(HASH);
  });
});

describe('Ν — αναίρεση', () => {
  const graph = { nodes: [] };
  const context = (current: readonly TourRedaction[]) => ({ redactionsOf: () => current });
  const redact = (mode: 'create' | 'replace'): TourGraphCommand => ({ op: 'redact', captureId: 'tcap_1', redactionId: ID, mode, region: { ...REGION, radiusRad: 0.4 } });

  it('νέα ⇒ αφαίρεση του ίδιου id', () => {
    expect(inverseOf(redact('create'), graph, context([]))).toEqual([{ op: 'unredact', captureId: 'tcap_1', redactionId: ID }]);
  });

  it('αλλαγή ⇒ η προηγούμενη γεωμετρία (replace)· αφαίρεση ⇒ ξαναγέννηση στο ίδιο id (create)', () => {
    const before = [redaction()];
    expect(inverseOf(redact('replace'), graph, context(before))).toEqual([
      { op: 'redact', captureId: 'tcap_1', redactionId: ID, mode: 'replace', region: REGION },
    ]);
    expect(inverseOf({ op: 'unredact', captureId: 'tcap_1', redactionId: ID }, graph, context(before))).toEqual([
      { op: 'redact', captureId: 'tcap_1', redactionId: ID, mode: 'create', region: REGION },
    ]);
  });

  it('αφαίρεση ανύπαρκτης ή χωρίς το «πριν» ⇒ καμία αναίρεση', () => {
    expect(inverseOf({ op: 'unredact', captureId: 'tcap_1', redactionId: ID }, graph, context([]))).toBeNull();
    expect(inverseOf(redact('create'), graph)).toBeNull();
  });
});

describe('Σ — αυτόματη σάρωση προσώπων (ζ4)', () => {
  const SYSTEM = { uid: 'system', at: '2026-09-29T12:00:00.000Z' };
  let next = 0;
  const newId = () => `tred_auto_${++next}`;
  beforeEach(() => { next = 0; });

  it('πρόσωπα ⇒ auto περιοχές ΔΙΠΛΑ στις υπάρχουσες, με id του καλούντος και σφραγίδα του συστήματος · yaw κανονικοποιημένο', () => {
    const manual = redaction({ source: 'manual', createdBy: 'boris', yawRad: -2 });
    const plan = planAutoRedactions([manual], [REGION, { yawRad: 0.5 + 2 * Math.PI, pitchRad: -0.4, radiusRad: 0.1 }], SYSTEM, newId);
    expect(plan.added).toBe(2);
    expect(plan.saturated).toBe(false);
    expect(plan.redactions[0]).toBe(manual);
    expect(plan.redactions.slice(1)).toEqual([
      { id: 'tred_auto_1', ...REGION, source: 'auto', createdBy: 'system', createdAt: SYSTEM.at },
      { id: 'tred_auto_2', yawRad: expect.closeTo(0.5, 9), pitchRad: -0.4, radiusRad: 0.1, source: 'auto', createdBy: 'system', createdAt: SYSTEM.at },
    ]);
  });

  it('πρόσωπο που ΣΚΕΠΑΖΕΤΑΙ ήδη (και από χειροκίνητη) ⇒ καμία δεύτερη περιοχή, κανένα id', () => {
    const manual = redaction({ source: 'manual', radiusRad: 0.5 });
    expect(planAutoRedactions([manual], [REGION], SYSTEM, newId)).toEqual({ redactions: [manual], added: 0, saturated: false });
    expect(next).toBe(0);
  });

  it('άκυρη γεωμετρία (πέρα από τον πόλο) δεν γίνεται ποτέ περιοχή', () => {
    expect(planAutoRedactions([], [{ yawRad: 0, pitchRad: 2, radiusRad: 0.1 }], SYSTEM, newId).added).toBe(0);
  });

  it('όριο: χωρούν μόνο όσα μένουν ως το MAX — ποτέ πάνω από αυτό', () => {
    const full = Array.from({ length: MAX_TOUR_REDACTIONS - 1 }, (_, k) => redaction({ id: `tred_m${k}`, yawRad: -3 + k * 0.01, radiusRad: 0.005 }));
    const faces = [0.5, 1.5, 2.5].map((yawRad) => ({ yawRad, pitchRad: 0, radiusRad: 0.05 }));
    const plan = planAutoRedactions(full, faces, SYSTEM, newId);
    expect(plan.redactions).toHaveLength(MAX_TOUR_REDACTIONS);
    expect(plan.added).toBe(1);
  });
});
