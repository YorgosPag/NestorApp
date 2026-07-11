/**
 * SSOT — apply-entity-preview
 *
 * Pure function that returns a cloned `DxfEntityUnion` with its geometry
 * transformed for a live drag preview (grip move/stretch, or wholesale
 * translation). Original entity is never mutated.
 *
 * This is the single source of truth for "what does the entity look like
 * during a drag" used by:
 *   - useMovePreview (toolbar Move tool, 2-click translation)
 *   - useGripGhostPreview (grip drag, center + vertex + edge)
 *
 * Extracted from `DxfRenderer.applyDragPreview` (ADR-040 Phase D, 2026-05-09)
 * which previously drew the preview inline in the main canvas. The unified
 * preview architecture moves all ghost rendering to the dedicated PreviewCanvas
 * overlay, keeping the bitmap cache invalidation-free during drag.
 * @see rendering/ghost/draw-ghost-entity — companion renderer
 * @see ADR-040 — Preview Canvas Performance (unified ghost preview)
 * @see ADR-049 — Move Tool / Grip Drag SSoT
 */

import type { Point2D } from '../types/Types';
// SSoT — canonical point translation (ADR-577 consolidation).
import { translatePoint } from '../entities/shared/geometry-vector-utils';
import type { DxfEntityUnion, DxfLine, DxfArc, DxfPolyline } from '../../canvas-v2/dxf-canvas/dxf-types';
// ADR-363 Slice F — plain DXF line rotation live ghost (shared axis-box rotate SSoT).
import { applyLineRotationDrag } from '../../systems/line/line-grips';
// ADR-561 — plain DXF arc + polyline/rectangle rotation live ghost: the ONE shared
// `rotateEntity`-delegating SSoT the commit (`RotateEntityCommand`) runs (preview ≡ commit
// by identity). polylineBboxCenter = the commit's per-polyline pivot fallback.
import { applyPrimitiveRotationDrag } from '../../hooks/grips/primitive-rotation-drag';
import { polylineBboxCenter } from '../../systems/polyline/rectangle-detect';
import type { Entity, GroupEntity } from '../../types/entities';
// ADR-575 §8 — GROUP gizmo live ghost: reuse the commit's whole-group transform SSoTs
// (rotate via `applyPrimitiveRotationDrag`→`rotateEntity`, move via `calculateMovedGeometry`)
// + the bbox-centre pivot fallback (the gizmo origin).
import { computeGroupSelectionBounds } from '../../systems/group/group-selection-bounds';
import { calculateMovedGeometry } from '../../core/commands/entity-commands/move-entity-geometry';
import type { SceneEntity } from '../../core/commands/interfaces';
import { applyTextGripDrag } from '../../bim/text/text-grips';
// ADR-583/612 — params-driven annotation live ghosts (scale-bar + opening-info-tag) extracted to
// apply-parametric-annotation-preview (N.7.1). Each routes through its commit-side grip-drag SSoT.
import { applyParametricAnnotationPreview } from './apply-parametric-annotation-preview';
// ADR-583 Φ3 — annotation-symbol corner UNIFORM-resize live ghost (the SAME pure SSoT the commit runs).
import { applyAnnotationSymbolGripDrag, isAnnotationSymbolCornerKind } from '../../bim/annotation-symbols/annotation-symbol-grips';
import type { AnnotationSymbolEntity } from '../../types/annotation-symbol';
// ADR-557 Φ-attachment — scene→DxfText projection SSoT (shared with the commit): resolves
// the raw entity's textNode height/text/style so the ghost box math ≡ the commit's.
import { projectSceneTextToDxf, type TextSceneShape } from '../../bim/text/project-scene-text';
// ADR-363 Phase 1G.5 — whole-entity translate SSoT (shared by the Alt move ghost + commit).
import { calculateBimMovedGeometry } from '../../bim/utils/bim-move-geometry';
import { applyStairGripDrag } from '../../bim/stairs/stair-grips';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { StairEntity } from '../../bim/types/stair-types';
import { applyWallGripDrag } from '../../bim/walls/wall-grips';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import type { WallEntity } from '../../bim/types/wall-types';
import { applySlabGripDrag } from '../../bim/slabs/slab-grips';
import { computeSlabGeometry } from '../../bim/geometry/slab-geometry';
import type { SlabEntity } from '../../bim/types/slab-types';
import { applySlabOpeningGripDrag } from '../../bim/slab-openings/slab-opening-grips';
import { computeSlabOpeningGeometry } from '../../bim/geometry/slab-opening-geometry';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { applyRoofGripDrag } from '../../bim/roofs/roof-grips';
import { computeRoofGeometry } from '../../bim/geometry/roof-geometry';
import type { RoofEntity } from '../../bim/types/roof-types';
import { applyFloorFinishGripDrag } from '../../bim/floor-finishes/floor-finish-grips';
import { computeFloorFinishGeometry, type FloorFinishEntity } from '../../bim/types/floor-finish-types';
import {
  applyHatchGripDrag, applyHatchOriginGripDrag, isHatchOriginGripKind, hatchBoundsCenter,
  isHatchAngleGripKind, hatchGradientAngleGripPos, applyHatchAngleGripDrag,
  isHatchMoveKind, isHatchRotationKind,
} from '../../bim/hatch/hatch-grips';
import { withGradientPatch, DEFAULT_GRADIENT_DEFAULTS } from '../../bim/hatch/hatch-gradient-build';
import type { HatchEntity } from '../../types/entities';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import type { EntityPreviewTransform, ApplyEntityPreviewContext } from './entity-preview-types';
import { gripKindOf } from '../../hooks/grip-kinds';
import { unwrapStair, applyClassicEntityPreview } from './apply-entity-preview-helpers';
import { applyParametricBoxPreview } from './apply-parametric-box-preview';
// ADR-615/363 — opening live ghosts (self-hosted + hosted Alt-move) extracted (N.7.1).
import { applyOpeningPreview } from './apply-opening-preview';

export type { EntityPreviewTransform, ApplyEntityPreviewContext };

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * ADR-186 / ADR-561 — normalize a RAW scene entity's discriminator for the drag-preview
 * pipeline. An `'lwpolyline'` (e.g. the result of joining two lines at an angle) is
 * geometrically a STANDARD polyline — same `{ vertices, closed, bulges }` shape — and the
 * committed canvas already renders it as one (`dxf-scene-entity-converter`: «LWPolyline →
 * render as standard polyline»). But this preview SSoT + the ghost model builder
 * (`buildEntityModelFromDxf`) are keyed on `'polyline'`, and preview callers pass the RAW
 * scene entity (`getEntity`), so a joined lwpolyline would match no branch → the ghost never
 * appears. Map the discriminator up-front (shallow clone, shape untouched) so it transforms +
 * renders EXACTLY like a polyline. The ONE place this preview-side mapping lives — shared by
 * every preview consumer (grip drag / body-drag / Move tool), so they can never diverge.
 */
export function normalizePreviewEntity(entity: DxfEntityUnion): DxfEntityUnion {
  return entity.type === 'lwpolyline'
    ? ({ ...(entity as object), type: 'polyline' } as DxfEntityUnion)
    : entity;
}

/**
 * ADR-561/583 — SHARED rotation live-ghost: spin `entity` about `pivot` via the SAME
 * `applyPrimitiveRotationDrag` → `rotateEntity` engine the commit runs (preview ≡
 * commit). `undefined` pivot (no gizmo centre) or a degenerate sweep → the entity
 * unchanged. The single source the arc / polyline / annotation-symbol / group rotation
 * ghost branches all delegate to (N.18 — jscpd flagged the inline twins).
 */
function rotationGhost(
  entity: DxfEntityUnion,
  anchorPos: Point2D,
  delta: Point2D,
  pivot: Point2D | undefined,
): DxfEntityUnion {
  if (!pivot) return entity;
  const currentPos: Point2D = translatePoint(anchorPos, delta);
  const patch = applyPrimitiveRotationDrag(entity as unknown as Entity, { anchor: anchorPos, currentPos, pivot });
  if (!patch) return entity;
  return { ...(entity as object), ...patch } as unknown as DxfEntityUnion;
}

/**
 * Apply a drag-preview transform to a DXF entity. Returns a cloned entity
 * with new geometry, or the original entity unchanged when:
 *  - `preview` is undefined / does not target this entity
 *  - `delta` is zero
 *  - the entity type is unsupported for the requested transform
 *
 * Pure: never mutates the input entity.
 */
export function applyEntityPreview(
  entity: DxfEntityUnion,
  preview: EntityPreviewTransform | undefined,
  ctx?: ApplyEntityPreviewContext,
): DxfEntityUnion {
  if (!preview || preview.entityId !== entity.id) return entity;
  const { delta, gripIndex, movesEntity, edgeVertexIndices, anchorPos, rotatePivot, landingId } = preview;
  // ADR-602 Stage 4 — read each discriminator via the tagged SSoT accessor (populated by
  // `toEntityPreviewTransform` beside the legacy fields). Same variable names + types keep
  // the per-entity dispatch below unchanged.
  const stairGripKind = gripKindOf(preview, 'stair');
  const wallGripKind = gripKindOf(preview, 'wall');
  const slabGripKind = gripKindOf(preview, 'slab');
  const slabOpeningGripKind = gripKindOf(preview, 'slab-opening');
  const roofGripKind = gripKindOf(preview, 'roof');
  const floorFinishGripKind = gripKindOf(preview, 'floor-finish');
  const hatchGripKind = gripKindOf(preview, 'hatch');
  const textGripKind = gripKindOf(preview, 'text');
  const lineGripKind = gripKindOf(preview, 'line');
  const arcGripKind = gripKindOf(preview, 'arc');
  const polylineGripKind = gripKindOf(preview, 'polyline');
  const groupGripKind = gripKindOf(preview, 'group');
  const annotationSymbolGripKind = gripKindOf(preview, 'annotation-symbol');
  if (delta.x === 0 && delta.y === 0) return entity;

  // ── ADR-583/612 — params-driven annotation live ghosts (scale-bar / opening-info-tag) ──
  // Extracted to apply-parametric-annotation-preview (N.7.1). Each routes through the SAME
  // grip-drag SSoT the commit runs → preview ≡ commit; returns null when not an annotation.
  const annotationPreview = applyParametricAnnotationPreview(entity, preview);
  if (annotationPreview) return annotationPreview;

  // ── ADR-363 Phase 1C — parametric wall live preview ───────────────────────
  if (wallGripKind && anchorPos && entity.type === 'wall') {
    const wall = entity as unknown as WallEntity;
    const currentPos: Point2D = translatePoint(anchorPos, delta);
    // ADR-363 Phase 1G — `rotatePivot` (set only for the wall-rotation 3-click
    // hot-grip) rotates the ghost around the picked centre instead of the midpoint.
    const newParams = applyWallGripDrag(wallGripKind, { originalParams: wall.params, delta, currentPos, ...(rotatePivot ? { pivot: rotatePivot } : {}) });
    if (newParams === wall.params) return entity;
    // Strip the stale join trim (miter/bevel) from the GHOST: the neighbour join was
    // computed for the wall's ORIGINAL placement, so while it is being rotated/moved/
    // reshaped that cut no longer applies — keeping it deforms the ghost (mitered corner
    // spun with the wall → non-rectangular). Show the nominal wall instead; the commit
    // recomputes trims (`recomputeWallTrims`), so the final result is correct. Same
    // strip pattern the commit-side recompute uses (add-wall-to-scene.ts).
    const { startMiter: _sm, endMiter: _em, startBevel: _sb, endBevel: _eb, ...nominalParams } = newParams;
    const previewParams = nominalParams as typeof newParams;
    const newGeometry = computeWallGeometry(previewParams, wall.kind);
    return { ...(entity as object), params: previewParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── Box-like parametric BIM entities (column / foundation / beam / MEP ─────
  // fixture / electrical panel / MEP manifold / MEP segment / furniture) ──────
  // Extracted to `apply-parametric-box-preview` (SOS N.7.1 — keep this file
  // under 500 lines). Each branch mirrors its commit path so the live ghost ≡
  // the committed result; the helper returns `null` when the preview targets
  // none of these kinds, so we fall through to the branches below.
  const boxPreview = applyParametricBoxPreview(entity, preview);
  if (boxPreview) return boxPreview;

  // ── ADR-363 Phase 3.5 — parametric slab live preview ──────────────────────
  // entity IS the raw SlabEntity from scene.entities — access .params directly
  // (not via a DxfSlab wrapper; mirrors beam pattern).
  if (slabGripKind && entity.type === 'slab') {
    const slab = entity as unknown as SlabEntity;
    const newParams = applySlabGripDrag(slabGripKind, { originalParams: slab.params, delta });
    if (newParams === slab.params) return entity;
    // ADR-550 — recompute geometry so the WYSIWYG preview (real renderer reads
    // `.geometry`) tracks the reshape; the simplified ghost reads params and ignores this.
    return { ...(entity as object), params: newParams, geometry: computeSlabGeometry(newParams) } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Phase 3.7a — parametric slab-opening live preview ─────────────
  if (slabOpeningGripKind && entity.type === 'slab-opening') {
    const so = entity as unknown as SlabOpeningEntity;
    const newParams = applySlabOpeningGripDrag(slabOpeningGripKind, { originalParams: so.params, delta });
    if (newParams === so.params) return entity;
    // ADR-550 — recompute geometry for the WYSIWYG preview (real renderer reads `.geometry`).
    return { ...(entity as object), params: newParams, geometry: computeSlabOpeningGeometry(newParams) } as unknown as DxfEntityUnion;
  }

  // ── ADR-417 Φ1-part-2 #2 — parametric roof live preview ───────────────────
  // entity IS the raw RoofEntity from scene.entities — access .params directly
  // (roof is a DIRECT entity, mirror slab/beam). Geometry is NOT recomputed here:
  // `draw-ghost-entity` paints the new footprint outline from params, so the
  // ghost follows the dragged vertex / inserted midpoint without the slope math.
  if (roofGripKind && entity.type === 'roof') {
    const roof = entity as unknown as RoofEntity;
    const newParams = applyRoofGripDrag(roofGripKind, { originalParams: roof.params, delta });
    if (newParams === roof.params) return entity;
    // ADR-550 — recompute geometry for the WYSIWYG preview (real renderer reads `.geometry`).
    // Roof uses a straight-skeleton solve → heavier per-frame; browser-verify perf.
    return { ...(entity as object), params: newParams, geometry: computeRoofGeometry(newParams) } as unknown as DxfEntityUnion;
  }

  // ── ADR-419 — parametric floor-finish live preview ─────────────────────────
  // entity IS the raw FloorFinishEntity from scene.entities (DIRECT entity,
  // mirrors roof). Geometry is NOT recomputed here — the ghost renderer paints
  // the new footprint polygon from params, so the preview follows the dragged
  // vertex / inserted edge-midpoint without the tile-pattern math.
  if (floorFinishGripKind && entity.type === 'floor-finish') {
    const finish = entity as unknown as FloorFinishEntity;
    const newParams = applyFloorFinishGripDrag(floorFinishGripKind, { originalParams: finish.params, delta });
    if (newParams === finish.params) return entity;
    // ADR-550 — recompute geometry for the WYSIWYG preview (real renderer reads `.geometry`).
    return { ...(entity as object), params: newParams, geometry: computeFloorFinishGeometry(newParams) } as unknown as DxfEntityUnion;
  }

  // ── ADR-507 — parametric hatch live preview ────────────────────────────────
  // entity IS the raw HatchEntity (DIRECT entity, boundaryPaths at top level).
  // The ghost renderer repaints the outline from the new ring without re-running
  // the fill-pattern math.
  if (hatchGripKind && entity.type === 'hatch') {
    const hatch = entity as unknown as HatchEntity;
    // ADR-627 — whole-hatch ROTATION live ghost: spin the boundaryPaths about the pivot via
    // the SAME `rotationGhost` → `applyPrimitiveRotationDrag` → `rotateEntity` case 'hatch'
    // the commit runs (preview ≡ commit by identity). Pivot = the picked hot-grip centre or
    // the boundary bbox centre — mirror of the polyline/area rotation ghost branch below.
    if (isHatchRotationKind(hatchGripKind) && anchorPos) {
      return rotationGhost(entity, anchorPos, delta, rotatePivot ?? hatchBoundsCenter(hatch.boundaryPaths) ?? undefined);
    }
    // ADR-627 — whole-hatch MOVE cross live ghost: translate every ring by `delta` via the
    // SAME `calculateMovedGeometry` case 'hatch' the commit runs (boundaryPaths + seed points).
    if (isHatchMoveKind(hatchGripKind)) {
      const patch = calculateMovedGeometry(entity as unknown as SceneEntity, delta);
      return { ...(entity as object), ...patch } as unknown as DxfEntityUnion;
    }
    // ADR-507 Φ5 A3 — gradient origin/seed grip: μετακινεί το patternOrigin, ΟΧΙ όριο.
    if (isHatchOriginGripKind(hatchGripKind)) {
      const current = hatch.patternOrigin ?? hatchBoundsCenter(hatch.boundaryPaths);
      if (!current) return entity;
      const patternOrigin = applyHatchOriginGripDrag(current, { delta });
      return { ...(entity as object), patternOrigin } as unknown as DxfEntityUnion;
    }
    // ADR-507 Φ5 A4 — gradient-angle βραχίονας: περιστρέφει το gradient.angleDeg (όχι όριο).
    // Η live γωνία = atan2(anchor+delta − origin)· anchor = θέση της λαβής (SSoT pos fn).
    if (isHatchAngleGripKind(hatchGripKind)) {
      const gradient = hatch.gradient;
      if (!gradient) return entity;
      const origin = hatch.patternOrigin ?? hatchBoundsCenter(hatch.boundaryPaths);
      if (!origin) return entity;
      const anchor = hatchGradientAngleGripPos(origin, gradient.angleDeg ?? 0, hatch.boundaryPaths);
      if (!anchor) return entity;
      // Shift → snap σε 15° (preview === commit· ίδιο modifier με το commit path).
      const newAngle = applyHatchAngleGripDrag(
        origin, translatePoint(anchor, delta), ShiftKeyTracker.getSnapshot(),
      );
      const newGradient = withGradientPatch(gradient, DEFAULT_GRADIENT_DEFAULTS, { field: 'angleDeg', value: newAngle });
      return { ...(entity as object), gradient: newGradient } as unknown as DxfEntityUnion;
    }
    const newBoundaryPaths = applyHatchGripDrag(hatchGripKind, { originalBoundaryPaths: hatch.boundaryPaths, delta });
    if (newBoundaryPaths === hatch.boundaryPaths) return entity;
    return { ...(entity as object), boundaryPaths: newBoundaryPaths } as unknown as DxfEntityUnion;
  }

  // ── ADR-557 — text/mtext rect-box live preview (move / rotation / resize) ──
  // Routes through the SAME `applyTextGripDrag` the commit runs (preview ≡ commit),
  // then folds the top-level patch onto the cloned `DxfText` so the ghost shows the
  // new position / rotation / height (+ width|widthFactor). `anchorPos` = the grabbed
  // grip world pos at mouseDown so the rotation sweep matches the commit. text-move
  // also routes here (its patch = position+delta) for one transform path, not two.
  // NOTE: this ghost-preview pipeline receives the RAW scene entity (`useGripGhostPreview`
  // → `getEntity`), whose discriminator is `'text'` OR `'mtext'`. The mtext→`'text'`
  // normalisation (`dxf-text-entity-converter`) happens ONLY in the render/hit-test pipeline
  // (`dxf-scene-entity-converter`), NOT here — so an MTEXT grip drag arrives as `'mtext'` and
  // the guard MUST accept both, else the live ghost vanishes ("το κείμενο δεν ανταποκρίνεται",
  // Giorgio 2026-06-30). Regression re-fix of ba33b0c2 (reverted by 0878ed54 on a wrong
  // premise). Guarded by `apply-entity-preview-text.test.ts`.
  if ((entity.type === 'text' || entity.type === 'mtext') && (textGripKind || movesEntity)) {
    // The ghost pipeline hands us the RAW scene entity (textNode-based): its flat
    // `text`/`height`/`textStyle` are absent for in-app text, so previously (a)
    // `resolveBoxHeight` fell back to the 2.5 DIMTXT default → a ~1.5×2.5 box (garbage
    // transform → the drag read as a whole-entity move) and (b) the ghost `TextRenderer`
    // early-returned on the missing flat `text` → NO ghost at all (Giorgio 2026-07-06).
    // Project via the SAME SSoT the commit runs (preview ≡ commit) and inject the flat
    // fields so the box math is correct AND the ghost actually paints.
    const t = projectSceneTextToDxf(entity as unknown as TextSceneShape, entity.id);
    // ADR-557 — inject the projected flat fields onto EVERY text ghost so the render
    // EntityModel never carries undefined content (→ `TextRenderer` bails → invisible).
    const flat = {
      text: t.text,
      height: t.height,
      ...(t.textStyle ? { textStyle: t.textStyle } : {}),
    };
    // Whole-entity translate (body-drag / Move tool: `movesEntity`, no grip kind) — shift
    // the insertion point by `delta`. Previously this fell through to the generic
    // `movesEntity` path, which patched only `position` and left the flat fields undefined,
    // so a MOVING in-app text ghost never painted (Giorgio 2026-07-07).
    if (!textGripKind) {
      return { ...(entity as object), ...flat, position: translatePoint(t.position, delta) } as unknown as DxfEntityUnion;
    }
    const currentPos: Point2D = anchorPos
      ? translatePoint(anchorPos, delta)
      : { x: delta.x, y: delta.y };
    // ADR-557 — `rotatePivot` (set only for the text-rotation hot-grip: free spin /
    // 6-click reference) orbits the picked centre, so the live ghost matches the
    // commit (preview ≡ commit). Move / resize leave it undefined → applyTextRotation
    // falls back to the bbox-centre. Mirror of the line / arc / polyline branches.
    const patch = applyTextGripDrag(textGripKind, { entity: t, delta, currentPos, ...(rotatePivot ? { pivot: rotatePivot } : {}) });
    if (Object.keys(patch).length === 0) return entity;
    return {
      ...(entity as object),
      ...flat,
      ...patch,
    } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Slice F — plain DXF line ROTATION live ghost ──────────────────
  // The line is a primitive (start/end, no params); the rotation ghost spins both
  // endpoints about `rotatePivot` (the picked centre) via the SAME shared
  // `rotateAxisPointsAboutPivot` SSoT the commit (RotateEntityCommand) runs, so the
  // preview ≡ commit. `anchorPos` = the reference anchor (swept angle starts at 0).
  // ⚠️ Slice G.5: gate to `'line-rotation'` ONLY — the MOVE grip (`'line-move'`) is a
  // whole-entity translate (movesEntity + edgeVertexIndices); it must fall through to
  // the `movesEntity` / classic ghost below (preview ≡ the centre midpoint grip), NOT
  // spin. A bare `if (lineGripKind)` rotated the move ghost.
  if (lineGripKind === 'line-rotation' && anchorPos && entity.type === 'line') {
    const line = entity as unknown as DxfLine;
    const currentPos: Point2D = translatePoint(anchorPos, delta);
    const rotated = applyLineRotationDrag({ start: line.start, end: line.end, delta, currentPos, ...(rotatePivot ? { pivot: rotatePivot } : {}) });
    if (!rotated) return entity;
    return { ...(entity as object), start: rotated.start, end: rotated.end } as unknown as DxfEntityUnion;
  }

  // ── ADR-561 — plain DXF arc + polyline / rectangle ROTATION live ghost ────
  // Both are primitives whose rotation the ONE `rotateEntity` engine already owns (arc:
  // centre + start/end angle· polyline: every vertex), so the ghost delegates to the
  // SHARED `applyPrimitiveRotationDrag` — the SAME `sweptAngleDegAboutPivot` +
  // `rotateEntity` the commit runs (`commitArcGripDrag` / `commitPolylineRotationGripDrag`
  // → `RotateEntityCommand`) — making preview ≡ commit by IDENTITY, not hand-kept parity.
  // `anchorPos` = the reference anchor (swept angle starts at 0). The pivot defaults to the
  // arc centre / the polyline bbox centre (the commit's per-primitive fallback) when no
  // hot-grip centre was picked. A scene rectangle is already a closed 4-vertex polyline here,
  // so the polyline branch covers it. Only the rotation handle carries the `*-rotation` kind;
  // the centre MOVE grip (`movesEntity`) falls through to the classic translate below.
  // Arc / polyline / annotation-symbol / group ROTATION live ghosts all spin about a
  // per-type pivot via the SHARED `rotationGhost` SSoT (preview ≡ commit; N.18 — the
  // only difference is the discriminator + the pivot expression). The `*-move` crosses
  // (`movesEntity`) fall through to the classic translate below.
  if (arcGripKind === 'arc-rotation' && anchorPos && entity.type === 'arc') {
    return rotationGhost(entity, anchorPos, delta, rotatePivot ?? (entity as unknown as DxfArc).center);
  }
  if (polylineGripKind === 'polyline-rotation' && anchorPos && entity.type === 'polyline') {
    return rotationGhost(entity, anchorPos, delta, rotatePivot ?? polylineBboxCenter((entity as unknown as DxfPolyline).vertices));
  }
  // ADR-583 — pivot = insertion point (`rotateEntity` case 'annotation-symbol').
  if (annotationSymbolGripKind === 'annotation-symbol-rotation' && anchorPos && entity.type === 'annotation-symbol') {
    return rotationGhost(entity, anchorPos, delta, rotatePivot ?? (entity as unknown as { position: Point2D }).position);
  }
  // ADR-583 Φ3 — annotation-symbol CORNER resize live ghost: UNIFORM `sizeMm` scale about the
  // insertion point via the SAME `applyAnnotationSymbolGripDrag` SSoT the commit runs (preview ≡
  // commit by identity). `anchorPos` = the grabbed corner's world anchor; the flat `{ sizeMm }`
  // patch is enough (the renderer folds it back through `paperHeightToModel` at draw time).
  if (
    annotationSymbolGripKind &&
    isAnnotationSymbolCornerKind(annotationSymbolGripKind) &&
    entity.type === 'annotation-symbol'
  ) {
    const sym = entity as unknown as AnnotationSymbolEntity;
    const patch = applyAnnotationSymbolGripDrag(annotationSymbolGripKind, sym, anchorPos ?? sym.position, delta);
    if (Object.keys(patch).length === 0) return entity;
    return { ...(entity as object), ...patch } as unknown as DxfEntityUnion;
  }
  // ADR-575 §8 — GROUP gizmo: pivot = bbox centre (`rotateEntity` case 'group' recurses members).
  if (groupGripKind === 'group-rotation' && anchorPos && entity.type === 'group') {
    return rotationGhost(entity, anchorPos, delta, rotatePivot ?? computeGroupSelectionBounds(entity as unknown as GroupEntity)?.center);
  }
  if (movesEntity && entity.type === 'group') {
    // Whole-group translate (gizmo move cross OR any whole-group move) — the SAME
    // `calculateMovedGeometry` case 'group' the commit runs (recurse members). Returns
    // `{ members }`; folded onto the cloned group so the render expands + ghosts each.
    const patch = calculateMovedGeometry(entity as unknown as SceneEntity, delta);
    return { ...(entity as object), ...patch } as unknown as DxfEntityUnion;
  }

  // ── ADR-358 Phase 5d — parametric stair live preview ─────────────────────
  // Stair grips mutate `StairParams`; geometry is fully derived. Route
  // through the same SSoT pure helper the commit adapter uses, then re-derive
  // geometry. We expose the resulting entity in the same `DxfStair` wrapper
  // shape the canvas pipeline uses (`type: 'stair', stairEntity: {...}`),
  // so `drawGhostEntity` can find it via `entity.stairEntity.geometry`.
  if (stairGripKind && anchorPos) {
    const stair = unwrapStair(entity);
    if (!stair) return entity;
    const currentPos: Point2D = translatePoint(anchorPos, delta);
    const newParams = applyStairGripDrag(stairGripKind, {
      originalParams: stair.params,
      delta,
      currentPos,
      // ADR-393 v2 Phase 2 — multi-flight corner transforms read the last
      // flight's direction from the walkline; supply geometry so the live ghost
      // matches the commit path (otherwise an L/U/Γ end-corner preview would
      // decompose on flight-1's axis and snap on release).
      geometry: stair.geometry,
      // ADR-637 Phase 4-C — target rest-landing id for the `stair-rest-landing-*`
      // grips, so the live ghost slides/resizes the SAME landing the commit does
      // (`commitStairGripDrag` forwards the identical channel). Without it
      // `slideRestLanding`/`resizeRestLandingLength` can't locate the landing →
      // `newParams === stair.params` → no ghost. No-op for every other stair grip.
      ...(landingId ? { landingId } : {}),
    });
    if (newParams === stair.params) return entity;
    const newGeometry = computeStairGeometry(newParams);
    const ghostStair: StairEntity = {
      ...stair,
      params: newParams,
      geometry: newGeometry,
    };
    return {
      ...(entity as object),
      type: 'stair',
      stairEntity: ghostStair,
    } as unknown as DxfEntityUnion;
  }

  // ── Opening live ghosts (self-hosted ADR-615 + hosted Alt-move ADR-363) ──────
  // Extracted to `apply-opening-preview` (SOS N.7.1). Each routes through the SAME
  // grip-drag / alt-move SSoT the commit runs (preview ≡ commit); returns null when
  // the preview is not an opening branch → fall through to the classic path below.
  const openingPreview = applyOpeningPreview(entity, preview, ctx);
  if (openingPreview) return openingPreview;

  // ── ADR-363 Phase 1G.5 — Alt «move-from-characteristic-point» whole-entity ghost ──
  // Reached when the preview carries `movesEntity` + `delta` but NO parametric
  // gripKind (every kind-specific branch above returns first). Translate the WHOLE
  // BIM entity by `delta` through the move SSoT so the live ghost matches the commit
  // (`calculateBimMovedGeometry`). Non-BIM entities (line/circle/text) → null patch →
  // fall through to the classic translate path below. `opening` → `{}` (host-derived).
  if (movesEntity) {
    const bimPatch = calculateBimMovedGeometry(entity as unknown as Entity, delta);
    if (bimPatch && Object.keys(bimPatch).length > 0) {
      return { ...(entity as object), ...bimPatch } as unknown as DxfEntityUnion;
    }
  }

  // Classic (non-parametric) path: whole-translation, edge-stretch, vertex-stretch.
  return applyClassicEntityPreview(entity, delta, gripIndex, movesEntity, edgeVertexIndices);
}
