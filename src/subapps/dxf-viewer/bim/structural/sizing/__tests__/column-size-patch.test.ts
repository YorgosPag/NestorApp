/**
 * ADR-499 Slice B2 — column-size-patch (auto-size διατομής ως undoable patch + guards).
 */

import type { ColumnEntity, ColumnParams } from '../../../types/column-types';
import type { BeamEntity } from '../../../types/beam-types';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import { buildColumnSizePatch, isColumnAutoSized } from '../column-size-patch';

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

  it('null χωρίς ροπή/φορτίο (400×400 επαρκεί → convergence)', () => {
    expect(buildColumnSizePatch(makeColumn(), EUROCODE_PROVIDER)).toBeNull();
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
