/**
 * ADR-441 Slice 2 — `commitFoundationGridFromGuides` orchestrator tests.
 *
 * Verifies: build → ΕΝΑ atomic command dispatch (1 undo), σωστά counts, no-dispatch
 * όταν λείπουν άξονες, και ότι το command που εκτελείται φέρει ΟΛΑ τα strip ids.
 */

import { commitFoundationGridFromGuides } from '../foundation-grid-commit';
import type { AxisGuideReader } from '../foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';
import type { ICommand } from '../../../core/commands/interfaces';
import type { SceneModel } from '../../../types/scene';

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

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];

describe('commitFoundationGridFromGuides', () => {
  it('χτίζει + dispatch-άρει ΕΝΑ atomic command για 3×3 grid', () => {
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => emptyScene(),
      setLevelScene: () => {},
      levelId: '0',
      sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.built).toBe(12);
    expect(result.ignored).toBe(0);
    expect(executed).toHaveLength(1);
    expect(executed[0].getAffectedEntityIds()).toHaveLength(12);
  });

  it('δεν dispatch-άρει όταν λείπουν άξονες (<2 ανά διεύθυνση)', () => {
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader([guide('x0', 'X', 0)]),
      getLevelScene: () => emptyScene(),
      setLevelScene: () => {},
      levelId: '0',
      sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
    expect(executed).toHaveLength(0);
  });

  it('το εκτελεσμένο command προσθέτει ΟΛΑ τα strips στη σκηνή', () => {
    const scene = emptyScene();
    const result = commitFoundationGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: (_id, next) => { (scene as { entities: unknown[] }).entities = next.entities; },
      levelId: '0',
      sceneUnits: 'mm',
      executeCommand: (c) => c.execute(),
    });
    expect(result.ok).toBe(true);
    expect(scene.entities).toHaveLength(12);
    expect(scene.entities.every((e) => (e as { type?: string }).type === 'foundation')).toBe(true);
  });
});
