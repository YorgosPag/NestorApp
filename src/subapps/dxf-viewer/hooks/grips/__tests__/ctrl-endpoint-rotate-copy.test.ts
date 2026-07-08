/**
 * ADR-561 EXT — `resolveCtrlEndpointRotateCopy` gate tests (the ONE decision point for the
 * Ctrl + endpoint/vertex rotate-COPY hinge gesture). DOM-free, pure.
 *
 * Asserts the strict gate: fires ONLY with Ctrl held on a PLAIN vertex grip of a
 * line / arc / polyline (→ correct synthetic rotation kind + pivot = endpoint); returns
 * null without Ctrl (regression guard: endpoint stays a normal stretch) and for any
 * move/rotation handle (they keep their role).
 */
import { resolveCtrlEndpointRotateCopy } from '../ctrl-endpoint-rotate-copy';
import type { UnifiedGripInfo } from '../unified-grip-types';
import { gripKindOf } from '../../grip-kinds';
import { LINE_ROTATION_KIND } from '../../../systems/line/line-grips';
import { ARC_ROTATION_KIND } from '../../../systems/arc/arc-grips';
import { POLYLINE_ROTATION_KIND } from '../../../systems/polyline/polyline-grips';

function grip(over: Partial<UnifiedGripInfo>): UnifiedGripInfo {
  return {
    id: 'g', source: 'dxf', type: 'vertex', entityId: 'e1',
    position: { x: 100, y: 0 }, movesEntity: false, ...over,
  } as unknown as UnifiedGripInfo;
}

describe('resolveCtrlEndpointRotateCopy (ADR-561 EXT)', () => {
  it('line endpoint + Ctrl → pivot = endpoint + line-rotation synthetic kind', () => {
    const res = resolveCtrlEndpointRotateCopy({ type: 'line' }, grip({ gripIndex: 1 }), true);
    expect(res).not.toBeNull();
    expect(res!.pivot).toEqual({ x: 100, y: 0 });
    expect(gripKindOf(res!.syntheticGrip, 'line')).toBe(LINE_ROTATION_KIND);
  });

  it('arc endpoint + Ctrl → arc-rotation synthetic kind', () => {
    const res = resolveCtrlEndpointRotateCopy({ type: 'arc' }, grip({ gripIndex: 2 }), true);
    expect(gripKindOf(res!.syntheticGrip, 'arc')).toBe(ARC_ROTATION_KIND);
  });

  it('polyline vertex + Ctrl → polyline-rotation synthetic kind', () => {
    const res = resolveCtrlEndpointRotateCopy({ type: 'polyline' }, grip({ gripIndex: 0 }), true);
    expect(gripKindOf(res!.syntheticGrip, 'polyline')).toBe(POLYLINE_ROTATION_KIND);
  });

  it('scene rectangle vertex + Ctrl → polyline-rotation (rect shows polyline grips)', () => {
    const res = resolveCtrlEndpointRotateCopy({ type: 'rectangle' }, grip({ gripIndex: 0 }), true);
    expect(gripKindOf(res!.syntheticGrip, 'polyline')).toBe(POLYLINE_ROTATION_KIND);
  });

  it('WITHOUT Ctrl → null (endpoint stays a normal stretch — regression guard)', () => {
    expect(resolveCtrlEndpointRotateCopy({ type: 'line' }, grip({ gripIndex: 1 }), false)).toBeNull();
  });

  it('a MOVING handle (movesEntity) → null (keeps its whole-entity translate role)', () => {
    expect(resolveCtrlEndpointRotateCopy({ type: 'line' }, grip({ gripIndex: 4, movesEntity: true }), true)).toBeNull();
  });

  it('a rotation handle (already kinded) → null (keeps its role; its copy is at commit)', () => {
    expect(resolveCtrlEndpointRotateCopy({ type: 'line' }, grip({ gripIndex: 3, gripKind: { on: 'line', kind: LINE_ROTATION_KIND } }), true)).toBeNull();
    expect(resolveCtrlEndpointRotateCopy({ type: 'arc' }, grip({ gripIndex: 4, gripKind: { on: 'arc', kind: ARC_ROTATION_KIND } }), true)).toBeNull();
  });

  it('an EDGE grip (not a vertex) → null', () => {
    expect(resolveCtrlEndpointRotateCopy({ type: 'line' }, grip({ gripIndex: 2, type: 'edge' }), true)).toBeNull();
  });

  it('an unsupported entity type → null', () => {
    expect(resolveCtrlEndpointRotateCopy({ type: 'wall' }, grip({ gripIndex: 1 }), true)).toBeNull();
  });

  it('an overlay-source grip → null (DXF primitives only)', () => {
    expect(resolveCtrlEndpointRotateCopy({ type: 'line' }, grip({ gripIndex: 1, source: 'overlay' }), true)).toBeNull();
  });
});
