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

  // ADR-508/557 §move-clearance — TEXT/MTEXT footprint via το attachment/rotation/multi-line-aware
  // `textBoxCornersWorld` SSoT. Regression: πριν, το generic `getEntityBounds` γνώριζε ΜΟΝΟ 'text'
  // κι επέστρεφε null για 'mtext' → ένα κινούμενο MTEXT δεν έδειχνε ΚΑΜΙΑ κυανή clearance dim.
  it('TEXT (μία γραμμή) → box footprint (4 finite corners)', () => {
    const text = { id: 't1', type: 'text', position: { x: 0, y: 0 }, height: 10, text: 'ABC' };
    const fp = resolveEntityFootprintForDims(text as unknown as Entity);
    expect(fp).toHaveLength(4);
    for (const p of fp!) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('MTEXT (πολλαπλών γραμμών) → box footprint (4 finite corners) — ΤΟ BUG', () => {
    const mtext = {
      id: 'm1', type: 'mtext', position: { x: 5, y: 5 }, height: 8, width: 60, text: 'ΓΡΑΜΜΗ 1\nΓΡΑΜΜΗ 2',
    };
    const fp = resolveEntityFootprintForDims(mtext as unknown as Entity);
    expect(fp).toHaveLength(4);
    for (const p of fp!) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('TEXT/MTEXT χωρίς position → undefined (finite-guard fall-through)', () => {
    expect(resolveEntityFootprintForDims({ id: 't2', type: 'text' } as unknown as Entity)).toBeUndefined();
    expect(resolveEntityFootprintForDims({ id: 'm2', type: 'mtext' } as unknown as Entity)).toBeUndefined();
  });

  // ADR-654 — raster image / entourage: rotation-aware 4-γωνο footprint (όχι AABB fallback που ΔΕΝ
  // γνωρίζει 'image'), ώστε η κινούμενη εικόνα να δείχνει κυανές clearance dims προς τους γείτονες.
  it('IMAGE → 4 world γωνίες του περιστρεφόμενου ορθογωνίου', () => {
    const img = { id: 'img1', type: 'image', position: { x: 10, y: 20 }, width: 100, height: 50, rotation: 0, url: 'x' };
    const fp = resolveEntityFootprintForDims(img as unknown as Entity);
    expect(fp).toHaveLength(4);
    // Κάτω-αριστερά (10,20) + κάτω-δεξιά (110,20) → η βάση του κουτιού (createRectangleVertices order).
    expect(fp!.some((p) => Math.abs(p.x - 10) < 1e-6 && Math.abs(p.y - 20) < 1e-6)).toBe(true);
    expect(fp!.some((p) => Math.abs(p.x - 110) < 1e-6 && Math.abs(p.y - 70) < 1e-6)).toBe(true);
  });

  it('IMAGE χωρίς width/height → undefined (fall-through)', () => {
    expect(resolveEntityFootprintForDims({ id: 'img2', type: 'image', position: { x: 0, y: 0 } } as unknown as Entity)).toBeUndefined();
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
