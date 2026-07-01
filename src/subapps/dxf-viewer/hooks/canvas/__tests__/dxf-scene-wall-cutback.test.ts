/**
 * ADR-458 — `applyWallColumnCutback2D` scene post-pass tests. Αδελφό του beam test.
 *
 * Επαληθεύει: identity fast-path (χωρίς κολόνες/τοίχους → ίδιο reference)· τεμνόμενος
 * τοίχος → `geometry.displayFootprint`· μη-τεμνόμενος → χωρίς displayFootprint (by-ref).
 */

import { applyWallColumnCutback2D } from '../dxf-scene-wall-cutback';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

/** Οριζόντιος τοίχος: footprint x∈[0,1000], y∈[0,250] (outer y=250, inner y=0). */
function wall(): DxfEntityUnion {
  return {
    id: 'wall-1',
    type: 'wall',
    geometry: {
      outerEdge: { points: [{ x: 0, y: 250, z: 0 }, { x: 1000, y: 250, z: 0 }] },
      innerEdge: { points: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }] },
    },
  } as unknown as DxfEntityUnion;
}

function column(x: number, y: number, half: number): DxfEntityUnion {
  return {
    id: `col-${x}-${y}`,
    type: 'column',
    geometry: {
      footprint: {
        vertices: [
          { x: x - half, y: y - half, z: 0 },
          { x: x + half, y: y - half, z: 0 },
          { x: x + half, y: y + half, z: 0 },
          { x: x - half, y: y + half, z: 0 },
        ],
      },
    },
  } as unknown as DxfEntityUnion;
}

type WithDisplay = DxfEntityUnion & { geometry?: { displayFootprint?: unknown } };

describe('applyWallColumnCutback2D (ADR-458)', () => {
  it('χωρίς κολόνες → ίδιο reference (zero-cost)', () => {
    const input = [wall()];
    expect(applyWallColumnCutback2D(input)).toBe(input);
  });

  it('χωρίς τοίχους → ίδιο reference', () => {
    const input = [column(0, 0, 100)];
    expect(applyWallColumnCutback2D(input)).toBe(input);
  });

  it('κολόνα που τέμνει → τοίχος αποκτά displayFootprint (κομμένο)', () => {
    const w = wall();
    // Κολόνα ΝΔ γωνία (καλύπτει x∈[0,100], y∈[0,100] του footprint).
    const out = applyWallColumnCutback2D([w, column(0, 0, 100)]);
    const outWall = out.find((e) => e.id === 'wall-1') as WithDisplay;
    expect(outWall).not.toBe(w); // νέο object (κομμένο)
    expect(outWall.geometry?.displayFootprint).toBeDefined();
    expect(Array.isArray(outWall.geometry?.displayFootprint)).toBe(true);
    expect((outWall.geometry?.displayFootprint as unknown[]).length).toBe(1);
  });

  it('διαμπερής κολόνα στο μέσο → 2 κομμάτια (τοίχος «σπάει» οπτικά)', () => {
    const w = wall();
    // Κολόνα x∈[400,600] που καλύπτει όλο το πλάτος (y∈[−50,300]) → 2 κομμάτια.
    const out = applyWallColumnCutback2D([w, column(500, 125, 175)]);
    const outWall = out.find((e) => e.id === 'wall-1') as WithDisplay;
    expect((outWall.geometry?.displayFootprint as unknown[]).length).toBe(2);
  });

  it('κολόνα που ΔΕΝ τέμνει → τοίχος χωρίς displayFootprint (by-ref)', () => {
    const w = wall();
    const out = applyWallColumnCutback2D([w, column(5000, 5000, 100)]);
    const outWall = out.find((e) => e.id === 'wall-1') as WithDisplay;
    expect(outWall).toBe(w); // αμετάβλητο reference
    expect(outWall.geometry?.displayFootprint).toBeUndefined();
  });
});
