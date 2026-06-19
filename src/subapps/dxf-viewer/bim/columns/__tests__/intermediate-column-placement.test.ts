/**
 * ADR-504 Φ2 S4 — `intermediate-column-placement`: even-split θέσεις + build clone.
 *
 * Επαληθεύει: K ισαπέχουσες **εσωτερικές** θέσεις στον άξονα (ποτέ στα άκρα)· build
 * `ColumnEntity[]` που κλωνοποιεί τη διατομή της template κολώνας (kind/διαστάσεις/
 * vertical extent)· fresh **μοναδικά** Enterprise IDs (N.6)· anchor κεντραρισμένο.
 * Fixtures: canvas = mm.
 */

import {
  intermediateColumnPositions,
  buildIntermediateColumns,
} from '../intermediate-column-placement';
import { completeColumnFromClick } from '../../../hooks/drawing/column-completion';
import type { BeamEntity, BeamParams } from '../../types/beam-types';
import type { ColumnEntity } from '../../types/column-types';

function beam(lengthMm: number, over: Partial<BeamParams> = {}): BeamEntity {
  return {
    id: 'b1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', width: 250, depth: 1450, sceneUnits: 'mm',
      startPoint: { x: 0, y: 0 }, endPoint: { x: lengthMm, y: 0 },
      supportType: 'simple',
      ...over,
    },
    geometry: { length: lengthMm / 1000, volume: 1 },
  } as unknown as BeamEntity;
}

/** Πραγματική template κολώνα μέσω του SSoT builder (έγκυρα params + Enterprise ID). */
function templateColumn(over: Parameters<typeof completeColumnFromClick>[3] = {}): ColumnEntity {
  const result = completeColumnFromClick({ x: 0, y: 0 }, 'layer-1', 'rectangular', {
    width: 500, depth: 600, height: 3200, rotation: 0, baseOffset: -800, ...over,
  }, 'mm');
  if (!result.ok) throw new Error(`template build failed: ${result.hardErrors.join(', ')}`);
  return result.entity;
}

describe('intermediateColumnPositions — even-split', () => {
  it('K=1 → midpoint', () => {
    const pos = intermediateColumnPositions(beam(16000), 1);
    expect(pos).toHaveLength(1);
    expect(pos[0].x).toBeCloseTo(8000, 6);
    expect(pos[0].y).toBeCloseTo(0, 6);
  });

  it('K=3 → ισαπέχουσες εσωτερικές (4000/8000/12000), ποτέ στα άκρα', () => {
    const pos = intermediateColumnPositions(beam(16000), 3);
    expect(pos.map((p) => p.x)).toEqual([4000, 8000, 12000]);
    expect(pos.every((p) => p.x > 0 && p.x < 16000)).toBe(true);
  });

  it('K=0 / αρνητικό → κενό', () => {
    expect(intermediateColumnPositions(beam(16000), 0)).toEqual([]);
    expect(intermediateColumnPositions(beam(16000), -2)).toEqual([]);
  });

  it('διαγώνιος δοκός → split και στους 2 άξονες', () => {
    const b = beam(0, { startPoint: { x: 0, y: 0 }, endPoint: { x: 10000, y: 6000 } });
    const pos = intermediateColumnPositions(b, 1);
    expect(pos[0].x).toBeCloseTo(5000, 6);
    expect(pos[0].y).toBeCloseTo(3000, 6);
  });
});

describe('buildIntermediateColumns — clone διατομής + fresh IDs', () => {
  it('K=2 → 2 κολώνες με τη διατομή/ύψος/base της template', () => {
    const cols = buildIntermediateColumns(beam(12000), templateColumn(), 2, 'layer-1', 'mm');
    expect(cols).toHaveLength(2);
    for (const c of cols) {
      expect(c.type).toBe('column');
      expect(c.params.kind).toBe('rectangular');
      expect(c.params.width).toBe(500);
      expect(c.params.depth).toBe(600);
      expect(c.params.height).toBe(3200);
      expect(c.params.baseOffset).toBe(-800);
      expect(c.params.anchor).toBe('center');
    }
  });

  it('θέσεις κολωνών = even-split του άξονα', () => {
    const cols = buildIntermediateColumns(beam(12000), templateColumn(), 3, 'layer-1', 'mm');
    expect(cols.map((c) => c.params.position.x)).toEqual([3000, 6000, 9000]);
  });

  it('fresh μοναδικά IDs (N.6) — μηδέν collision με την template', () => {
    const template = templateColumn();
    const cols = buildIntermediateColumns(beam(12000), template, 3, 'layer-1', 'mm');
    const ids = cols.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain(template.id);
    expect(cols.every((c) => typeof c.id === 'string' && c.id.length > 0)).toBe(true);
  });

  it('K=0 → κενό', () => {
    expect(buildIntermediateColumns(beam(12000), templateColumn(), 0, 'layer-1', 'mm')).toEqual([]);
  });
});
