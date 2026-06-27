/**
 * ADR-539 Φ4b — shouldRenderFaced SSoT gate (faced multi-material prism ↔ legacy extrude).
 * TRUE when painted OR Polygon Mode active (cross-entity: every solid pickable per-face).
 */

import { shouldRenderFaced } from '../should-render-faced';
import { usePolygonMode3DStore } from '../../stores/PolygonMode3DStore';

afterEach(() => usePolygonMode3DStore.getState().reset());

describe('shouldRenderFaced', () => {
  it('is true for a painted solid (non-empty faceAppearance), Polygon Mode off', () => {
    expect(shouldRenderFaced({ top: { colorHex: '#123456' } })).toBe(true);
  });

  it('is false when unpainted and Polygon Mode is off (legacy path)', () => {
    expect(shouldRenderFaced(undefined)).toBe(false);
    expect(shouldRenderFaced({})).toBe(false); // empty map = not painted
  });

  it('is true for ANY solid while Polygon Mode is active (Φ4b cross-entity)', () => {
    usePolygonMode3DStore.getState().setActive(true, 'some-other-id');
    expect(shouldRenderFaced(undefined)).toBe(true);
    expect(shouldRenderFaced({})).toBe(true);
  });
});
