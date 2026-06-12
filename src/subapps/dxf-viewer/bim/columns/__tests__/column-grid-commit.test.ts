/**
 * ADR-441 Slice GEN-COL — `commitColumnGridFromGuides` orchestrator tests.
 *
 * Verifies idempotent create: κενή σκηνή → all create (1 command)· re-run ίδιος
 * κάναβος → no-op (`up-to-date`, 0 commands, όλες skipped)· partial (μερικές ήδη
 * υπάρχουν) → create μόνο των missing· no-dispatch όταν λείπουν άξονες.
 */

import { commitColumnGridFromGuides } from '../column-grid-commit';
import { buildColumnGridFromGuides } from '../column-from-grid';
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

/** Σκηνή με τις κολώνες ενός build (ίδια center bindings → ίδιο key). */
const sceneWith = (guides: readonly Guide[]): SceneModel => {
  const built = buildColumnGridFromGuides(reader(guides), {}, '0', 'mm');
  return { ...emptyScene(), entities: built.columns as unknown as Entity[] };
};

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];

describe('commitColumnGridFromGuides — idempotent create', () => {
  it('κενή σκηνή 3×3 → all create (9) σε ΕΝΑ command', () => {
    const executed: ICommand[] = [];
    const result = commitColumnGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => emptyScene(),
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(9);
    expect(result.skipped).toBe(0);
    expect(executed).toHaveLength(1);
    expect(executed[0].getAffectedEntityIds()).toHaveLength(9);
  });

  it('re-run ίδιος κάναβος → no-op (up-to-date, 0 commands, 9 skipped)', () => {
    const scene = sceneWith([...X3, ...Y3]);
    const executed: ICommand[] = [];
    const result = commitColumnGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('up-to-date');
    expect(result.skipped).toBe(9);
    expect(executed).toHaveLength(0);
  });

  it('partial: υπάρχει 2×2 → προσθήκη 3ου άξονα κάθε διεύθυνσης δημιουργεί μόνο τις missing', () => {
    const X2Y2 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];
    const scene = sceneWith(X2Y2); // 4 υπάρχουσες κολώνες
    const executed: ICommand[] = [];
    const result = commitColumnGridFromGuides({
      guideReader: reader([...X3, ...Y3]), // πλήρες 3×3 = 9
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(5); // 9 - 4 ήδη υπάρχουσες
    expect(result.skipped).toBe(4);
    expect(executed).toHaveLength(1);
  });

  it('λείπει διεύθυνση άξονα → insufficient-guides, μηδέν dispatch', () => {
    const executed: ICommand[] = [];
    const result = commitColumnGridFromGuides({
      guideReader: reader([...X3]),
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
