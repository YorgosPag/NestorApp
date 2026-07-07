/**
 * ADR-575 §enter-group — conditional tagging of the ACTIVE drill-in group.
 *
 * The active group's DIRECT members keep their OWN id (in-place edit); every other
 * group (incl. a nested group inside the active one) stays tagged with its container
 * id (a click selects the whole group — one drill-in level at a time).
 */

import { expandGroupEntity } from '../group-expander';
import type { Entity, GroupEntity } from '../../../types/entities';

const mkLine = (id: string, x = 0): Entity =>
  ({ id, type: 'line', layerId: 'l', visible: true, start: { x, y: 0 }, end: { x: x + 1, y: 0 } } as unknown as Entity);

const mkGroup = (id: string, members: Entity[]): GroupEntity =>
  ({ id, type: 'group', layerId: 'l', visible: true, members } as unknown as GroupEntity);

describe('expandGroupEntity — active-group tagging (ADR-575)', () => {
  it('tags all members with the container id when NOT active', () => {
    const group = mkGroup('g1', [mkLine('a'), mkLine('b')]);
    const items = expandGroupEntity(group);
    expect(items.map((e) => e.id)).toEqual(['g1', 'g1']);
  });

  it('keeps DIRECT members own id when the group IS active', () => {
    const group = mkGroup('g1', [mkLine('a'), mkLine('b')]);
    const items = expandGroupEntity(group, undefined, 'g1');
    expect(items.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('a DIFFERENT active id leaves this group tagged', () => {
    const group = mkGroup('g1', [mkLine('a')]);
    expect(expandGroupEntity(group, undefined, 'other').map((e) => e.id)).toEqual(['g1']);
  });

  it('nested group inside the active one stays tagged with the nested container id', () => {
    const inner = mkGroup('g_inner', [mkLine('a'), mkLine('b')]);
    const outer = mkGroup('g_outer', [inner as unknown as Entity, mkLine('c')]);
    // Active = outer: its direct members keep own id → the nested group's leaves carry
    // the nested container id (g_inner), and the loose member keeps its own id (c).
    const items = expandGroupEntity(outer, undefined, 'g_outer');
    expect(items.map((e) => e.id).sort()).toEqual(['c', 'g_inner', 'g_inner']);
  });
});
