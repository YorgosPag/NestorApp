/**
 * ADR-441 Slice GEN-SLAB — `slab-grid-commit` orchestrator tests.
 *
 * MAT: κενή σκηνή με footprint → 1 εδαφόπλακα· re-run → up-to-date (υπάρχει ήδη
 * foundation slab). FLOOR bays: κενή → all create· re-run → up-to-date· partial →
 * μόνο τα missing φατνώματα. Idempotent key = `bayKeyFromBindings` (coordinate-free).
 */

import {
  commitFoundationMatFromGuides,
  commitSlabBaysFromGuides,
} from '../slab-grid-commit';
import { buildFoundationMatSlabs, buildSlabBaysFromGuides } from '../slab-from-grid';
import { type AxisGuideReader } from '../../foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';
import type { WallForEnvelope } from '../../geometry/envelope-perimeter';
import type { Point3D } from '../../types/bim-base';
import type { WallParams } from '../../types/wall-types';
import type { ICommand } from '../../../core/commands/interfaces';
import type { SceneModel } from '../../../types/scene';
import type { Entity } from '../../../types/entities';

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({
    id, axis, offset, visible: true, label: null, style: null,
    locked: false, createdAt: '', parentId: null, groupId: null,
  } as Guide);

function reader(guides: readonly Guide[]): AxisGuideReader {
  return { getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis) };
}

function wall(id: string, start: Point3D, end: Point3D): WallForEnvelope & { type: 'wall' } {
  const params: WallParams = {
    category: 'exterior', start, end, height: 3000, thickness: 200, flip: false,
    sceneUnits: 'mm', baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
    baseOffset: 0, topOffset: 0,
  };
  // `type:'wall'` ώστε ο `isWallEntity` της σκηνής να τα αναγνωρίζει (commit reads scene).
  return { id, kind: 'straight', params, type: 'wall' };
}

function square(ox: number, oy: number, size: number): Array<WallForEnvelope & { type: 'wall' }> {
  const q = (x: number, y: number): Point3D => ({ x: ox + x, y: oy + y, z: 0 });
  return [
    wall('w1', q(0, 0), q(size, 0)), wall('w2', q(size, 0), q(size, size)),
    wall('w3', q(size, size), q(0, size)), wall('w4', q(0, size), q(0, 0)),
  ];
}

const emptyScene = (): SceneModel =>
  ({ entities: [], layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } }, units: 'mm' } as SceneModel);

const sceneWith = (entities: readonly Entity[]): SceneModel =>
  ({ ...emptyScene(), entities: entities as Entity[] });

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];
const X2Y2 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];

describe('commitFoundationMatFromGuides — idempotent (εδαφόπλακα)', () => {
  it('κενή σκηνή με τοίχους → 1 εδαφόπλακα σε ΕΝΑ command', () => {
    const scene = sceneWith(square(0, 0, 8000) as unknown as Entity[]);
    const executed: ICommand[] = [];
    const result = commitFoundationMatFromGuides({
      getLevelScene: () => scene, setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm', executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(1);
    expect(executed).toHaveLength(1);
  });

  it('re-run με υπάρχουσα εδαφόπλακα → up-to-date, 0 commands', () => {
    const mat = buildFoundationMatSlabs(square(0, 0, 8000), [], [], {}, '0', 'mm');
    const scene = sceneWith([...(square(0, 0, 8000) as unknown as Entity[]), ...(mat.slabs as unknown as Entity[])]);
    const executed: ICommand[] = [];
    const result = commitFoundationMatFromGuides({
      getLevelScene: () => scene, setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm', executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('up-to-date');
    expect(executed).toHaveLength(0);
  });

  it('κενός όροφος (μηδέν δομικά) → no-footprint', () => {
    const result = commitFoundationMatFromGuides({
      getLevelScene: () => emptyScene(), setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm', executeCommand: () => {},
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-footprint');
  });
});

describe('commitSlabBaysFromGuides — idempotent (δάπεδα)', () => {
  it('κενή σκηνή 3×3 → 4 δάπεδα σε ΕΝΑ command', () => {
    const executed: ICommand[] = [];
    const result = commitSlabBaysFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => emptyScene(), setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm', executeCommand: (c) => executed.push(c),
    }, 'floor');
    expect(result.ok).toBe(true);
    expect(result.created).toBe(4);
    expect(executed).toHaveLength(1);
  });

  it('re-run ίδιος κάναβος → up-to-date (4 skipped, 0 commands)', () => {
    const built = buildSlabBaysFromGuides(reader([...X3, ...Y3]), [], [], { kind: 'floor' }, '0', 'mm');
    const scene = sceneWith(built.slabs as unknown as Entity[]);
    const executed: ICommand[] = [];
    const result = commitSlabBaysFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene, setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm', executeCommand: (c) => executed.push(c),
    }, 'floor');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('up-to-date');
    expect(result.skipped).toBe(4);
    expect(executed).toHaveLength(0);
  });

  it('partial: υπάρχει 2×2 (1 φάτνωμα) → 3×3 δημιουργεί μόνο τα 3 missing', () => {
    const built = buildSlabBaysFromGuides(reader(X2Y2), [], [], { kind: 'floor' }, '0', 'mm');
    const scene = sceneWith(built.slabs as unknown as Entity[]);
    const executed: ICommand[] = [];
    const result = commitSlabBaysFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene, setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm', executeCommand: (c) => executed.push(c),
    }, 'floor');
    expect(result.created).toBe(3);
    expect(result.skipped).toBe(1);
  });

  it('roof & floor συνυπάρχουν στο ίδιο φάτνωμα (διαφορετικό kind → όχι skip)', () => {
    const floors = buildSlabBaysFromGuides(reader([...X3, ...Y3]), [], [], { kind: 'floor' }, '0', 'mm');
    const scene = sceneWith(floors.slabs as unknown as Entity[]);
    const result = commitSlabBaysFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene, setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm', executeCommand: () => {},
    }, 'roof');
    expect(result.ok).toBe(true);
    expect(result.created).toBe(4); // οροφές δημιουργούνται παρά τα υπάρχοντα δάπεδα
  });

  it('χωρίς guideReader → insufficient-guides', () => {
    const result = commitSlabBaysFromGuides({
      getLevelScene: () => emptyScene(), setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm', executeCommand: () => {},
    }, 'floor');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
  });
});
