/**
 * @module drawing-hover-overlays
 * @description Pure painter for the drawing-hover preview overlays (HUDs, tracking
 * lines, direction arcs, magnets, guides). Extracted from `drawing-hover-handler.ts`
 * to keep that handler under the Google 500-line budget (N.7.1) — this file owns the
 * `previewEntity`-present branch: every `previewCanvasRef.current.drawX(...)` call that
 * decorates the rubber-band ghost. Numbers/i18n resolved here; the canvas painters stay
 * pure (numbers in). No behaviour change — a 1:1 lift of the original block.
 */
import type React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ToolType } from '../../ui/toolbar/types';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import type { PolarSnapResult } from '../../systems/constraints/polar-utils';
import type { ExtendedSceneEntity } from './drawing-types';
import { formatLengthForDisplay } from '../../config/display-length-format';
import { formatPolarLabel, faceRelativeDisplayAngle } from '../../systems/constraints/polar-utils';
import { resolveAlignmentTracking } from '../../systems/tracking/resolve-alignment-tracking';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import type { PlacementOverlayFields } from '../../bim/placement/placement-overlay-fields';
import type { WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import { buildWallHudSpecLabel } from './wall-hud-spec-label';
import { buildColumnHudSpecLabel } from './column-hud-spec-label';
import type { ColumnParams } from '../../bim/types/column-types';
import type { FootprintHudDescriptor } from '../../canvas-v2/preview-canvas/column-hud-paint';
import { getColumnRotationLock } from '../../systems/cursor/ColumnRotationStore';
import { resolveColumnRotationDeg } from '../../bim/columns/column-rotation';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { i18n } from '@/i18n';

type Pt = Point2D;
type AlignmentResult = NonNullable<ReturnType<typeof resolveAlignmentTracking>>['result'];

/**
 * Event-time context for the overlay painters. All values are resolved by
 * `processDrawingHover` before the paint pass — this function is pure w.r.t. them.
 */
export interface DrawingHoverOverlayCtx {
  activeTool: ToolType;
  /** Last committed reference point (tempPoints tail or BIM ortho anchor). */
  lastRefPt: Pt | undefined;
  /** Cursor position after all snap/lock resolution (the ghost's live point). */
  previewPt: Pt;
  polarSnapResult: PolarSnapResult | null;
  /** Face-relative wall snap (label angle relative to the face), or null. */
  faceRel: { baseAngle: number } | null;
  trackingResult: AlignmentResult | null;
  trackingPoint: Pt | null;
  getSceneUnitsScale: () => number;
  getTransformScale: () => number;
}

/**
 * Paint every decoration for the present preview ghost onto the preview canvas.
 * 1:1 lift of the `if (previewEntity) { … }` branch from `processDrawingHover`.
 */
export function paintDrawingHoverOverlays(
  canvas: PreviewCanvasHandle,
  previewEntity: ExtendedSceneEntity,
  ctx: DrawingHoverOverlayCtx,
): void {
  const {
    activeTool, lastRefPt, previewPt, polarSnapResult, faceRel,
    trackingResult, trackingPoint, getSceneUnitsScale, getTransformScale,
  } = ctx;
  canvas.drawPreview(previewEntity);
  // ADR-508 §dim: wall-ghost listening dimensions overlay (gap-left / gap-right /
  // centre-to-centre along the existing member's face). Attached as ghost metadata.
  // ADR-544 — ΕΝΑ structural read των overlay πεδίων (πλέγμα/διαστάσεις/οδηγός) μέσω canonical type.
  const overlay = previewEntity as PlacementOverlayFields;
  const faceDims = overlay.faceDimensions;
  if (faceDims) {
    canvas.drawGhostFaceDimensions(faceDims);
  }
  // ADR-508 §wall-hud — ζωντανή ταυτότητα τοίχου: aligned διάσταση μήκους + γωνία + πάχος·ύψος.
  // Τα νούμερα/μετάφραση εδώ (i18n + display units)· το paint είναι pure (numbers in).
  const wallHud = (previewEntity as { wallHud?: WallHudMeta }).wallHud;
  if (wallHud) {
    // ADR-508 §wall-hud — ΚΟΙΝΗ πηγή της ετικέτας «πάχος·ύψος» (ίδια με το grip-drag HUD).
    // ADR-564 §linear-hud — το ghost μπορεί να φέρει προ-μεταφρασμένη ετικέτα ανά μέλος (π.χ.
    // δοκάρι «b·h»)· όταν λείπει (τοίχος) → fallback στην ετικέτα τοίχου (μηδέν αλλαγή τοίχου).
    const specLabel = (previewEntity as { hudSpecLabel?: string }).hudSpecLabel
      ?? buildWallHudSpecLabel(wallHud);
    canvas.drawWallHud(wallHud, specLabel);
  }
  // ADR-564 §footprint-hud — κολόνα/πέδιλο (footprint μέλος): live πλάτος/βάθος ανά παρειά + ∠
  // γωνία + ύψος, ΙΔΙΟΣ pure painter με το grip-drag (`paintColumnHud`). Το ghost φέρει
  // footprint+params ως `columnHud` meta (ADR-398 assembly)· ο handler ζωγραφίζει + μεταφράζει
  // την ετικέτα ύψους (i18n, N.11). Δουλεύει σε ΟΛΕΣ τις φάσεις (awaitingPosition/Rotation/Lean).
  const columnHud = (previewEntity as {
    columnHud?: { footprint: readonly Point2D[]; params: ColumnParams };
  }).columnHud;
  if (columnHud) {
    canvas.drawColumnHud(
      columnHud.footprint,
      columnHud.params,
      buildColumnHudSpecLabel(columnHud.params.height),
    );
  }
  // ADR-564 §foundation-hud — πέδιλο-pad (footprint μέλος): ΙΔΙΟΣ pure painter με την κολόνα
  // (`paintFootprintHud`) αλλά μέσω ελάχιστου `FootprintHudDescriptor` + προ-μεταφρασμένης
  // ετικέτας βάθους (το πέδιλο έχει `FoundationParams`, όχι `ColumnParams` → entity-agnostic
  // seam, μηδέν type-lie). Το ghost φέρει footprint+descriptor+label ως `footprintHud` meta.
  const footprintHud = (previewEntity as {
    footprintHud?: { footprint: readonly Point2D[]; descriptor: FootprintHudDescriptor; heightSpecLabel: string };
  }).footprintHud;
  if (footprintHud) {
    canvas.drawFootprintHud(
      footprintHud.footprint,
      footprintHud.descriptor,
      footprintHud.heightSpecLabel,
    );
  }
  // ADR-508 §line-hud — η ΓΡΑΜΜΗ δείχνει το ΙΔΙΟ live HUD μήκους+γωνίας με τον τοίχο, μέσω
  // του ΚΟΙΝΟΥ painter (drawWallHud → paintWallHudCore). Δεν έχει BIM ταυτότητα (πάχος/ύψος)
  // → κενό specLabel (παραλείπεται). Το `liveDimHud` τέθηκε στο applyPreviewStyling (line tool).
  const lineHud = (previewEntity as { liveDimHud?: WallHudMeta }).liveDimHud;
  if (lineHud) {
    canvas.drawWallHud(lineHud, '');
  }
  // ADR-397 §15 (wall) / ADR-564 §linear-hud (beam) — μετά το 1ο κλικ γραμμικού μέλους:
  // χρωματισμένο τόξο ΦΟΡΑΣ από την αρχή (lastRefPt) με άξονα αναφοράς τον world-X προς τον
  // κέρσορα (previewPt). 🟢 πάνω / 🔴 κάτω από τον x-άξονα + βελάκι + baseline 0° + χρωματιστές
  // μοίρες — ΙΔΙΟ SSoT painter με την περιστροφή. bearing = atan2(dy,dx) σε world (Y-up) → πάνω
  // = θετικό = πράσινο. Το δοκάρι κρατά την αρχή του στο dedicated preview store (ADR-363), οπότε
  // το `lastRefPt` (= getBimOrthoReference) δείχνει την αρχή του δοκαριού ΟΠΩΣ και του τοίχου.
  // ADR-564 §foundation-hud — τα γραμμικά πέδιλα (strip/tie-beam) είναι καθρέφτης του δοκαριού
  // → ίδιο τόξο ΦΟΡΑΣ. pivot = αρχή band (lastRefPt = getBimOrthoReference, foundation case).
  if (
    (activeTool === 'wall' || activeTool === 'beam' ||
      activeTool === 'foundation-strip' || activeTool === 'foundation-tie-beam') && lastRefPt
  ) {
    const bearingDeg = (Math.atan2(previewPt.y - lastRefPt.y, previewPt.x - lastRefPt.x) * 180) / Math.PI;
    canvas.drawDirectionArc(
      lastRefPt,
      { x: lastRefPt.x + 1, y: lastRefPt.y },
      previewPt,
      bearingDeg,
    );
  }
  // ADR-363 §wall-ortho-tracking — ΟΡΑΤΗ γραμμή-οδηγός στο 1ο σημείο του τοίχου (awaitingStart):
  // διακεκομμένη από το hover-acquired anchor (π.χ. κέντρο διπλανής κολόνας) προς την αρχή + γωνία/
  // απόσταση, ώστε να ΦΑΙΝΕΤΑΙ το ΟΡΘΟ/Q κλείδωμα (το hard ΟΡΘΟ δεν παράγει `polarSnapResult` → χωρίς
  // αυτό καμία ένδειξη — Giorgio «δεν λειτουργεί»). Μόνο awaitingStart (startPoint=null) & όταν δεν
  // υπάρχει ήδη polar line (μη διπλή). ΙΔΙΟ SSoT painter με την πολική/στρέψης γραμμή.
  if (
    activeTool === 'wall' && lastRefPt && !polarSnapResult?.isSnapped &&
    wallPreviewStore.get().startPoint === null
  ) {
    const bearingDeg = (Math.atan2(previewPt.y - lastRefPt.y, previewPt.x - lastRefPt.x) * 180) / Math.PI;
    const distMm = Math.hypot(previewPt.x - lastRefPt.x, previewPt.y - lastRefPt.y) / Math.max(getSceneUnitsScale(), 1e-9);
    canvas.drawPolarTrackingLine(
      lastRefPt,
      bearingDeg,
      `${bearingDeg.toFixed(0)}° / ${formatLengthForDisplay(distMm)}`,
      previewPt,
    );
  }
  // ADR-508 §opening-conflict — 🔴 tooltip: ο κάθετος τοίχος κόβει άνοιγμα host σε εύρος ύψους
  // (3D έλεγχος αόρατος στην κάτοψη). Reuse `formatLengthForDisplay` (display units) + i18n key.
  const openingConflict = (previewEntity as { openingConflict?: { bandMm: readonly [number, number] } }).openingConflict;
  if (openingConflict) {
    const [lo, hi] = openingConflict.bandMm;
    const range = `${formatLengthForDisplay(lo, { withUnit: false })}–${formatLengthForDisplay(hi)}`;
    const label = i18n.t('tools.wall.openingCutConflict', { range, ns: 'dxf-viewer-shell' });
    canvas.drawGhostConflictTooltip(label, previewPt);
  }
  // ADR-398 §3.13 — Polar Magnet: όταν ο cursor είναι μέσα σε κυκλικό δίσκο, overlay πολικό
  // πλέγμα (κέντρο/δακτύλιοι/ακτίνες). Attached ως ghost metadata από το `generateColumnPreview`.
  const polarGrid = overlay.polarDiskGrid;
  if (polarGrid) {
    canvas.drawPolarDisk(polarGrid);
  }
  // ADR-398 §3.15 — Cartesian Magnet: cursor μέσα σε ορθογώνιο → overlay καρτεσιανό πλέγμα.
  const rectGrid = overlay.rectGrid;
  if (rectGrid) {
    canvas.drawRectGrid(rectGrid);
  }
  // ADR-398 §3.20/§3.20d — alignment guide(s): dashed οδηγός στο άκρο/μέσον παρειάς ή πλευρά(ές)
  // ορθογωνίου (έως 2 στη γωνία). Ο renderer κάνει normalize σε array.
  const alignGuide = overlay.alignmentGuide;
  if (alignGuide) {
    canvas.drawAlignmentGuide(alignGuide);
  }
  // ADR-508 §column place+rotate — μετά το 1ο κλικ: ΠΟΡΤΟΚΑΛΙ γραμμή στρέψης + γωνία (ίδιο
  // SSoT `drawPolarTrackingLine` = drawingGuide χρώμα) από την κλειδωμένη θέση προς τον κέρσορα.
  const colRot = getColumnRotationLock();
  if (colRot) {
    const snappedDeg = resolveColumnRotationDeg(colRot.origin, previewPt, worldPerPixel(getTransformScale()));
    canvas.drawPolarTrackingLine(colRot.origin, snappedDeg, `${Math.round(snappedDeg)}°`, previewPt);
    // ADR-564 §rotation-arc (Giorgio «και τα δύο») — ΔΙΠΛΑ στην πορτοκαλί ευθεία, το έγχρωμο τόξο
    // ΦΟΡΑΣ (🟢 πάνω / 🔴 κάτω από τον world-X) + βελάκι + baseline — ΙΔΙΟ SSoT painter με τοίχο/
    // grip-rotate. pivot = κλειδωμένη θέση, ref = world-X, bearing = φορά προς τον κέρσορα.
    const arcBearingDeg = (Math.atan2(previewPt.y - colRot.origin.y, previewPt.x - colRot.origin.x) * 180) / Math.PI;
    canvas.drawDirectionArc(
      colRot.origin,
      { x: colRot.origin.x + 1, y: colRot.origin.y },
      previewPt,
      arcBearingDeg,
    );
  }
  // ADR-357 Phase 1: Polar tracking line overlay (dashed alignment path + tooltip)
  if (polarSnapResult?.isSnapped && lastRefPt && polarSnapResult.snappedAngle !== null) {
    // ADR-508 — face-relative wall snap: label the angle RELATIVE to the face
    // (perpendicular ⇒ 90°), not the absolute world heading (which read e.g.
    // "41.9°" while the wall was visibly perpendicular). The ray itself still
    // points along the absolute snapped angle.
    const labelAngle = faceRel
      ? faceRelativeDisplayAngle(polarSnapResult.snappedAngle, faceRel.baseAngle)
      : polarSnapResult.snappedAngle;
    canvas.drawPolarTrackingLine(
      lastRefPt,
      polarSnapResult.snappedAngle,
      formatPolarLabel(labelAngle, polarSnapResult.distance),
      previewPt,
    );
  }
  // ADR-357 Phase 4: Object Snap Tracking alignment overlay (dashed
  // paths from acquired points + intersection halo + distance label).
  if (trackingResult && trackingPoint) {
    // Distance from anchor to the (quantized) snap point → display unit
    // (mm internal → cm/m/… via the live displayUnitState SSoT).
    const distWorld = Math.hypot(
      trackingPoint.x - trackingResult.anchorPoint.x,
      trackingPoint.y - trackingResult.anchorPoint.y,
    );
    const distMm = distWorld / Math.max(getSceneUnitsScale(), 1e-9);
    // SSoT: value + active display-unit label in ONE call (no manual
    // formatDisplayValue + DISPLAY_UNIT_LABELS combo).
    const label = trackingResult.snappedAngle !== null
      ? `${trackingResult.snappedAngle.toFixed(0)}° / ${formatLengthForDisplay(distMm)}`
      : null;
    // ADR-357 ambient: draw ONLY the cursor-aligned path(s), not every
    // built path — mirrors Revit/AutoCAD and prevents ambient-source clutter.
    canvas.drawTrackingAlignment(
      trackingResult.activePaths,
      trackingResult.intersections,
      trackingPoint,
      label,
    );
  }
}
