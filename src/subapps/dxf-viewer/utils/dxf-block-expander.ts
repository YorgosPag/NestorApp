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
import { extractEntityColor, isByBlockColor } from './dxf-converter-helpers';
import type { DxfHeaderData, DimStyleMap, StyleFontMap } from './dxf-parser-types';
import type { MlineStyleMap } from './dxf-mline-style-parser';
import type { BlockDefMap } from './dxf-block-parser';
import { convertEntityToScene } from './dxf-entity-converters';
import { scaleEntity } from '../systems/scale/scale-entity-transform';
import { rotateEntity } from './rotation-math';
import { translateEntityByAnchor } from '../systems/stretch/stretch-entity-transform';
import {
  recordClamp,
  recordError,
  type ImportDiagnostics,
  type ImportIssue,
} from './dxf-import-diagnostics';

/** Guard against pathological / cyclic block nesting. */
const MAX_DEPTH = 16;

/**
 * Bounds for INSERT expansion (ADR-635 Φ3). A malformed/huge MINSERT array or exponential
 * nested-block reference must NOT hang the parser or exhaust memory — like Revit, we cap and
 * report (never silently). Cells = one MINSERT array cell; the scene budget is the hard ceiling
 * on total expanded entities across ALL INSERTs (shared via ExpandContext.budget).
 */
const MAX_ARRAY_CELLS = 10_000;
export const DEFAULT_SCENE_ENTITY_BUDGET = 500_000;

/** Conversion + id context threaded through (possibly nested) INSERT expansion. */
export interface ExpandContext {
  header?: DxfHeaderData;
  dimStyles?: DimStyleMap;
  /** ADR-635 Φ C.5 — STYLE→font map so block-nested TEXT/MTEXT (group 7) resolve fonts too. */
  styleFonts?: StyleFontMap;
  /** ADR-635 Φ C.7 — MLINESTYLE map so block-nested MLINE (group 2/340) resolves its N elements. */
  mlineStyles?: MlineStyleMap;
  /** Monotonic id source shared across the whole scene so cloned entities stay unique. */
  idSeq: { n: number };
  /** Import diagnostics collector (skipped/error/clamp records). Optional for legacy callers. */
  diagnostics?: ImportDiagnostics;
  /** Shared entity budget across the whole scene's INSERT expansion. */
  budget?: { max: number; used: number };
}

function numOr(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function intOr(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Diagnostics recorders that no-op when the (optional) collector is absent. */
function clamp(ctx: ExpandContext, issue: ImportIssue): void {
  if (ctx.diagnostics) recordClamp(ctx.diagnostics, issue);
}
function noteError(ctx: ExpandContext, issue: ImportIssue): void {
  if (ctx.diagnostics) recordError(ctx.diagnostics, issue);
}

/**
 * Geometric core of the INSERT placement transform (the `p_world` formula, file header):
 * scale about base → rotate about base → translate by (placement − base). Each step reuses a
 * per-entity SSoT (scaleEntity / rotateEntity / translateEntityByAnchor) that already covers
 * EVERY renderable type incl. `hatch.boundaryPaths` — so this ONE composition places both the
 * exploded block members (via {@link transformBlockEntity}) AND a reconstructed associative
 * hatch (via {@link transformInsertHatch}) identically. NO id/layer bookkeeping here.
 */
function applyBlockTransformGeometry(
  entity: AnySceneEntity,
  base: Point2D,
  sx: number,
  sy: number,
  angleDeg: number,
  placement: Point2D,
): AnySceneEntity {
  const scaled = scaleEntity(entity as unknown as Entity, base, sx, sy);
  const e1 = { ...entity, ...scaled };
  const rotated = rotateEntity(e1 as unknown as Entity, base, angleDeg);
  const e2 = { ...e1, ...rotated };
  const moved = translateEntityByAnchor(e2 as unknown as Entity, {
    x: placement.x - base.x,
    y: placement.y - base.y,
  });
  return { ...e2, ...moved } as AnySceneEntity;
}

/**
 * Apply an INSERT's transform to one already-converted block entity, returning a fresh clone.
 * Reuses {@link applyBlockTransformGeometry} for the placement math; adds the block bookkeeping:
 * BYBLOCK layer ('0') inherits the INSERT layer, and a fresh unique `_i#` id per cloned member.
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
  const e2 = applyBlockTransformGeometry(entity, base, sx, sy, angleDeg, placement);

  const layerId = (e2 as { layerId?: string }).layerId;
  const finalLayer = !layerId || layerId === '0' ? insertLayer : layerId;

  return {
    ...e2,
    layerId: finalLayer,
    id: `${(entity as { id?: string }).id ?? 'blk'}_i${idSeq.n++}`,
  } as AnySceneEntity;
}

/**
 * ADR-635 Φ C.11 — place a reconstructed R12 associative-hatch (built by `tryConvertInsertHatch`
 * from the ACAD/HATCH XDATA boundary cache) into world space using the SAME INSERT block transform
 * the `*X#` explosion applies (`instantiateInsert` → {@link transformBlockEntity}).
 *
 * WHY: the R14_HATCH_DATA boundary cache is stored in the `*X#` block's LOCAL coordinate space
 * (relative to the block base). Skipping this transform left every imported hatch at raw
 * geo-referenced coords (~2.8e6) while its exploded siblings sat at the drawing's local origin —
 * hatches rendered 2.8M units off-screen AND Home/Shift+1 zoom-extents unioned local(0..70k) with
 * hatch(2.8e6) → over-zoom to a dot (KADOS.ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ, 2026-07-11). Reusing
 * `applyBlockTransformGeometry` makes the placed hatch BYTE-IDENTICAL to where the exploded pattern
 * lines would land (SSoT — never a second transform path). A hatch INSERT is a single placement
 * (no MINSERT array). Returns the hatch unchanged when the block def is absent (safe degradation).
 */
export function transformInsertHatch(
  hatch: AnySceneEntity,
  insert: EntityData,
  blockDefs: BlockDefMap,
): AnySceneEntity {
  const name = insert.data['2'];
  const def = name ? blockDefs.get(name) : undefined;
  if (!def) return hatch;
  const placement: Point2D = { x: numOr(insert.data['10'], 0), y: numOr(insert.data['20'], 0) };
  const sx = numOr(insert.data['41'], 1);
  const sy = numOr(insert.data['42'], 1);
  const angle = numOr(insert.data['50'], 0);
  return applyBlockTransformGeometry(hatch, def.base, sx, sy, angle, placement);
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
  if (depth > MAX_DEPTH) {
    clamp(ctx, {
      kind: 'INSERT',
      reason: `nesting depth > ${MAX_DEPTH} (possible cyclic block reference)`,
      at: insert.data['2'],
    });
    return [];
  }

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

  // BYBLOCK color source (ADR-635 Φ C.2): a child drawn with color BYBLOCK (62=0) inherits the
  // INSERT's explicit color, mirroring the BYBLOCK layer '0' rule. When the INSERT itself is
  // BYLAYER/undefined this stays undefined and the child falls through to layer resolution via
  // its inherited layerId (which becomes insertLayer) — matching AutoCAD's cascade.
  const insertColor = extractEntityColor(data);

  // 1) Block-local scene entities (nested INSERTs recurse; others convert once). Each child is
  // isolated: one malformed member entity is recorded and skipped, it does NOT kill the block.
  const local: AnySceneEntity[] = [];
  for (const child of def.entities) {
    try {
      // ADR-635 Φάση B Batch 2 — ATTDEF inside a BLOCK is an attribute *definition*
      // (template): AutoCAD replaces it with the INSERT's ATTRIB value at placement time,
      // never rendering the default per copy. Without this guard every INSERT would stamp
      // the stale default value/tag. (The real value arrives as a standalone ATTRIB in the
      // ENTITIES stream, converted independently.)
      if (child.type === 'ATTDEF') continue;
      if (child.type === 'INSERT') {
        local.push(...instantiateInsert(child, blockDefs, ctx, depth + 1));
        continue;
      }
      const converted = convertEntityToScene(child, ctx.idSeq.n++, ctx.header, ctx.dimStyles, ctx.styleFonts, ctx.mlineStyles);
      if (!converted) continue;
      const inheritColor = insertColor !== undefined && isByBlockColor(child.data);
      for (const e of Array.isArray(converted) ? converted : [converted]) {
        local.push(inheritColor ? ({ ...e, color: insertColor } as AnySceneEntity) : e);
      }
    } catch (err) {
      noteError(ctx, {
        kind: child.type || 'UNKNOWN',
        reason: errMessage(err),
        at: `block ${name ?? '?'}`,
      });
    }
  }

  // 2) Place each array cell; MINSERT spacing runs along the rotated X (cols) / Y (rows) axes.
  // Cell count and the scene-wide entity budget are bounded (ADR-635 Φ3) so a giant/malformed
  // MINSERT array or block explosion cannot hang the importer — we cap and report.
  const requestedCells = cols * rows;
  const cellBudget = Math.min(requestedCells, MAX_ARRAY_CELLS);
  if (requestedCells > MAX_ARRAY_CELLS) {
    clamp(ctx, {
      kind: 'MINSERT',
      reason: `array ${cols}×${rows}=${requestedCells} cells clamped to ${MAX_ARRAY_CELLS}`,
      at: name,
    });
  }

  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out: AnySceneEntity[] = [];
  let cells = 0;
  let budgetHit = false;

  arrayLoop: for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells >= cellBudget) break arrayLoop;
      cells++;
      const ax = c * colSp;
      const ay = r * rowSp;
      const placement: Point2D = {
        x: insertPt.x + ax * cos - ay * sin,
        y: insertPt.y + ax * sin + ay * cos,
      };
      for (const e of local) {
        if (ctx.budget && ctx.budget.used >= ctx.budget.max) {
          budgetHit = true;
          break arrayLoop;
        }
        out.push(transformBlockEntity(e, def.base, sx, sy, angle, placement, insert.layer, ctx.idSeq));
        if (ctx.budget) ctx.budget.used++;
      }
    }
  }

  if (budgetHit) {
    clamp(ctx, {
      kind: 'INSERT',
      reason: `scene entity budget (${ctx.budget?.max}) reached — expansion stopped`,
      at: name,
    });
  }

  return out;
}
