/**
 * ADR-513 §grip-parity — `resolveLineEndpointHotGrip` gate tests (the ONE decision point for
 * the plain-line endpoint → click-move-click hot-grip entry). DOM-free, pure.
 *
 * Asserts the strict gate: true ONLY for a PLAIN line endpoint grip (type 'vertex', not a
 * moving handle, no `lineGripKind`, grip index 0/1) on a `'line'` entity; false for the
 * rotation/move handles (they keep their role), non-line entities, the midpoint grip, edges,
 * overlay grips and null inputs. The Dynamic-Input toggle is checked by the CALLER, so it is
 * not part of this gate.
 */
import { resolveLineEndpointHotGrip } from '../line-endpoint-hotgrip';
import type { UnifiedGripInfo } from '../unified-grip-types';
import { LINE_ROTATION_KIND } from '../../../systems/line/line-grips';

function grip(over: Partial<UnifiedGripInfo>): UnifiedGripInfo {
  return {
    id: 'g', source: 'dxf', type: 'vertex', entityId: 'e1',
    position: { x: 100, y: 0 }, movesEntity: false, ...over,
  } as unknown as UnifiedGripInfo;
}

describe('resolveLineEndpointHotGrip (ADR-513 §grip-parity)', () => {
  it('line start endpoint (grip 0) → true', () => {
    expect(resolveLineEndpointHotGrip({ type: 'line' }, grip({ gripIndex: 0 }))).toBe(true);
  });

  it('line end endpoint (grip 1) → true', () => {
    expect(resolveLineEndpointHotGrip({ type: 'line' }, grip({ gripIndex: 1 }))).toBe(true);
  });

  it('the line midpoint / MOVE-cross grips (2/4) → false (not an endpoint)', () => {
    expect(resolveLineEndpointHotGrip({ type: 'line' }, grip({ gripIndex: 2 }))).toBe(false);
    expect(resolveLineEndpointHotGrip({ type: 'line' }, grip({ gripIndex: 4 }))).toBe(false);
  });

  it('a MOVING handle (movesEntity) → false (keeps its whole-entity translate role)', () => {
    expect(resolveLineEndpointHotGrip({ type: 'line' }, grip({ gripIndex: 1, movesEntity: true }))).toBe(false);
  });

  it('the rotation handle (already kinded) → false (keeps its rotate role)', () => {
    expect(
      resolveLineEndpointHotGrip({ type: 'line' }, grip({ gripIndex: 3, lineGripKind: LINE_ROTATION_KIND })),
    ).toBe(false);
  });

  it('an EDGE grip (not a vertex) → false', () => {
    expect(resolveLineEndpointHotGrip({ type: 'line' }, grip({ gripIndex: 1, type: 'edge' }))).toBe(false);
  });

  it('a non-line entity (arc / polyline / wall) → false (stays press-drag)', () => {
    expect(resolveLineEndpointHotGrip({ type: 'arc' }, grip({ gripIndex: 1 }))).toBe(false);
    expect(resolveLineEndpointHotGrip({ type: 'polyline' }, grip({ gripIndex: 0 }))).toBe(false);
    expect(resolveLineEndpointHotGrip({ type: 'wall' }, grip({ gripIndex: 1 }))).toBe(false);
  });

  it('an overlay-source grip → false (DXF primitives only)', () => {
    expect(resolveLineEndpointHotGrip({ type: 'line' }, grip({ gripIndex: 1, source: 'overlay' }))).toBe(false);
  });

  it('null / undefined entity or grip → false', () => {
    expect(resolveLineEndpointHotGrip(null, grip({ gripIndex: 1 }))).toBe(false);
    expect(resolveLineEndpointHotGrip({ type: 'line' }, null)).toBe(false);
    expect(resolveLineEndpointHotGrip(undefined, undefined)).toBe(false);
  });
});
