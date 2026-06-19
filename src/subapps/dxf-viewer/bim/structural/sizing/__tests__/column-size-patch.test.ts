/**
 * ADR-499 Slice B2 — column-size-patch (auto-size διατομής ως undoable patch + guards).
 */

import type { ColumnEntity, ColumnParams } from '../../../types/column-types';
import type { BeamEntity } from '../../../types/beam-types';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import { buildColumnSizePatch, isColumnAutoSized, resolveColumnSectionLock } from '../column-size-patch';

const BIG_CANTILEVER_MOMENT_KNM = 2000;

function makeColumn(over: Partial<ColumnParams> = {}): ColumnEntity {
  const params = {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchor: 'center',
    width: 400,
    depth: 400,
    height: 3000,
    sceneUnits: 'mm',
    ...over,
  } as ColumnParams;
  return { type: 'column', kind: params.kind, id: 'col_test', params } as unknown as ColumnEntity;
}

describe('isColumnAutoSized', () => {
  it('default AUTO όταν λείπει το flag', () => {
    expect(isColumnAutoSized(makeColumn().params)).toBe(true);
  });
  it('locked μόνο όταν autoSized:false', () => {
    expect(isColumnAutoSized(makeColumn({ autoSized: false }).params)).toBe(false);
  });
});

describe('buildColumnSizePatch', () => {
  it('στηρίζουσα κολώνα προβόλου (μεγάλη ροπή) → αυτο-μεγαλώνει + autoSized:true', () => {
    const patch = buildColumnSizePatch(makeColumn(), EUROCODE_PROVIDER, BIG_CANTILEVER_MOMENT_KNM);
    expect(patch).not.toBeNull();
    expect(patch!.next.width).toBeGreaterThan(400);
    expect(patch!.next.depth).toBeGreaterThan(400);
    expect(patch!.next.autoSized).toBe(true);
  });

  it('τετράγωνη 400×400 χωρίς φορτίο → patch ΜΙΚΡΑΙΝΕΙ σε 250×250 (ADR-503 two-way, no waste)', () => {
    const patch = buildColumnSizePatch(makeColumn(), EUROCODE_PROVIDER);
    expect(patch).not.toBeNull();
    expect(patch!.next.width).toBe(250);
    expect(patch!.next.depth).toBe(250);
    expect(patch!.next.autoSized).toBe(true);
  });

  it('null για κλειδωμένη κολώνα (manual override wins)', () => {
    expect(buildColumnSizePatch(makeColumn({ autoSized: false }), EUROCODE_PROVIDER, BIG_CANTILEVER_MOMENT_KNM)).toBeNull();
  });

  it('null για μη-ορθογώνια (DEFER shape-grow)', () => {
    expect(buildColumnSizePatch(makeColumn({ kind: 'circular' }), EUROCODE_PROVIDER, BIG_CANTILEVER_MOMENT_KNM)).toBeNull();
  });

  it('null για μη-κολώνα', () => {
    const beam = { type: 'beam', id: 'beam_x', params: {} } as unknown as BeamEntity;
    expect(buildColumnSizePatch(beam, EUROCODE_PROVIDER, BIG_CANTILEVER_MOMENT_KNM)).toBeNull();
  });

  it('null όταν συγκλίνει (διατομή ήδη επαρκής)', () => {
    const grown = buildColumnSizePatch(makeColumn(), EUROCODE_PROVIDER, BIG_CANTILEVER_MOMENT_KNM)!.next;
    const converged = buildColumnSizePatch(
      makeColumn({ width: grown.width, depth: grown.depth }), EUROCODE_PROVIDER, BIG_CANTILEVER_MOMENT_KNM,
    );
    expect(converged).toBeNull();
  });

  it('prev κρατά τα αρχικά params αυτούσια (undo Firestore-safe)', () => {
    const original = makeColumn();
    const patch = buildColumnSizePatch(original, EUROCODE_PROVIDER, BIG_CANTILEVER_MOMENT_KNM)!;
    expect(patch.prev).toBe(original.params);
  });
});

describe('resolveColumnSectionLock — ADR-503 Slice 2 (safety-gated lock)', () => {
  const LIVE_LOAD = { deadAxialKn: 430.09, liveAxialKn: 105.65, source: 'takedown' as const };
  const prev = makeColumn({ appliedLoad: LIVE_LOAD }).params; // 400×400 AUTO

  it('μη-section edit (ίδια διατομή) → pass-through, δεν κλειδώνει, δεν απορρίπτει', () => {
    const next = { ...prev, height: 3200 };
    const r = resolveColumnSectionLock(EUROCODE_PROVIDER, prev, next);
    expect(r.params).toBe(next);
    expect(r.rejected).toBe(false);
  });

  it('χειροκίνητη 500×500 (επαρκής) → lock OK (autoSized:false, δεν απορρίπτει)', () => {
    const next = { ...prev, width: 500, depth: 500 };
    const r = resolveColumnSectionLock(EUROCODE_PROVIDER, prev, next);
    expect(r.rejected).toBe(false);
    expect(r.params.autoSized).toBe(false);
    expect(r.params.width).toBe(500);
  });

  it('χειροκίνητη 200×200 (ανεπαρκής) → ΜΠΛΟΚ: clamp στο ελάχιστο επαρκές + μένει AUTO', () => {
    const next = { ...prev, width: 200, depth: 200 };
    const r = resolveColumnSectionLock(EUROCODE_PROVIDER, prev, next);
    expect(r.rejected).toBe(true);
    expect(r.params.autoSized).toBe(true);
    expect(r.params.width).toBe(300); // ελάχιστο επαρκές (ν-governed)
    expect(r.params.depth).toBe(300);
    expect(r.minWidthMm).toBe(300);
  });
});
