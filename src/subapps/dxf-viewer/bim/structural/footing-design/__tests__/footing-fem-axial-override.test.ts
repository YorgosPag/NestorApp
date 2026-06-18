/**
 * ADR-497 — FEM-authoritative axial override στο `buildPadFootingDesignInput`.
 *
 * Πιστοποιεί ότι, όταν δοθεί `femAxialOverride` (engaged FEM αντίδραση βάσης), το αξονικό
 * SLS/ULS του πεδίλου **υπερισχύει** του tributary `appliedLoad` (κρατώντας ροπές)· χωρίς
 * override → tributary seed (μηδέν regression)· override παρακάμπτει τον zero-load guard.
 */

import { buildPadFootingDesignInput } from '../footing-design-input';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import type { Entity } from '../../../../types/entities';

function padFooting(appliedLoad?: { deadAxialKn: number; liveAxialKn: number }): Entity {
  return {
    id: 'F1', type: 'foundation',
    params: {
      kind: 'pad', topElevationMm: -1000, thicknessMm: 400, width: 4000, length: 4000,
      position: { x: 0, y: 0, z: 0 },
      ...(appliedLoad ? { appliedLoad } : {}),
    },
    geometry: { volume: 6.4, footprint: { vertices: [] } },
  } as unknown as Entity;
}

const SOIL = 600;

describe('buildPadFootingDesignInput — femAxialOverride (ADR-497)', () => {
  it('χωρίς override → tributary appliedLoad (SLS = G+Q)', () => {
    const input = buildPadFootingDesignInput(
      padFooting({ deadAxialKn: 3000, liveAxialKn: 0 }), EUROCODE_PROVIDER, SOIL,
    );
    expect(input?.serviceLoad.axialKn).toBeCloseTo(3000, 6);
  });

  it('με override → FEM αξονικό υπερισχύει (SLS + ULS)', () => {
    const input = buildPadFootingDesignInput(
      padFooting({ deadAxialKn: 3000, liveAxialKn: 0 }), EUROCODE_PROVIDER, SOIL,
      undefined, { slsKn: 5000, ulsKn: 6750 },
    );
    expect(input?.serviceLoad.axialKn).toBe(5000); // ≠ 3000 tributary
    expect(input?.ulsLoad.axialKn).toBe(6750);
  });

  it('override παρακάμπτει τον zero-load guard (πέδιλο χωρίς tributary)', () => {
    const input = buildPadFootingDesignInput(
      padFooting(), EUROCODE_PROVIDER, SOIL, undefined, { slsKn: 4000, ulsKn: 5400 },
    );
    expect(input).not.toBeNull();
    expect(input?.serviceLoad.axialKn).toBe(4000);
  });

  it('χωρίς override + χωρίς φορτίο → null (αδρανές)', () => {
    expect(buildPadFootingDesignInput(padFooting(), EUROCODE_PROVIDER, SOIL)).toBeNull();
  });
});
