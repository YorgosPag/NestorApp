/**
 * ADR-635 Φάση C — a POINT's $PDSIZE (when > 0, i.e. drawing units) must scale with the
 * canonical-mm import factor like any length; 0 / <0 (viewport-relative) stay untouched.
 */
import { scaleEntity } from '../scale-entity-transform';
import type { Entity } from '../../../types/entities';

function point(pdSize?: number): Entity {
  return {
    id: 'point_0', type: 'point', layerId: 'L1', visible: true,
    position: { x: 1, y: 2 }, pdMode: 34,
    ...(pdSize !== undefined ? { pdSize } : {}),
  } as unknown as Entity;
}

describe('scaleEntity — point $PDSIZE (ADR-635 Φάση C)', () => {
  const origin = { x: 0, y: 0 };

  it('κλιμακώνει position πάντα', () => {
    const out = scaleEntity(point(), origin, 1000, 1000) as { position: { x: number; y: number } };
    expect(out.position).toEqual({ x: 1000, y: 2000 });
  });

  it('pdSize > 0 → drawing units → κλιμακώνεται (|sx|)', () => {
    const out = scaleEntity(point(2.5), origin, 1000, 1000) as { pdSize?: number };
    expect(out.pdSize).toBe(2500);
  });

  it('pdSize = 0 (viewport-relative) → ΔΕΝ κλιμακώνεται', () => {
    const out = scaleEntity(point(0), origin, 1000, 1000) as { pdSize?: number };
    expect(out.pdSize).toBeUndefined();
  });
});
