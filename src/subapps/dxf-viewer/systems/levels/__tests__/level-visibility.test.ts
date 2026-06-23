import {
  hasFloorLinkedLevel,
  isUnlinkedDefaultLevel,
  pickActiveLevel,
  selectVisibleLevels,
} from '../level-visibility';
import type { Level } from '../config';

function lvl(id: string, opts: Partial<Level> = {}): Level {
  return { id, name: id, order: 0, isDefault: false, visible: true, ...opts };
}

const orphanDefault = lvl('default', { isDefault: true }); // no floorId, no buildingId
const ground = lvl('ground', { floorId: 'flr-g', buildingId: 'b1' });
const foundation = lvl('foundation', { floorId: 'flr-f', buildingId: 'b1' });

describe('isUnlinkedDefaultLevel', () => {
  it('is true only for an isDefault level with no floorId and no buildingId', () => {
    expect(isUnlinkedDefaultLevel(orphanDefault)).toBe(true);
  });

  it('is false for floor-linked levels (even when isDefault)', () => {
    expect(isUnlinkedDefaultLevel(ground)).toBe(false);
    expect(isUnlinkedDefaultLevel(lvl('d2', { isDefault: true, floorId: 'flr-g' }))).toBe(false);
  });

  it('is false for a building-level default (has buildingId, no floorId)', () => {
    expect(isUnlinkedDefaultLevel(lvl('bld', { isDefault: true, buildingId: 'b1' }))).toBe(false);
  });

  it('is false for a non-default floorless extra level', () => {
    expect(isUnlinkedDefaultLevel(lvl('extra'))).toBe(false);
  });
});

describe('hasFloorLinkedLevel', () => {
  it('detects any floor-linked level', () => {
    expect(hasFloorLinkedLevel([orphanDefault, ground])).toBe(true);
  });
  it('is false when nothing is linked', () => {
    expect(hasFloorLinkedLevel([orphanDefault, lvl('extra')])).toBe(false);
    expect(hasFloorLinkedLevel([])).toBe(false);
  });
});

describe('selectVisibleLevels', () => {
  it('hides the unlinked default once a floor-linked level exists', () => {
    const out = selectVisibleLevels([orphanDefault, ground, foundation]).map((l) => l.id);
    expect(out).toEqual(['ground', 'foundation']);
  });

  it('keeps the default when there is no building structure yet', () => {
    const out = selectVisibleLevels([orphanDefault, lvl('extra')]).map((l) => l.id);
    expect(out).toEqual(['default', 'extra']);
  });

  it('never removes floor-linked levels and never mutates the input', () => {
    const input = [orphanDefault, ground];
    const snapshot = [...input];
    selectVisibleLevels(input);
    expect(input).toEqual(snapshot);
  });
});

describe('pickActiveLevel', () => {
  it('prefers a floor-linked level over the unlinked default', () => {
    expect(pickActiveLevel([orphanDefault, ground, foundation])?.id).toBe('ground');
  });

  it('returns the default when no structure exists', () => {
    expect(pickActiveLevel([orphanDefault, lvl('extra')])?.id).toBe('default');
  });

  it('prefers a floor-linked default among visible levels', () => {
    const linkedDefault = lvl('linked-default', { isDefault: true, floorId: 'flr-g', buildingId: 'b1' });
    expect(pickActiveLevel([orphanDefault, foundation, linkedDefault])?.id).toBe('linked-default');
  });

  it('is undefined for an empty list', () => {
    expect(pickActiveLevel([])).toBeUndefined();
  });
});
