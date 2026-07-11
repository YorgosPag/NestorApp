/**
 * ADR-640 — BLOCK instance (pure SSoT): construct a first-class {@link BlockEntity} from a DXF
 * INSERT at import, and EXPLODE it back to loose world-space members on demand. Container-flavour
 * sibling of GROUP (systems/group/group-entity.ts) — but INSERT-semantic (not identity): the block
 * stores its members in BLOCK-LOCAL coordinates plus a placement transform (`position`/`scale`/
 * `rotation`), so it round-trips to DXF INSERT with zero inverse math (ADR-640 Fork-2).
 *
 * Model (AutoCAD INSERT / block reference):
 *   - Members are built once (shared SSoT `buildLocalBlockMembers`) and baked to the block's
 *     base point → origin (translate by −base) so the stored geometry expands with base (0,0)
 *     and exports as a BLOCK whose base is (0,0). No `base` field needed on BlockEntity.
 *   - BYBLOCK layer inheritance ('0' → the INSERT's layer) mirrors the legacy explode path
 *     (`transformBlockEntity`) so a kept block and a flattened INSERT resolve layers identically.
 *   - EXPLODE ≡ place members in world space with FRESH ids (systems/explode delegates here),
 *     the container-flavour mirror of UNGROUP.
 *
 * FULL SSoT reuse — zero re-implemented geometry/ids:
 *   - buildLocalBlockMembers / applyBlockTransformGeometry → utils/dxf-block-expander.ts
 *   - placeBlockMembersWorld                               → systems/block/block-expander.ts
 *   - translateEntityByAnchor                              → systems/stretch/stretch-entity-transform.ts
 *   - generateEntityId → systems/entity-creation/utils · deepClone → utils/clone-utils
 *
 * @see systems/block/block-expander.ts (render/snap/bounds expansion, tags block.id)
 * @see systems/explode/explode-entity.ts (EXPLODE delegates the 'block' case here)
 */

import type { BlockEntity, Entity } from '../../types/entities';
import type { AnySceneEntity } from '../../types/scene';
import type { Point2D } from '../../rendering/types/Types';
import type { EntityData } from '../../utils/dxf-converter-helpers';
import { extractEntityColor } from '../../utils/dxf-converter-helpers';
import type { BlockDef, BlockDefMap } from '../../utils/dxf-block-parser';
import { buildLocalBlockMembers, type ExpandContext } from '../../utils/dxf-block-expander';
import { translateEntityByAnchor } from '../stretch/stretch-entity-transform';
import { placeBlockMembersWorld } from './block-expander';
import { generateEntityId } from '../entity-creation/utils';
import { deepClone } from '../../utils/clone-utils';

function numOr(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Build a first-class {@link BlockEntity} from a DXF INSERT + its block definition. Returns `null`
 * when the block has no renderable members (caller falls back to the legacy flatten path).
 *
 * The member set is IDENTICAL to what {@link buildLocalBlockMembers} feeds the explode path; here
 * we additionally (a) inherit the INSERT's layer for BYBLOCK ('0') members and (b) bake the block
 * base to the origin — after which the stored `entities` expand via the standard placement transform.
 */
export function createBlockInstance(
  name: string,
  def: BlockDef,
  insert: EntityData,
  blockDefs: BlockDefMap,
  ctx: ExpandContext,
): BlockEntity | null {
  const insertColor = extractEntityColor(insert.data);
  const members = buildLocalBlockMembers(def, blockDefs, ctx, insertColor, 0, name);
  if (members.length === 0) return null;

  const insertLayer = insert.layer;
  const base = def.base ?? { x: 0, y: 0 };
  const negBase: Point2D = { x: -base.x, y: -base.y };

  // (a) BYBLOCK layer inheritance ('0'/empty → INSERT layer, mirror transformBlockEntity) +
  // (b) bake base → origin so members are stored relative to base (BLOCK base becomes (0,0)).
  const localMembers: AnySceneEntity[] = members.map((m) => {
    const layerId = (m as { layerId?: string }).layerId;
    const finalLayer = !layerId || layerId === '0' ? insertLayer : layerId;
    const baked = { ...m, ...translateEntityByAnchor(m as unknown as Entity, negBase) } as AnySceneEntity;
    return { ...baked, layerId: finalLayer } as AnySceneEntity;
  });

  const position: Point2D = { x: numOr(insert.data['10'], 0), y: numOr(insert.data['20'], 0) };
  const scale: Point2D = { x: numOr(insert.data['41'], 1), y: numOr(insert.data['42'], 1) };
  const rotation = numOr(insert.data['50'], 0);

  return {
    id: generateEntityId(),
    type: 'block',
    name,
    layerId: insertLayer,
    position,
    scale,
    rotation,
    entities: localMembers as Entity[],
    visible: true,
  } as BlockEntity;
}

/**
 * EXPLODE a block instance: place every member in WORLD space (reusing the render placement SSoT)
 * with FRESH ids, so the restored primitives are fully independent of the container's lifecycle —
 * the container-flavour mirror of {@link ungroupGroup}. Returns `null` for an empty block so
 * EXPLODE can no-op + hint.
 */
export function explodeBlockInstance(block: BlockEntity): Entity[] | null {
  if (!block.entities || block.entities.length === 0) return null;
  return placeBlockMembersWorld(block).map(
    (m) => ({ ...deepClone(m as unknown as Entity), id: generateEntityId(), selected: false } as Entity),
  );
}
