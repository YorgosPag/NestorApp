/**
 * ADR-508 §neighbor-clearance (move) — entity-footprint-for-dims routing + smoke.
 *
 * Επικυρώνει ότι το generic footprint resolver δρομολογεί σωστά ανά entity type (κολόνα/δοκός →
 * member footprint· τοίχος → wall footprint· τα υπόλοιπα → undefined = no-op). Το import εδώ πιάνει
 * και τυχόν κυκλικές εξαρτήσεις των νέων move-clearance modules (bim/framing ↔ hooks/drawing).
 */

import { resolveEntityFootprintForDims } from '../entity-footprint-for-dims';
import { resolveMoveClearanceDims } from '../move-clearance-dims';
import type { Entity } from '../../../types/entities';
import type { SceneUnits } from '../../../utils/scene-units';

const SQUARE = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
];

describe('resolveEntityFootprintForDims', () => {
  it('κολόνα → geometry.footprint.vertices', () => {
    const col = { id: 'c1', type: 'column', geometry: { footprint: { vertices: SQUARE } } };
    expect(resolveEntityFootprintForDims(col as unknown as Entity)).toHaveLength(4);
  });

  it('δοκός → geometry.displayOutline[0]', () => {
    const beam = { id: 'b1', type: 'beam', geometry: { displayOutline: [SQUARE] } };
    expect(resolveEntityFootprintForDims(beam as unknown as Entity)).toHaveLength(4);
  });

  it('DXF γραμμή → bbox footprint (Giorgio: «οποιαδήποτε οντότητα»)', () => {
    const line = { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } };
    const fp = resolveEntityFootprintForDims(line as unknown as Entity);
    expect(fp).toHaveLength(4); // axis-aligned bbox corners
  });

  it('DXF κύκλος → bbox footprint', () => {
    const circle = { id: 'ci1', type: 'circle', center: { x: 0, y: 0 }, radius: 50 };
    expect(resolveEntityFootprintForDims(circle as unknown as Entity)).toHaveLength(4);
  });

  it('entity χωρίς geometry/bounds → undefined', () => {
    const empty = { id: 'x1', type: 'text' };
    expect(resolveEntityFootprintForDims(empty as unknown as Entity)).toBeUndefined();
  });
});

describe('resolveMoveClearanceDims (full path: footprint → collect → resolve)', () => {
  it('κανένας γείτονας (άδεια σκηνή) → null', () => {
    // Πιάνει και τυχόν κυκλική εξάρτηση του move-clearance-dims (import cross-layer με wysiwyg).
    const line = { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
    const dims = resolveMoveClearanceDims(
      line as unknown as Entity, { x: 0, y: 0 }, new Set(['l1']), [], 'mm' as unknown as SceneUnits, 1,
    );
    expect(dims).toBeNull();
  });
});
