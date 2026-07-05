/**
 * ADR-575 — GROUP container transform recursion: MOVE / ROTATE / SCALE / MIRROR of
 * a group must transform every member via the shared per-primitive SSoT.
 */

import { createGroupEntity } from '../group-entity';
import { calculateMovedGeometry } from '../../../core/commands/entity-commands/move-entity-geometry';
import { rotateEntity } from '../../../utils/rotation-math';
import { scaleEntity } from '../../scale/scale-entity-transform';
import { mirrorEntity } from '../../../utils/mirror-math';
import type { Entity, GroupEntity } from '../../../types/entities';
import type { SceneEntity } from '../../../core/commands/interfaces';

const mkLine = (id: string, x0: number, y0: number, x1: number, y1: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

const grp = (): GroupEntity => createGroupEntity([mkLine('a', 0, 0, 1, 0), mkLine('b', 2, 2, 3, 2)]);

describe('ADR-575 — GROUP transform recursion', () => {
  it('MOVE translates every member', () => {
    const patch = calculateMovedGeometry(grp() as unknown as SceneEntity, { x: 10, y: 5, z: 0 });
    const members = (patch as unknown as { members: Entity[] }).members;
    const l0 = members[0] as unknown as { start: { x: number; y: number } };
    expect(l0.start).toEqual({ x: 10, y: 5 });
  });

  it('ROTATE 180° about origin flips every member', () => {
    const patch = rotateEntity(grp() as unknown as Entity, { x: 0, y: 0 }, 180);
    const members = (patch as unknown as { members: Entity[] }).members;
    const l0 = members[0] as unknown as { end: { x: number; y: number } };
    expect(l0.end.x).toBeCloseTo(-1, 6);
    expect(l0.end.y).toBeCloseTo(0, 6);
  });

  it('SCALE ×2 about origin scales every member', () => {
    const patch = scaleEntity(grp() as unknown as Entity, { x: 0, y: 0 }, 2, 2);
    const members = (patch as unknown as { members: Entity[] }).members;
    const l1 = members[1] as unknown as { start: { x: number; y: number } };
    expect(l1.start).toEqual({ x: 4, y: 4 });
  });

  it('MIRROR across the X axis flips every member vertically', () => {
    const xAxis = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };
    const patch = mirrorEntity(grp() as unknown as Entity, xAxis);
    const members = (patch as unknown as { members: Entity[] }).members;
    const l1 = members[1] as unknown as { start: { x: number; y: number } };
    expect(l1.start.x).toBeCloseTo(2, 6);
    expect(l1.start.y).toBeCloseTo(-2, 6);
  });
});
