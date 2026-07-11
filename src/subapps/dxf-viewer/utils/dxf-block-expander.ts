/**
 * 🏢 ENTERPRISE: DXF INSERT → scene entity expansion (ADR-635 Φ2)
 *
 * Instantiates a block reference (INSERT) into concrete scene entities by applying the DXF
 * placement transform to the block definition's geometry:
 *
 *   p_world = insertPoint + Rot(angle) · Scale(sx,sy) · (p_block − basePoint)
 *
 * Reuses the per-entity transform SSoTs — NO new transform math here:
 *   - scaleEntity            (systems/scale/scale-entity-transform.ts, ADR-348)
 *   - rotateEntity           (utils/rotation-math.ts)
 *   - translateEntityByAnchor(systems/stretch/stretch-entity-transform.ts)
 *
 * @see dxf-block-parser.ts - BLOCKS section → BlockDefMap
 */

import type { AnySceneEntity } from '../types/scene';
import type { Entity } from '../types/entities';
import type { Point2D } from '../rendering/types/Types';
import type { EntityData } from './dxf-converter-helpers';
import type { DxfHeaderData, DimStyleMap } from './dxf-parser-types';
import type { BlockDefMap } from './dxf-block-parser';
import { convertEntityToScene } from './dxf-entity-converters';
import { scaleEntity } from '../systems/scale/scale-entity-transform';
import { rotateEntity } from './rotation-math';
import { translateEntityByAnchor } from '../systems/stretch/stretch-entity-transform';

/** Guard against pathological / cyclic block nesting. */
const MAX_DEPTH = 16;

/** Conversion + id context threaded through (possibly nested) INSERT expansion. */
export interface ExpandContext {
  header?: DxfHeaderData;
  dimStyles?: DimStyleMap;
  /** Monotonic id source shared across the whole scene so cloned entities stay unique. */
  idSeq: { n: number };
}

function numOr(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function intOr(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Apply an INSERT's transform to one already-converted block entity, returning a fresh clone.
 * Composition order (each SSoT contributes a Partial that is merged): scale about base →
 * rotate about base → translate by (placement − base). BYBLOCK layer ('0') inherits the INSERT layer.
 */
function transformBlockEntity(
  entity: AnySceneEntity,
  base: Point2D,
  sx: number,
  sy: number,
  angleDeg: number,
  placement: Point2D,
  insertLayer: string,
  idSeq: { n: number }
): AnySceneEntity {
  const scaled = scaleEntity(entity as unknown as Entity, base, sx, sy);
  const e1 = { ...entity, ...scaled };
  const rotated = rotateEntity(e1 as unknown as Entity, base, angleDeg);
  const e2 = { ...e1, ...rotated };
  const moved = translateEntityByAnchor(e2 as unknown as Entity, {
    x: placement.x - base.x,
    y: placement.y - base.y,
  });

  const layerId = (e2 as { layerId?: string }).layerId;
  const finalLayer = !layerId || layerId === '0' ? insertLayer : layerId;

  return {
    ...e2,
    ...moved,
    layerId: finalLayer,
    id: `${(entity as { id?: string }).id ?? 'blk'}_i${idSeq.n++}`,
  } as AnySceneEntity;
}

/**
 * Expand one INSERT entity into scene entities (recursively for nested INSERTs, with MINSERT
 * column/row array support). Returns [] for unknown block names or when the nesting guard trips.
 */
export function instantiateInsert(
  insert: EntityData,
  blockDefs: BlockDefMap,
  ctx: ExpandContext,
  depth = 0
): AnySceneEntity[] {
  if (depth > MAX_DEPTH) return [];

  const data = insert.data;
  const name = data['2'];
  const def = name ? blockDefs.get(name) : undefined;
  if (!def) return [];

  const insertPt: Point2D = { x: numOr(data['10'], 0), y: numOr(data['20'], 0) };
  const sx = numOr(data['41'], 1);
  const sy = numOr(data['42'], 1);
  const angle = numOr(data['50'], 0);
  const cols = Math.max(1, intOr(data['70'], 1));
  const rows = Math.max(1, intOr(data['71'], 1));
  const colSp = numOr(data['44'], 0);
  const rowSp = numOr(data['45'], 0);

  // 1) Block-local scene entities (nested INSERTs recurse; others convert once).
  const local: AnySceneEntity[] = [];
  for (const child of def.entities) {
    if (child.type === 'INSERT') {
      local.push(...instantiateInsert(child, blockDefs, ctx, depth + 1));
      continue;
    }
    const converted = convertEntityToScene(child, ctx.idSeq.n++, ctx.header, ctx.dimStyles);
    if (!converted) continue;
    for (const e of Array.isArray(converted) ? converted : [converted]) local.push(e);
  }

  // 2) Place each array cell; MINSERT spacing runs along the rotated X (cols) / Y (rows) axes.
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out: AnySceneEntity[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ax = c * colSp;
      const ay = r * rowSp;
      const placement: Point2D = {
        x: insertPt.x + ax * cos - ay * sin,
        y: insertPt.y + ax * sin + ay * cos,
      };
      for (const e of local) {
        out.push(transformBlockEntity(e, def.base, sx, sy, angle, placement, insert.layer, ctx.idSeq));
      }
    }
  }

  return out;
}
