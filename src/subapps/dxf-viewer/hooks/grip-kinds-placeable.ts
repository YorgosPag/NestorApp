/**
 * Placeable-object + linear-element grip-kind discriminator unions — extracted
 * from `grip-kinds.ts` (SRP / Google file-size standard N.7.1). Covers the
 * centred-box placeable family (MEP fixture / electrical panel / plumbing
 * manifold / furniture / floorplan symbol) and the linear elements (MEP segment,
 * construction XLine / Ray). Re-exported from `grip-kinds.ts` (and transitively
 * `grip-types.ts`) for backward compatibility, so existing
 * `import { MepFixtureGripKind } from '../grip-kinds'` call-sites keep working.
 */

/**
 * ADR-406 — MEP fixture (light fixture) grip kind (parametric grip type).
 * Routes commit through `applyMepFixtureGripDrag()` + `UpdateMepFixtureParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Grips exposed by `MepFixtureEntity` (`bim/mep-fixtures/mep-fixture-grips.ts`):
 *   - `mep-fixture-move`     → translate `position` (whole-entity MOVE glyph).
 *   - `mep-fixture-rotation` → rotate about `position` (curved ROTATION glyph;
 *                              rectangular only).
 *   - `mep-fixture-corner-{ne,nw,sw,se}` → two-direction resize of width × length.
 *     The DIAGONALLY-OPPOSITE corner stays pinned (anchor); the body grows/shrinks
 *     toward the dragged corner and `position` re-centres to the new box centre.
 *     ORTHO (F8) constrains the drag to the dominant local axis (pure width OR
 *     pure length). Clamped to `MIN_FIXTURE_DIMENSION_MM`.
 *   - `mep-fixture-diameter` → circular kind only: resize diameter (symmetric 2×,
 *                              centre fixed). Minimal fallback for the non-live
 *                              circular shape.
 */
export type MepFixtureGripKind =
  | 'mep-fixture-move'
  | 'mep-fixture-rotation'
  | 'mep-fixture-diameter'
  | 'mep-fixture-corner-ne'
  | 'mep-fixture-corner-nw'
  | 'mep-fixture-corner-sw'
  | 'mep-fixture-corner-se';

/**
 * ADR-408 Φ3 — Electrical panel grip kind (parametric grip type).
 * Routes commit through `applyElectricalPanelGripDrag()` +
 * `UpdateElectricalPanelParamsCommand` instead of the standard
 * `StretchEntityCommand` vertex path.
 *
 * Grips exposed by `ElectricalPanelEntity`
 * (`bim/electrical-panels/electrical-panel-grips.ts`) — full wall-parity mirror
 * of the rectangular MEP fixture (the panel is rectangular-only → no diameter):
 *   - `electrical-panel-move`     → translate `position` (whole-entity MOVE glyph).
 *   - `electrical-panel-rotation` → rotate about `position` (curved ROTATION glyph).
 *   - `electrical-panel-corner-{ne,nw,sw,se}` → two-direction resize of width ×
 *     length. The DIAGONALLY-OPPOSITE corner stays pinned (anchor); the body
 *     grows/shrinks toward the dragged corner and `position` re-centres. ORTHO
 *     (F8) constrains the drag to the dominant local axis (pure width OR pure
 *     length). Clamped to `MIN_PANEL_DIMENSION_MM`.
 */
export type ElectricalPanelGripKind =
  | 'electrical-panel-move'
  | 'electrical-panel-rotation'
  | 'electrical-panel-corner-ne'
  | 'electrical-panel-corner-nw'
  | 'electrical-panel-corner-sw'
  | 'electrical-panel-corner-se';

/**
 * ADR-408 Φ12 — Plumbing manifold grip kind (parametric grip type). Routes
 * commit through `applyMepManifoldGripDrag()` + `UpdateMepManifoldParamsCommand`.
 * Full wall-parity mirror of the electrical panel (rectangular-only → no diameter).
 *
 * The `outlet-add` / `outlet-remove` kinds are the Revit "array control" ▲/▼:
 * single-click ACTION grips (not drags) that bump `outletCount` ±1, routed through
 * `commitMepManifoldOutletCountGrip` (fire before the zero-delta guard, like
 * `opening-rotation`).
 */
export type MepManifoldGripKind =
  | 'mep-manifold-move'
  | 'mep-manifold-rotation'
  | 'mep-manifold-corner-ne'
  | 'mep-manifold-corner-nw'
  | 'mep-manifold-corner-sw'
  | 'mep-manifold-corner-se'
  | 'mep-manifold-outlet-add'
  | 'mep-manifold-outlet-remove';

/**
 * ADR-410 — Furniture grip kind (parametric grip type).
 * Routes commit through `applyFurnitureGripDrag()` +
 * `UpdateFurnitureParamsCommand` instead of the standard `StretchEntityCommand`
 * vertex path.
 *
 * Grips exposed by `FurnitureEntity` (`bim/furniture/furniture-grips.ts`) —
 * rectangular-only (no diameter), full wall-parity mirror of the rectangular
 * MEP fixture / electrical panel:
 *   - `furniture-move`     → translate `position` (whole-entity MOVE glyph).
 *   - `furniture-rotation` → rotate about `position` (curved ROTATION glyph).
 *   - `furniture-corner-{ne,nw,sw,se}` → two-direction resize of width × depth.
 *     The DIAGONALLY-OPPOSITE corner stays pinned (anchor); the body grows/shrinks
 *     toward the dragged corner and `position` re-centres. ORTHO (F8) constrains
 *     the drag to the dominant local axis (pure width OR pure depth). Clamped to
 *     `MIN_FURNITURE_DIMENSION_MM`.
 */
export type FurnitureGripKind =
  | 'furniture-move'
  | 'furniture-rotation'
  | 'furniture-corner-ne'
  | 'furniture-corner-nw'
  | 'furniture-corner-sw'
  | 'furniture-corner-se';

/**
 * ADR-683 Φ3 §10.1 — εισαγόμενο πλέγμα: **ΔΥΟ λαβές, τέλος**.
 *   - `imported-mesh-move`     → μετατόπιση του `position` (glyph MOVE).
 *   - `imported-mesh-rotation` → περιστροφή περί το `position` (καμπύλο glyph).
 *
 * ⚠️ **Καμία λαβή γωνίας — και δεν πρόκειται να προστεθεί.** Ο αδελφός τύπος `furniture` έχει
 * τέσσερις (`furniture-corner-*`) επειδή είναι παραμετρικό κουτί με authored διαστάσεις από
 * κατάλογο. Το εισαγόμενο πλέγμα είναι **ψημένη γεωμετρία**: το «πλάτος» του δεν είναι παράμετρος
 * αλλά *μέτρηση* των τριγώνων του. Λαβή resize εδώ θα παραμόρφωνε το σχέδιο του συνεργάτη — αυτό
 * ακριβώς απαγορεύει το ADR-683 §3. Το όριο δηλώνεται στον χρήστη μέσω της **απουσίας** των λαβών.
 */
export type ImportedMeshGripKind = 'imported-mesh-move' | 'imported-mesh-rotation';

/**
 * ADR-415 — floorplan-symbol grip kind (parametric grip type). 1:1 mirror of
 * `FurnitureGripKind`: routes commit through `applyFloorplanSymbolGripDrag()` +
 * `UpdateFloorplanSymbolParamsCommand` (centre translate + rotation + opposite-
 * corner-anchored width/depth resize). Shares the centred-box grip SSoT.
 */
export type FloorplanSymbolGripKind =
  | 'floorplan-symbol-move'
  | 'floorplan-symbol-rotation'
  | 'floorplan-symbol-corner-ne'
  | 'floorplan-symbol-corner-nw'
  | 'floorplan-symbol-corner-sw'
  | 'floorplan-symbol-corner-se';

/**
 * ADR-408 Φ8 — MEP segment (duct / pipe) grip kind (parametric grip type).
 * Routes commit through `applyMepSegmentGripDrag()` + `UpdateMepSegmentParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Grips exposed by `MepSegmentEntity` (`bim/mep-segments/mep-segment-grips.ts`) —
 * mirrors `BeamGripKind` for a linear 2-click element:
 *   - `mep-segment-start`    → translate axis start endpoint.
 *   - `mep-segment-end`      → translate axis end endpoint.
 *   - `mep-segment-midpoint` → translate whole segment (both endpoints); renders
 *                              the 4-arrow MOVE glyph + 3-click hot-grip.
 *   - `mep-segment-section`  → resize section width (plan axis, symmetric × 2)
 *                              perpendicular to the axis at midpoint. For
 *                              rectangular duct: resizes `width`; for round duct /
 *                              pipe: resizes `diameter`. Clamped to
 *                              `MIN_SEGMENT_DIMENSION_MM`.
 *   - `mep-segment-rotation` → rotate the whole segment (startPoint + endPoint)
 *                              about a picked centre / the axis midpoint. Curved
 *                              ROTATION glyph + 6-click ROTATE→Reference hot-grip
 *                              (full beam-rotation parity). Skipped on degenerate
 *                              (zero-length) axis.
 */
export type MepSegmentGripKind =
  | 'mep-segment-start'
  | 'mep-segment-end'
  | 'mep-segment-midpoint'
  | 'mep-segment-section'
  | 'mep-segment-rotation';

/**
 * ADR-359 Phase 11 — XLine grip kind.
 * Routes commit through `applyXLineGripDrag()` + direct scene patch instead of
 * the standard `StretchEntityCommand` vertex path.
 *   - `xline-base` → translate basePoint (direction invariant).
 *   - `xline-dir`  → rotate: recompute direction = normalize(cursor − basePoint).
 */
export type XLineGripKind = 'xline-base' | 'xline-dir';

/**
 * ADR-359 Phase 11 — Ray grip kind.
 * Routes commit through `applyRayGripDrag()` + direct scene patch.
 *   - `ray-base` → translate basePoint (direction invariant).
 *   - `ray-dir`  → rotate: recompute direction = normalize(cursor − basePoint).
 */
export type RayGripKind = 'ray-base' | 'ray-dir';
