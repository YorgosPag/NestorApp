/**
 * ADR-458 — `applyBeamColumnCutback2D` scene post-pass tests.
 *
 * Επαληθεύει: identity fast-path (χωρίς κολόνες/δοκάρια → ίδιο reference)· τεμνόμενο
 * δοκάρι → `geometry.displayOutline`· μη-τεμνόμενο → χωρίς displayOutline (by-ref).
 */

import { applyBeamColumnCutback2D } from '../dxf-scene-beam-cutback';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

function beam(): DxfEntityUnion {
  return {
    id: 'beam-1',
    type: 'beam',
    geometry: {
      outline: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 1000, y: 0, z: 0 },
          { x: 1000, y: 250, z: 0 },
          { x: 0, y: 250, z: 0 },
        ],
      },
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

type WithDisplay = DxfEntityUnion & { geometry?: { displayOutline?: unknown } };

describe('applyBeamColumnCutback2D (ADR-458)', () => {
  it('χωρίς κολόνες → ίδιο reference (zero-cost)', () => {
    const input = [beam()];
    expect(applyBeamColumnCutback2D(input)).toBe(input);
  });

  it('χωρίς δοκάρια → ίδιο reference', () => {
    const input = [column(0, 0, 100)];
    expect(applyBeamColumnCutback2D(input)).toBe(input);
  });

  it('κολόνα που τέμνει → δοκάρι αποκτά displayOutline (κομμένο)', () => {
    const b = beam();
    // Κολόνα στη ΝΔ γωνία (καλύπτει x∈[0,100], y∈[0,100]).
    const out = applyBeamColumnCutback2D([b, column(0, 0, 100)]);
    const outBeam = out.find((e) => e.id === 'beam-1') as WithDisplay;
    expect(outBeam).not.toBe(b); // νέο object (trimmed)
    expect(outBeam.geometry?.displayOutline).toBeDefined();
    expect(Array.isArray(outBeam.geometry?.displayOutline)).toBe(true);
    expect((outBeam.geometry?.displayOutline as unknown[]).length).toBe(1);
  });

  it('κολόνα που ΔΕΝ τέμνει → δοκάρι χωρίς displayOutline (by-ref)', () => {
    const b = beam();
    const out = applyBeamColumnCutback2D([b, column(5000, 5000, 100)]);
    const outBeam = out.find((e) => e.id === 'beam-1') as WithDisplay;
    expect(outBeam).toBe(b); // αμετάβλητο reference
    expect(outBeam.geometry?.displayOutline).toBeUndefined();
  });
});
