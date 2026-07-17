/**
 * ADR-534 Φ3c-B3b — soffit top-clip του ΕΝΙΑΙΟΥ σοβά (silhouette) δοκαριού.
 * Όπου μονολιθική πλάκα καλύπτει τη δοκό, η κορυφή του σοβά κόβεται στο soffit (ίδια τιμή
 * με το ορατό στερεό/B3a) → δεν προεξέχει μέσα στην πλάκα. Absent clip → πλήρες ύψος.
 */

import { computeStructuralFinishSilhouette } from '../structural-finish-scene';
import type { SilhouetteBeamSource } from '../structural-finish-scene-silhouette';
import { createDefaultStructuralFinishSpec } from '../structural-finish-types';

/** Δοκός 6m×0.3m με ενεργό σοβά, κορυφή στα 3000mm, βάθος 500mm (soffit @ 2500). */
const beam: SilhouetteBeamSource = {
  id: 'b1',
  params: {
    finish: createDefaultStructuralFinishSpec(),
    sceneUnits: 'mm',
    topElevation: 3000,
    zOffset: 0,
    depth: 500,
  },
  geometry: {
    outline: {
      vertices: [
        { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 300 }, { x: 0, y: 300 },
      ],
    },
  },
};

const maxZTop = (bands: readonly { zTopMm: number }[]): number =>
  bands.reduce((m, b) => Math.max(m, b.zTopMm), -Infinity);

describe('computeStructuralFinishSilhouette — ADR-534 Φ3c-B3b soffit clip', () => {
  it('χωρίς clip → ο σοβάς φτάνει την πλήρη κορυφή της δοκού (3000mm)', () => {
    const bands = computeStructuralFinishSilhouette({ columns: [], beams: [beam], walls: [], floorElevationMm: 0 });
    expect(bands.length).toBeGreaterThan(0);
    expect(maxZTop(bands)).toBeCloseTo(3000, 6);
  });

  it('με beamTopClipById=2800 → ο σοβάς κόβεται στο soffit της πλάκας (2800mm)', () => {
    const clip = new Map<string, number>([['b1', 2800]]);
    const bands = computeStructuralFinishSilhouette({ columns: [], beams: [beam], walls: [], floorElevationMm: 0, beamTopClipById: clip });
    expect(bands.length).toBeGreaterThan(0);
    expect(maxZTop(bands)).toBeCloseTo(2800, 6);
  });

  it('clip για άλλο id → no-op (πλήρες ύψος, byte-for-byte)', () => {
    const clip = new Map<string, number>([['other', 2800]]);
    const bands = computeStructuralFinishSilhouette({ columns: [], beams: [beam], walls: [], floorElevationMm: 0, beamTopClipById: clip });
    expect(maxZTop(bands)).toBeCloseTo(3000, 6);
  });
});
