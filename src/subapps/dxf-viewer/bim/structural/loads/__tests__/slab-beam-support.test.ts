/**
 * ADR-495 — `computeSlabBeamTributary`: spatial slab→δοκός εμβαδό ευθύνης (m²).
 *
 * Καλύπτει: πρόβολο (1 δοκός → 100%), αμφιέρειστη (2 δοκοί → 50/50), ασύμμετρη
 * κατά-μήκος κατανομή (διατήρηση φορτίου), μη-φέρουσα μακρινή δοκό, εκφυλισμένες
 * εισόδους (καμία πλάκα/δοκός, μηδενικό μήκος, μηδέν εμβαδό), partial along-overlap.
 *
 * Fixtures: canvas = mm (sceneUnits:'mm' → 1mm/unit) → /1000 = m.
 */

import { computeSlabBeamTributary } from '../slab-beam-support';
import type { Entity } from '../../../../types/entities';

/** Δοκός: άξονας startPoint→endPoint (mm). */
function beam(id: string, x0: number, y0: number, x1: number, y1: number): Entity {
  return {
    id, type: 'beam', kind: 'rectangular',
    params: {
      kind: 'rectangular', width: 250, sceneUnits: 'mm',
      startPoint: { x: x0, y: y0 }, endPoint: { x: x1, y: y1 },
    },
    geometry: { volume: 0.5 },
  } as unknown as Entity;
}

/** Πλάκα: ορθογώνιο outline (mm) + δοθέν εμβαδό (m²). */
function slab(
  id: string, x0: number, y0: number, x1: number, y1: number, areaM2: number,
): Entity {
  return {
    id, type: 'slab', kind: 'floor',
    params: {
      kind: 'floor', sceneUnits: 'mm',
      outline: { vertices: [
        { x: x0, y: y0, z: 0 }, { x: x1, y: y0, z: 0 },
        { x: x1, y: y1, z: 0 }, { x: x0, y: y1, z: 0 },
      ] },
    },
    geometry: { area: areaM2, netArea: areaM2 },
  } as unknown as Entity;
}

describe('computeSlabBeamTributary', () => {
  it('πρόβολος: πλάκα κολλημένη στη μία δοκό → 100% του εμβαδού', () => {
    // δοκός κατά X [0,5]m· πλάκα 5×2m ολόκληρη στο +Y, παρειά πάνω στον άξονα.
    const map = computeSlabBeamTributary([
      beam('b1', 0, 0, 5000, 0),
      slab('s1', 0, 0, 5000, 2000, 10),
    ]);
    expect(map.get('b1')).toBeCloseTo(10, 6);
    expect(map.size).toBe(1);
  });

  it('αμφιέρειστη: 2 παράλληλες δοκοί στα άκρα → 50/50', () => {
    const map = computeSlabBeamTributary([
      beam('b1', 0, 0, 5000, 0),
      beam('b2', 0, 3000, 5000, 3000),
      slab('s1', 0, 0, 5000, 3000, 15),
    ]);
    expect(map.get('b1')).toBeCloseTo(7.5, 6);
    expect(map.get('b2')).toBeCloseTo(7.5, 6);
  });

  it('ασύμμετρη κάλυψη: κατανομή κατά μήκος (διατήρηση εμβαδού)', () => {
    // b1 καλύπτει 5m, b2 μόνο 2.5m → 15 × 5/7.5 = 10 και 15 × 2.5/7.5 = 5.
    const map = computeSlabBeamTributary([
      beam('b1', 0, 0, 5000, 0),
      beam('b2', 0, 3000, 2500, 3000),
      slab('s1', 0, 0, 5000, 3000, 15),
    ]);
    expect(map.get('b1')).toBeCloseTo(10, 6);
    expect(map.get('b2')).toBeCloseTo(5, 6);
    // Διατήρηση: άθροισμα == συνολικό εμβαδό πλάκας.
    expect((map.get('b1') ?? 0) + (map.get('b2') ?? 0)).toBeCloseTo(15, 6);
  });

  it('μακρινή παράλληλη δοκός δεν είναι φέρουσα → καμία εγγραφή', () => {
    const map = computeSlabBeamTributary([
      beam('b1', 0, 0, 5000, 0),       // φέρουσα (παρειά πάνω της)
      beam('bFar', 0, 10000, 5000, 10000), // 8m μακριά από τη μακρινή παρειά
      slab('s1', 0, 0, 5000, 2000, 10),
    ]);
    expect(map.get('b1')).toBeCloseTo(10, 6);
    expect(map.has('bFar')).toBe(false);
  });

  it('partial along-overlap με μόνη δοκό → πλήρες εμβαδό (το εμβαδό = αλήθεια)', () => {
    // πλάκα μόνο στο μισό μήκος της δοκού· 1 φέρουσα → όλο το (μικρότερο) εμβαδό.
    const map = computeSlabBeamTributary([
      beam('b1', 0, 0, 5000, 0),
      slab('s1', 0, 0, 2500, 2000, 5),
    ]);
    expect(map.get('b1')).toBeCloseTo(5, 6);
  });

  it('καμία πλάκα → κενό map', () => {
    expect(computeSlabBeamTributary([beam('b1', 0, 0, 5000, 0)]).size).toBe(0);
  });

  it('καμία δοκός → κενό map', () => {
    expect(computeSlabBeamTributary([slab('s1', 0, 0, 5000, 2000, 10)]).size).toBe(0);
  });

  it('εκφυλισμένη δοκός (μηδενικό μήκος) αγνοείται', () => {
    const map = computeSlabBeamTributary([
      beam('b0', 1000, 1000, 1000, 1000),
      slab('s1', 0, 0, 5000, 2000, 10),
    ]);
    expect(map.size).toBe(0);
  });

  it('πλάκα χωρίς εμβαδό αγνοείται', () => {
    const map = computeSlabBeamTributary([
      beam('b1', 0, 0, 5000, 0),
      slab('s1', 0, 0, 5000, 2000, 0),
    ]);
    expect(map.size).toBe(0);
  });
});
