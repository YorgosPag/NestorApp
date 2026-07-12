/**
 * ADR-641 — Block Editor (BEDIT) VIEW transform (pure SSoT).
 *
 * WHY: a `BlockEntity` stores its members in the block DEFINITION's own coordinate space, which can
 * differ from the world drawing by the INSERT `scale` (a furniture block authored in metres inserted
 * into a mm drawing carries `scale ≈ 1000`) and can sit at an arbitrary authoring offset far from the
 * definition origin (geo-referenced blocks). Rendering `block.entities` verbatim (the old
 * `buildBlockEditScene`) therefore showed the sofa 1000× too small and ~18 km off-origin — the ruler
 * read «4 mm» for a 2 m couch.
 *
 * The big-player answer (Revit «Edit Family» / ArchiCAD in-place / Cinema 4D / Figma «edit component»)
 * is to edit the DEFINITION but present it at its REAL-WORLD size, framed around the origin. So the
 * Block Editor is a **transformed VIEW** of the canonical definition:
 *
 *   view(member) = Scale · (member − C)          // scale def→world magnitude, recenter on the origin
 *   def(view)    = C + Scale⁻¹ · view            // the exact inverse, applied on write-back
 *
 * where `Scale` is the instance's own `block.scale` and `C` is the definition's bounds-centre, FIXED at
 * enter time (never recomputed from the live — edited — members, or the view would drift under the
 * cursor mid-edit). The canonical `block.entities` stay untouched (def space) so multi-instance sync
 * (Φ5) and DXF INSERT round-trip are preserved; only the editor's VIEW is transformed, and every edit
 * is inverse-transformed back to def space before it is stored.
 *
 * FULL SSoT reuse — NO new geometry math: both directions are one call to
 * {@link applyBlockTransformGeometry} (`placement + Rot·Scale·(e − base)`), the SAME placement core the
 * INSERT expansion uses, so it already covers EVERY renderable type incl. `hatch.boundaryPaths`.
 */

import type { BlockEntity } from '../../types/entities';
import type { AnySceneEntity } from '../../types/scene';
import { applyBlockTransformGeometry } from '../../utils/dxf-block-expander';
import { computeEntityArrayBounds } from '../../utils/dxf-entity-array-bounds';

const ORIGIN = { x: 0, y: 0 } as const;

/**
 * The BEDIT view transform for one entered block: the instance's per-axis scale (`sx`/`sy`) + the
 * definition bounds-centre (`cx`/`cy`) captured at enter time. Reference-stable for the whole session.
 */
export interface BlockEditViewTransform {
  readonly sx: number;
  readonly sy: number;
  readonly cx: number;
  readonly cy: number;
}

/**
 * Derive the view transform for `block` from its `scale` + the centre of its members' definition
 * bounds. Call ONCE at enter (the result is stored) so the recenter `C` is fixed for the session and
 * the view does not swim as members are edited. A zero/absent scale axis degrades to 1 (identity axis).
 */
export function computeBlockEditViewTransform(block: BlockEntity): BlockEditViewTransform {
  const sx = block.scale?.x || 1;
  const sy = block.scale?.y || 1;
  const b = computeEntityArrayBounds(block.entities as AnySceneEntity[]);
  // Degenerate/empty bounds (createInfinityBounds untouched) → centre on origin (no recenter).
  const cx = Number.isFinite(b.min.x) && Number.isFinite(b.max.x) ? (b.min.x + b.max.x) / 2 : 0;
  const cy = Number.isFinite(b.min.y) && Number.isFinite(b.max.y) ? (b.min.y + b.max.y) / 2 : 0;
  return { sx, sy, cx, cy };
}

/** DEFINITION → VIEW: `Scale · (member − C)` (real-world magnitude, recentred on the origin). */
export function viewFromDef<T extends AnySceneEntity>(entity: T, t: BlockEditViewTransform): T {
  return applyBlockTransformGeometry(entity, { x: t.cx, y: t.cy }, t.sx, t.sy, 0, ORIGIN) as T;
}

/** VIEW → DEFINITION: `C + Scale⁻¹ · view` (the exact inverse of {@link viewFromDef}). */
export function defFromView<T extends AnySceneEntity>(entity: T, t: BlockEditViewTransform): T {
  return applyBlockTransformGeometry(entity, ORIGIN, 1 / t.sx, 1 / t.sy, 0, { x: t.cx, y: t.cy }) as T;
}
