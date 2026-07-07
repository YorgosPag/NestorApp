/**
 * ADR-575 — unit tests for the GROUP selection-affordance bounds SSoT
 * (`computeGroupSelectionBounds` + `resolveSelectedGroups`).
 */

import { createGroupEntity } from '../group-entity';
import {
  computeGroupSelectionBounds,
  resolveSelectedGroups,
} from '../group-selection-bounds';
import type { Entity, GroupEntity } from '../../../types/entities';

const mkLine = (id: string, x0: number, y0: number, x1: number, y1: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

describe('computeGroupSelectionBounds (ADR-575)', () => {
  it('unions the members AABB, centre = midpoint, count = top-level members', () => {
    const group = createGroupEntity([mkLine('a', 0, 0, 1, 0), mkLine('b', 2, 2, 3, 2)]);
    const b = computeGroupSelectionBounds(group);
    expect(b).not.toBeNull();
    expect(b!.min).toEqual({ x: 0, y: 0 });
    expect(b!.max).toEqual({ x: 3, y: 2 });
    expect(b!.center).toEqual({ x: 1.5, y: 1 });
    expect(b!.memberCount).toBe(2);
  });

  it('returns null for an empty group', () => {
    const empty = { id: 'g_empty', type: 'group', layerId: 'l', visible: true, members: [] } as unknown as GroupEntity;
    expect(computeGroupSelectionBounds(empty)).toBeNull();
  });
});

describe('resolveSelectedGroups (ADR-575)', () => {
  it('returns only the selected GROUP containers', () => {
    const group = createGroupEntity([mkLine('a', 0, 0, 1, 0), mkLine('b', 2, 2, 3, 2)]);
    const loose = mkLine('loose', 5, 5, 6, 6);
    const entities: Entity[] = [group as unknown as Entity, loose];

    expect(resolveSelectedGroups(entities, [group.id])).toEqual([group]);
    // A non-group id selected → no groups.
    expect(resolveSelectedGroups(entities, ['loose'])).toEqual([]);
    // Empty selection / empty scene → empty.
    expect(resolveSelectedGroups(entities, [])).toEqual([]);
    expect(resolveSelectedGroups(undefined, [group.id])).toEqual([]);
  });
});
