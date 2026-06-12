/**
 * ADR-441 Slice GEN-BEAM — `commitBeamGridFromGuides` orchestrator tests.
 *
 * Verifies idempotent create: κενή σκηνή → all create (1 command)· re-run ίδιος
 * κάναβος → no-op (`up-to-date`, 0 commands, όλα skipped)· partial (μερικά segments
 * ήδη υπάρχουν) → create μόνο των missing· no-dispatch όταν λείπουν άξονες. Idempotent
 * key = `segmentKeyFromBindings` (coordinate-free) → direction-agnostic skip.
 */

import { commitBeamGridFromGuides } from '../beam-grid-commit';
import { buildBeamGridFromGuides } from '../beam-from-grid';
import { type AxisGuideReader } from '../../foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';
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

const emptyScene = (): SceneModel =>
  ({ entities: [], layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } }, units: 'mm' } as SceneModel);

/** Σκηνή με τις δοκούς ενός build (ίδια start/end bindings → ίδιο segment key). */
const sceneWith = (guides: readonly Guide[]): SceneModel => {
  const built = buildBeamGridFromGuides(reader(guides), {}, '0', 'mm');
  return { ...emptyScene(), entities: built.beams as unknown as Entity[] };
};

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];
const X2Y2 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];

describe('commitBeamGridFromGuides — idempotent create', () => {
  it('κενή σκηνή 3×3 → all create (12) σε ΕΝΑ command', () => {
    const executed: ICommand[] = [];
    const result = commitBeamGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => emptyScene(),
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(12);
    expect(result.skipped).toBe(0);
    expect(executed).toHaveLength(1);
    expect(executed[0].getAffectedEntityIds()).toHaveLength(12);
  });

  it('re-run ίδιος κάναβος → no-op (up-to-date, 0 commands, 12 skipped)', () => {
    const scene = sceneWith([...X3, ...Y3]);
    const executed: ICommand[] = [];
    const result = commitBeamGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('up-to-date');
    expect(result.skipped).toBe(12);
    expect(executed).toHaveLength(0);
  });

  it('partial: υπάρχει 2×2 (4 δοκοί) → πλήρες 3×3 δημιουργεί μόνο τις missing', () => {
    const scene = sceneWith(X2Y2);
    const executed: ICommand[] = [];
    const result = commitBeamGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    // 2×2 born-bound segments επιβιώνουν ως skipped· τα υπόλοιπα του 3×3 δημιουργούνται.
    expect(result.created).toBe(8);
    expect(result.skipped).toBe(4);
    expect(executed).toHaveLength(1);
  });

  it('λείπει διεύθυνση άξονα → insufficient-guides, μηδέν dispatch', () => {
    const executed: ICommand[] = [];
    const result = commitBeamGridFromGuides({
      guideReader: reader([guide('x0', 'X', 0), ...Y3]),
      getLevelScene: () => emptyScene(),
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
    expect(executed).toHaveLength(0);
  });
});
