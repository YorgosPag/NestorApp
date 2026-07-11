/**
 * ADR-640 SSoT — BLOCK instance expansion (render + snap + bounds), mirror of
 * systems/group/group-expander.ts and systems/array/array-expander.ts.
 *
 * A `BlockEntity` (DXF INSERT preserved as a first-class object, ADR-640) stores its member
 * geometry in BLOCK-LOCAL coordinates (base baked to origin at construction) plus a placement
 * transform (`position`/`scale`/`rotation`). Expansion re-materialises each member in WORLD
 * space by applying the SAME placement transform the legacy explode path used
 * (`applyBlockTransformGeometry`, the `p_world = pos + Rot·Scale·member` formula) — so a kept
 * block and a flattened INSERT land byte-identically.
 *
 * `placeBlockMembersWorld` is the pure placement core (keeps member ids); `expandBlockInstance`
 * re-tags every placed member with the parent block's `id` so hit-testing/selection resolve to
 * the container on click (the exact ArrayEntity/GroupEntity mechanism). `explodeBlockInstance`
 * (systems/block/block-instance.ts) reuses the same core with FRESH ids.
 *
 * NOTE: import flattens nested INSERTs into primitives (buildLocalBlockMembers → instantiateInsert),
 * so `block.entities` holds only primitive members — no nested-container recursion is needed here.
 *
 * Used by:
 *   - useDxfSceneConversion    → render block members in canvas
 *   - dxf-scene-builder bounds → import auto-fit (member bbox, ADR-640 Φ7)
 *   - systems/zoom bounds-entity → post-import zoom-extents / selection bounds
 */

import type { BlockEntity, Entity } from '../../types/entities';
import type { AnySceneEntity } from '../../types/scene';
import { applyBlockTransformGeometry } from '../../utils/dxf-block-expander';

const ORIGIN = { x: 0, y: 0 } as const;

/**
 * Place a block's local members into WORLD space (base already baked to origin at construction),
 * keeping each member's own id. Pure — reuses `applyBlockTransformGeometry` (scale→rotate→translate),
 * the single placement SSoT shared with the legacy explode path.
 */
export function placeBlockMembersWorld(block: BlockEntity): AnySceneEntity[] {
  const sx = block.scale?.x ?? 1;
  const sy = block.scale?.y ?? 1;
  const rot = block.rotation ?? 0;
  const pos = block.position ?? ORIGIN;
  const out: AnySceneEntity[] = [];
  for (const member of block.entities) {
    out.push(applyBlockTransformGeometry(member as AnySceneEntity, ORIGIN, sx, sy, rot, pos));
  }
  return out;
}

/**
 * Expand a BLOCK into rendered/snap-candidate items. Each placed member is re-tagged with the
 * block's `id` (so a click on ANY member selects the whole block — Figma/Revit/AutoCAD semantics),
 * mirroring `expandGroupEntity`. Returns [] for an empty block.
 */
export function expandBlockInstance(block: BlockEntity): Entity[] {
  if (!block.entities || block.entities.length === 0) return [];
  return placeBlockMembersWorld(block).map((item) => ({ ...item, id: block.id } as Entity));
}
