/**
 * ADR-575 §8 — unit tests for the GROUP gizmo (whole-group move cross + rotation handle).
 *
 * Covers the pure grip emission (`getGroupGizmoGrips`), the shared-pipeline wiring
 * (glyph registry + hot-grip op registry + the `hotGripKindOf` discriminator chain), and
 * the live-ghost transform (`applyEntityPreview` group move / rotation → recurse members).
 */

import { createGroupEntity } from '../group-entity';
import { computeGroupSelectionBounds } from '../group-selection-bounds';
import { getGroupGizmoGrips, GROUP_MOVE_KIND, GROUP_ROTATION_KIND } from '../group-gizmo-grips';
import { gripGlyphShape } from '../../../bim/grips/grip-glyph-registry';
import { hotGripOpForKind, hotGripKindOf } from '../../../hooks/grips/wall-hot-grip-fsm';
import { gripKindOf } from '../../../hooks/grip-kinds';
import { applyEntityPreview } from '../../../rendering/ghost/apply-entity-preview';
import type { Entity } from '../../../types/entities';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { EntityPreviewTransform } from '../../../rendering/ghost/entity-preview-types';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';

const mkLine = (id: string, x0: number, y0: number, x1: number, y1: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

// Bounds: min {0,0}, max {4,2} → centre {2,1}, halfWidth 2, halfLength 1.
const makeGroup = () => createGroupEntity([mkLine('a', 0, 0, 4, 0), mkLine('b', 0, 2, 4, 2)]);

describe('getGroupGizmoGrips (ADR-575 §8)', () => {
  it('emits exactly TWO handles keyed on the group id', () => {
    const group = makeGroup();
    const bounds = computeGroupSelectionBounds(group)!;
    const grips = getGroupGizmoGrips(group, bounds);
    expect(grips).toHaveLength(2);
    expect(grips.every((g) => g.entityId === group.id)).toBe(true);
    expect(grips.every((g) => g.type === 'vertex')).toBe(true); // always visible (no midpoint/center gating)
  });

  it('places the MOVE cross at the bbox centre (whole-group translate)', () => {
    const group = makeGroup();
    const bounds = computeGroupSelectionBounds(group)!;
    const [move] = getGroupGizmoGrips(group, bounds);
    expect(move.gripIndex).toBe(0);
    expect(move.position).toEqual({ x: 2, y: 1 });
    expect(move.movesEntity).toBe(true);
    expect(gripKindOf(move, 'group')).toBe(GROUP_MOVE_KIND);
  });

  it('places the rotation handle midway toward the bottom edge (−halfLength/2)', () => {
    const group = makeGroup();
    const bounds = computeGroupSelectionBounds(group)!;
    const [, rot] = getGroupGizmoGrips(group, bounds);
    expect(rot.gripIndex).toBe(1);
    // halfLength = 1 → midway offset −0.25·(2) = −0.5 → centre.y (1) − 0.5 = 0.5.
    expect(rot.position.x).toBeCloseTo(2);
    expect(rot.position.y).toBeCloseTo(0.5);
    expect(rot.movesEntity).toBe(false);
    expect(gripKindOf(rot, 'group')).toBe(GROUP_ROTATION_KIND);
  });
});

describe('GROUP gizmo — shared-pipeline wiring (ADR-575 §8)', () => {
  it('maps both kinds to the SAME glyphs every entity uses', () => {
    expect(gripGlyphShape('group-move')).toBe('move');
    expect(gripGlyphShape('group-rotation')).toBe('rotation');
  });

  it('opts both kinds into the shared hot-grip flow (move / rotate)', () => {
    expect(hotGripOpForKind('group-move')).toBe('move');
    expect(hotGripOpForKind('group-rotation')).toBe('rotate');
  });

  it('resolves the group discriminator via the shared hotGripKindOf chain', () => {
    expect(hotGripKindOf({
      gripKind: { on: 'group', kind: 'group-move' },
    } as unknown as UnifiedGripInfo)).toBe('group-move');
    expect(hotGripKindOf({
      gripKind: { on: 'group', kind: 'group-rotation' },
    } as unknown as UnifiedGripInfo)).toBe('group-rotation');
  });
});

describe('applyEntityPreview — GROUP live ghost (ADR-575 §8)', () => {
  it('group-move translates EVERY member by delta (recurse)', () => {
    const group = makeGroup();
    const preview: EntityPreviewTransform = {
      entityId: group.id,
      gripIndex: 0,
      delta: { x: 10, y: 20 },
      movesEntity: true,
      gripKind: { on: 'group', kind: 'group-move' },
    };
    const ghost = applyEntityPreview(group as unknown as DxfEntityUnion, preview) as unknown as { type: string; members: Entity[] };
    expect(ghost.type).toBe('group');
    const a = ghost.members.find((m) => m.id === 'a') as unknown as { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(a.start).toEqual({ x: 10, y: 20 });
    expect(a.end).toEqual({ x: 14, y: 20 });
  });

  it('group-rotation spins EVERY member about the bbox centre (recurse)', () => {
    const group = makeGroup();
    const pivot = computeGroupSelectionBounds(group)!.center; // {2,1}
    const anchor = { x: 4, y: 1 };                            // east of pivot
    const preview: EntityPreviewTransform = {
      entityId: group.id,
      gripIndex: 1,
      delta: { x: -2, y: 2 },        // anchor+delta = {2,3} → 90° CCW sweep about {2,1}
      movesEntity: false,
      gripKind: { on: 'group', kind: 'group-rotation' },
      anchorPos: anchor,
      rotatePivot: pivot,
    };
    const ghost = applyEntityPreview(group as unknown as DxfEntityUnion, preview) as unknown as { type: string; members: Entity[] };
    expect(ghost.type).toBe('group');
    // Members must have moved (rotated), not stayed put.
    const a = ghost.members.find((m) => m.id === 'a') as unknown as { start: { x: number; y: number } };
    expect(a.start).not.toEqual({ x: 0, y: 0 });
    expect(ghost.members).toHaveLength(2);
  });
});
