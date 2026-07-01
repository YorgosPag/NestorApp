/**
 * ADR-363 §wall-rotate-ghost — `applyEntityPreview` wall rotation strips the stale
 * join trim (REGRESSION GUARD).
 *
 * Bug (Giorgio, στιγμιότυπο 142617): rotating a wall that is mitered to a neighbour
 * showed a DEFORMED ghost — the stored `startMiter`/`endMiter` (a corner cut computed
 * for the ORIGINAL placement) spun with the wall, so the ghost was non-rectangular.
 * The commit recomputes trims (`recomputeWallTrims`), so only the preview was wrong.
 *
 * Fix: the wall ghost strips miter/bevel before recomputing geometry → nominal
 * rectangular wall during the drag. This test builds a genuinely mitered wall (via the
 * SAME computeWallTrims SSoT as commit) and asserts the rotation ghost drops the trim.
 */
import { applyEntityPreview, type EntityPreviewTransform } from '../apply-entity-preview';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { computeWallTrims, applyTrimPatches } from '../../../bim/walls/wall-trims';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';

function makeWall(a: { x: number; y: number }, b: { x: number; y: number }, id: string): WallEntity {
  const params: WallParams = { ...buildDefaultWallParams(a, b), thickness: 200, dna: undefined };
  const r = buildWallEntity(params, '0', 'straight');
  if (!r.ok) throw new Error('fixture invalid: ' + r.hardErrors.join(', '));
  return { ...r.entity, id } as WallEntity;
}

/** Two walls meeting at a corner → the horizontal wall gains an endMiter. */
function makeMiteredWall(): WallEntity {
  const horizontal = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'wall_h');
  const vertical = makeWall({ x: 3000, y: 0 }, { x: 3000, y: 3000 }, 'wall_v');
  const trims = computeWallTrims([horizontal, vertical]);
  const patched = applyTrimPatches([horizontal, vertical], trims);
  const mitered = patched.find((e) => e.id === 'wall_h') as WallEntity;
  const hasMiter = mitered.params.startMiter !== undefined || mitered.params.endMiter !== undefined;
  if (!hasMiter) throw new Error('fixture did not produce a miter');
  return mitered;
}

describe('applyEntityPreview — wall rotation strips stale join trim (Επίπεδο 2 fix)', () => {
  it('rotation ghost drops startMiter/endMiter → nominal rectangular wall', () => {
    const wall = makeMiteredWall();
    // Sanity: the fixture really is mitered before the preview.
    expect(wall.params.startMiter !== undefined || wall.params.endMiter !== undefined).toBe(true);

    const preview: EntityPreviewTransform = {
      entityId: wall.id,
      gripIndex: 1,
      delta: { x: -100, y: 100 }, // 0° → 90° sweep about the pivot
      movesEntity: false,
      wallGripKind: 'wall-rotation',
      anchorPos: { x: 100, y: 0 },
      rotatePivot: { x: 0, y: 0 },
    };

    const ghost = applyEntityPreview(wall as unknown as DxfEntityUnion, preview) as unknown as WallEntity;

    expect(ghost).not.toBe(wall); // cloned
    expect(ghost.params.startMiter).toBeUndefined();
    expect(ghost.params.endMiter).toBeUndefined();
    expect(ghost.params.startBevel).toBeUndefined();
    expect(ghost.params.endBevel).toBeUndefined();
    expect(ghost.geometry).toBeDefined();
  });
});
