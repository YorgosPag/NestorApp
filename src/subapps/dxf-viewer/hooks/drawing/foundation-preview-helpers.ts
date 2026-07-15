/**
 * @module foundation-preview-helpers
 * @description Pure helper for foundation line-tool (strip / tie-beam) real-time
 * preview rendering. Mirror of `beam-preview-helpers.ts` (ADR-363 Phase 5.5P) —
 * line-based 2-click placement (no 3-click curve branch).
 *
 * Exported: generateFoundationPreview()
 *
 * WYSIWYG placement (2026-06-11): the rubber-band returns a FULL
 * `FoundationEntity` (via the SSoT `buildFoundationEntity` — same builder as
 * commit) flagged `wysiwygPreview`, so PreviewCanvas renders it through the real
 * `FoundationRenderer` (kind fill / RC hatch / dashed hidden-line / centerline)
 * instead of a green band outline. The ghost IS the final foundation.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity, PreviewPoint } from './drawing-types';
import type { PlacementGhostEntity } from '../../bim/placement/placement-overlay-fields';
import type { Point3D } from '../../bim/types/bim-base';
import { foundationPreviewStore } from '../../bim/foundations/foundation-preview-store';
import { buildDefaultFoundationParams, buildFoundationEntity, type FoundationParamOverrides, type SceneUnits } from './foundation-completion';
import { DEFAULT_PAD_WIDTH_MM, DEFAULT_PAD_LENGTH_MM, type FoundationKind, type FoundationParams } from '../../bim/types/foundation-types';
import { toWysiwygPreviewEntity, resolveEffectivePreviewCursor } from './wysiwyg-preview-shared';
import { getDefaultLayerId } from '../../stores/LayerStore';
// ADR-564 §foundation-hud — το πέδιλο ξαναχρησιμοποιεί ΤΟΥΣ ΙΔΙΟΥΣ live HUD painters με τοίχο/δοκάρι/
// κολόνα: γραμμικό (strip/tie) → `wall-hud-paint` (μήκος+∠+διατομή)· pad → `paintFootprintHud` (πλάτος/
// βάθος ανά παρειά+∠+βάθος). Η μετάφραση ζει στο `foundation-hud-spec-label` (N.11-clean).
import { buildSegmentHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import type { FootprintHudDescriptor } from '../../canvas-v2/preview-canvas/column-hud-paint';
import { buildFoundationHudSpecLabel, buildFoundationPadHudSpecLabel } from './foundation-hud-spec-label';
// ADR-514 Φ6c/Φ6d — live pad ghost: flush σε παρειά/άξονα κολόνας ΜΕΣΑ από τον ΕΝΑ εγκέφαλο έλξης +
// ΚΟΙΝΗ assembly (ghost + CL dims + polar/rect grid + place→rotate) με την κολώνα — μηδέν διπλότυπο.
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { buildPlacementPolarSnapOptions } from '../../bim/placement/placement-polar-opts';
import { getPlacementRotationLock } from '../../systems/cursor/PlacementRotationStore';
import {
  assemblePlacementGhost,
  assemblePlacementRotationGhost,
  type PlacementGhostEntityBuilder,
} from '../../bim/placement/placement-ghost-assembly';


/**
 * Build a foundation line preview entity from `tempPoints` + cursor. State map:
 *   - [] (awaitingStart) → cursor start marker
 *   - [start] → full FoundationEntity band ghost start→cursor (WYSIWYG)
 *
 * Returns a full `FoundationEntity` (WYSIWYG) so the placement preview is
 * identical to the committed band. `null` on a degenerate/invalid frame.
 */
export function generateFoundationPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  if (tempPoints.length === 0) {
    return {
      id: 'preview_foundation_startmarker',
      type: 'point',
      position: cursorPoint,
      size: 6,
      visible: true,
      layerId: getDefaultLayerId(),
      preview: true,
      showPreviewGrips: true,
    } as PreviewPoint;
  }

  const preview = foundationPreviewStore.get();
  const startPt = tempPoints[0];
  return makeFoundationBandGhost('preview_foundation_band', startPt, cursorPoint, preview.kind, preview.overrides, sceneUnits);
}

/**
 * ADR-514 Φ6c/Φ6d — **live pad ghost** (Revit-grade, ΙΔΙΟ σύστημα με την κολώνα από ΜΙΑ πηγή αλήθειας):
 * WYSIWYG `FoundationEntity` (pad) που κουμπώνει **ζωντανά** flush σε παρειά/άξονα κολόνας/μέλους (9-handle
 * face-snap) + **πολικό/καρτεσιανό πλέγμα** μέσα σε κύκλο/ορθογώνιο + **CL listening dimensions** (σιελ) —
 * όλα μέσω της ΚΟΙΝΗΣ `placement-ghost-assembly` (entity-agnostic, μηδέν διπλότυπο με το column).
 *
 * Δύο φάσεις (mirror κολώνας, ADR-508 §column place+rotate):
 *   · awaitingRotation (μετά το 1ο κλικ) → το πέδιλο μένει στην ΚΛΕΙΔΩΜΕΝΗ θέση και ΠΕΡΙΣΤΡΕΦΕΤΑΙ live
 *     προς τον κέρσορα (`PlacementRotationStore` — κοινό lock με την κολώνα → ο `drawing-hover-handler`
 *     ζωγραφίζει αυτόματα την πορτοκαλί γραμμή/γωνία).
 *   · awaitingPosition (πριν το 1ο κλικ) → face-snap μέσω του ΕΝΟΣ εγκεφάλου `toolKind:'foundation-pad'`
 *     (ΙΔΙΟΣ resolver με την κολώνα), ΧΩΡΙΣ findSnapPoint (anti double-snap, ADR-514 §2).
 *
 * kind/overrides(+anchor) από το κοινό `foundationPreviewStore` (single-writer ο tool) → preview ≡ commit.
 */
/**
 * ADR-564 §foundation-hud — προσαρτά στο pad ghost τα δεδομένα του footprint HUD (`paintFootprintHud`):
 * footprint κορυφές + ελάχιστος `FootprintHudDescriptor` (πάντα ορθογώνιο pad → `kind:'rectangular'` +
 * γωνία) + προ-μεταφρασμένη ετικέτα βάθους. Ο `drawing-hover-handler` το διαβάζει και ζωγραφίζει live
 * πλάτος/βάθος ανά παρειά + ∠ γωνία + βάθος κατά την τοποθέτηση (parity με κολόνα). Τα δεδομένα ζουν
 * ΗΔΗ στο ghost (FoundationEntity) — απλή αναφορά, μηδέν αντιγραφή γεωμετρίας. No-op σε degenerate ghost.
 */
function attachFoundationPadHud(ghost: ExtendedSceneEntity | null): PlacementGhostEntity | null {
  if (!ghost) return ghost;
  const fe = ghost as unknown as {
    geometry?: { footprint?: { vertices?: readonly Point2D[] } };
    params?: FoundationParams;
  };
  const footprint = fe.geometry?.footprint?.vertices;
  const params = fe.params;
  if (!footprint || footprint.length === 0 || !params || params.kind !== 'pad') return ghost;
  const descriptor: FootprintHudDescriptor = { kind: 'rectangular', rotationDeg: params.rotation };
  const heightSpecLabel = buildFoundationPadHudSpecLabel(params.thicknessMm);
  // ADR-663 §4 part 4 — mirror του `attachColumnHud`: το `footprintHud` ζει στον SSoT
  // (`PlacementOverlayFields`) → μηδέν cast (ADR-544 ολοκληρωμένο).
  return { ...ghost, footprintHud: { footprint, descriptor, heightSpecLabel } };
}

export function generateFoundationPadPreview(
  cursorPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  const preview = foundationPreviewStore.get();
  if (preview.kind !== 'pad') return null; // safety — μόνο για το pad kind

  // ADR-398 §3.13 — Polar/Rect Magnet opts με τις διαστάσεις του ΠΕΔΙΛΟΥ (width×length), ίδιο SSoT με κολόνα.
  const padWidthMm = typeof preview.overrides.width === 'number' ? preview.overrides.width : DEFAULT_PAD_WIDTH_MM;
  const padLengthMm = typeof preview.overrides.length === 'number' ? preview.overrides.length : DEFAULT_PAD_LENGTH_MM;
  const polarOpts = buildPlacementPolarSnapOptions(padWidthMm, padLengthMm, sceneUnits);
  const targets = sceneSnapTargetsStore.get();

  // entity-specific builder — ΙΔΙΟΣ builder με το commit (preview ≡ commit).
  const buildPadGhostEntity: PlacementGhostEntityBuilder = (position, anchor, rotation) => {
    const overrides: FoundationParamOverrides = {
      ...preview.overrides,
      kind: 'pad',
      anchor,
      ...(rotation !== null ? { rotation } : {}),
    };
    const params = buildDefaultFoundationParams(position, 'pad', overrides, sceneUnits);
    const built = buildFoundationEntity(params, getDefaultLayerId());
    return built.ok ? built.entity : null;
  };

  // awaitingRotation — locked θέση, live περιστροφή προς τον κέρσορα (+ grid).
  const rot = getPlacementRotationLock();
  if (rot) {
    return attachFoundationPadHud(assemblePlacementRotationGhost({
      origin: rot.origin,
      anchor: rot.anchor,
      cursor: cursorPoint,
      targets,
      sceneUnits,
      polarOpts,
      ghostId: 'preview_foundation_pad',
      buildEntity: buildPadGhostEntity,
    }));
  }

  // awaitingPosition — face-snap → κοινή assembly (ghost + CL dims + polar/rect grid).
  const effectiveCursor = resolveEffectivePreviewCursor(cursorPoint);
  const snap = resolveBimCursorSnap({
    toolKind: 'foundation-pad',
    cursor: effectiveCursor,
    targets,
    sceneUnits,
    columnOpts: polarOpts,
  });
  return attachFoundationPadHud(assemblePlacementGhost({
    snap,
    effectiveCursor,
    targets,
    sceneUnits,
    polarOpts,
    fallbackAnchor: preview.overrides.anchor ?? 'center',
    ghostId: 'preview_foundation_pad',
    buildEntity: buildPadGhostEntity,
  }));
}

function makeFoundationBandGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  kind: FoundationKind,
  overrides: FoundationParamOverrides,
  sceneUnits: SceneUnits,
): ExtendedSceneEntity | null {
  const axisEnd: Point3D = { x: endPt.x, y: endPt.y, z: 0 };
  const params = buildDefaultFoundationParams(startPt, kind, { ...overrides, kind, axisEnd }, sceneUnits);
  const built = buildFoundationEntity(params, getDefaultLayerId());
  if (!built.ok) return null;
  // ADR-564 §foundation-hud — ζωντανή ταυτότητα γραμμικού πεδίλου (μήκος + ∠ γωνία + διατομή «b·h»),
  // ΚΟΙΝΟΣ painter με τοίχο/δοκάρι (`buildSegmentHudMeta`→`paintWallHud`). `thicknessMm` param = πλάτος
  // band (plan half-width → offset της dim line)· `heightMm` = βάθος διατομής (cosmetic — η ετικέτα
  // έρχεται προ-μεταφρασμένη ως `hudSpecLabel`). Το τόξο φοράς το ζωγραφίζει ο handler (gate χαλαρωμένο).
  const hudMeta = buildSegmentHudMeta(startPt, endPt, sceneUnits, params.width, params.thicknessMm);
  const hudSpecLabel = buildFoundationHudSpecLabel(params.width, params.thicknessMm);
  return toWysiwygPreviewEntity(built.entity, id, null, null, null, hudMeta, hudSpecLabel);
}
