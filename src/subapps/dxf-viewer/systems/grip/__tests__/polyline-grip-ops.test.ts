/**
 * ADR-510 Φ3c — `polyline-grip-ops` pure SSoT tests.
 *
 * `parsePolylineSegIndex` + `buildPolylineVertexOpCommand` map a tagged polyline
 * grip + menu op to the right undoable command (PolylineVertexCommand add/remove,
 * SetBulgeCommand arc/line) and execute it correctly through a mock scene manager.
 */
import {
  parsePolylineSegIndex,
  buildPolylineVertexOpCommand,
  DEFAULT_ARC_BULGE,
} from '../polyline-grip-ops';
import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import { createMockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';

interface TestPoly {
  id: string;
  type: 'polyline';
  vertices: Array<{ x: number; y: number }>;
  closed: boolean;
  bulges?: number[];
}

function makeSceneManager(poly: TestPoly): { sm: ISceneManager; poly: TestPoly } {
  // Seed the helper with the poly entity so getEntities/getEntity work by default.
  // Override getEntity and updateEntity to use the mutable `poly` reference directly
  // so that commands mutating via Object.assign are reflected in assertions.
  const sm = createMockSceneManager([poly as unknown as SceneEntity], {
    getEntity: (id: string) => (id === poly.id ? (poly as unknown as SceneEntity) : undefined),
    updateEntity: (id: string, updates: Partial<SceneEntity>) => {
      if (id === poly.id) Object.assign(poly, updates);
    },
  });
  return { sm, poly };
}

const square = (): TestPoly => ({
  id: 'p1',
  type: 'polyline',
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  closed: true,
  bulges: [0, 0, 0, 0],
});

const grip = (kind: UnifiedGripInfo['polylineGripKind']): UnifiedGripInfo => ({
  id: 'g', source: 'dxf', entityId: 'p1', gripIndex: 0, type: 'edge',
  position: { x: 5, y: 0 }, movesEntity: false, polylineGripKind: kind,
});

describe('parsePolylineSegIndex', () => {
  it('parses the trailing index of every polyline grip kind', () => {
    expect(parsePolylineSegIndex('polyline-vertex-3')).toBe(3);
    expect(parsePolylineSegIndex('polyline-segment-midpoint-0')).toBe(0);
    expect(parsePolylineSegIndex('polyline-arc-midpoint-2')).toBe(2);
  });
  it('returns null for absent / malformed kinds', () => {
    expect(parsePolylineSegIndex(undefined)).toBeNull();
    expect(parsePolylineSegIndex('polyline-vertex-x')).toBeNull();
  });
});

describe('DEFAULT_ARC_BULGE', () => {
  it('is a clean quarter-circle (tan 22.5° ≈ 0.4142)', () => {
    expect(DEFAULT_ARC_BULGE).toBeCloseTo(0.41421356, 6);
  });
});

describe('buildPolylineVertexOpCommand', () => {
  it('convert-to-arc on a vertex grip sets the outgoing segment to the default arc', () => {
    const { sm, poly } = makeSceneManager(square());
    const cmd = buildPolylineVertexOpCommand(grip('polyline-vertex-1'), 'convert-to-arc', sm);
    expect(cmd).not.toBeNull();
    cmd!.execute();
    expect(poly.bulges?.[1]).toBeCloseTo(DEFAULT_ARC_BULGE);
  });

  it('convert-to-line on an arc-midpoint grip zeroes the segment bulge', () => {
    const { sm, poly } = makeSceneManager({ ...square(), bulges: [0.5, 0, 0, 0] });
    const cmd = buildPolylineVertexOpCommand(grip('polyline-arc-midpoint-0'), 'convert-to-line', sm);
    cmd!.execute();
    expect(poly.bulges?.[0]).toBe(0);
  });

  it('add-vertex inserts a vertex at the segment chord midpoint', () => {
    const { sm, poly } = makeSceneManager(square());
    const cmd = buildPolylineVertexOpCommand(grip('polyline-segment-midpoint-0'), 'add-vertex', sm);
    cmd!.execute();
    expect(poly.vertices).toHaveLength(5);
    expect(poly.vertices[1]).toEqual({ x: 5, y: 0 });
  });

  it('remove-vertex removes the grip vertex', () => {
    const { sm, poly } = makeSceneManager(square());
    const cmd = buildPolylineVertexOpCommand(grip('polyline-vertex-1'), 'remove-vertex', sm);
    cmd!.execute();
    expect(poly.vertices).toHaveLength(3);
    expect(poly.vertices.find((v) => v.x === 10 && v.y === 0)).toBeUndefined();
  });

  it('returns null for a non-polyline entity', () => {
    const sm = {
      getEntity: () => ({ id: 'p1', type: 'circle' } as unknown as SceneEntity),
    } as unknown as ISceneManager;
    expect(buildPolylineVertexOpCommand(grip('polyline-vertex-0'), 'convert-to-arc', sm)).toBeNull();
  });
});
