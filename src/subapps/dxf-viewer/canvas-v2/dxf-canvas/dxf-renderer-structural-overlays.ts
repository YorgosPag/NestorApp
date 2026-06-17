import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from './dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
// ADR-470 — per-component visibility resolver SSoT (σώμα/σοβάς/οπλισμός· per-element + per-view).
import { isStructuralComponentVisible } from '../../bim/visibility/structural-component-visibility';
// ADR-452 — cut-plane (Revit View Range) hide gate SSoT.
import { isHiddenByCutPlane } from '../../bim/visibility/entity-z-extents';
// ADR-449 Slice X2 μέρος Β — ΕΝΑ scene-level pass ζωγραφίζει την ΕΝΙΑΙΑ silhouette (κοινή με 3Δ).
import { drawStructuralFinishOutline } from '../../bim/renderers/structural-finish-outline-2d';
// ADR-456 Slice 3 — 2Δ σχεδίαση οπλισμού κολώνας (scene-level pass, gated, κοινό geometry SSoT με 3Δ).
import { drawColumnRebar2D } from '../../bim/renderers/column-rebar-2d';
// ADR-471 Slice 2 — 2Δ σχεδίαση οπλισμού δοκού (longitudinal· ίδιο pass/gate με την κολώνα).
import { drawBeamRebar2D } from '../../bim/renderers/beam-rebar-2d';
import { mmToSceneUnits } from '../../utils/scene-units';
import { buildStructuralFinishSilhouette2D } from './dxf-renderer-frame-builders';

/**
 * Scene-level structural overlay passes extracted from {@link DxfRenderer} (Boy-Scout
 * file-size split, 2026-06-17). Mirror του `dxf-foundation-reinforcement-overlay.ts`
 * pattern: pure draw functions που δέχονται `ctx`, μηδέν instance state / subscriptions
 * (ADR-040-safe). Ζωγραφίζονται μέσα στο cached normal-state bitmap, πριν το `ctx.restore()`.
 */

/**
 * ADR-471 Slice 2 (γενίκευση του ADR-456 column overlay) — ζωγραφίζει τον οπλισμό ΟΛΩΝ
 * των **δομικών μελών** (κολώνα + δοκάρι) με ορισμένο `reinforcement`, ως scene-level
 * overlay μέσα στο cached normal-state bitmap. Dispatch ανά `entity.type` → κολώνα
 * (`drawColumnRebar2D`, cross-section) / δοκάρι (`drawBeamRebar2D`, longitudinal). Κάθε
 * μέλος καταναλώνει το ΙΔΙΟ geometry SSoT με το 3Δ → ίδιες θέσεις. No-op όταν ο διακόπτης
 * «Οπλισμός» είναι κλειστός (per-element gate). ADR-040: pure draw, zero subscriptions.
 */
export function drawMemberReinforcement2D(
  ctx: CanvasRenderingContext2D,
  entities: readonly DxfEntityUnion[],
  transform: ViewTransform,
  actualViewport: Viewport,
): void {
  // ADR-470 — δεν κάνουμε early-return στο view-level flag: το per-element
  // override μπορεί να δείξει οπλισμό ακόμη κι όταν ο διακόπτης είναι κλειστός
  // (και αντίστροφα). Το gate γίνεται ανά entity μέσω του resolver SSoT.
  const bimSettings = useBimRenderSettingsStore.getState();
  const worldToScreen = (p: Point2D): Point2D =>
    CoordinateTransforms.worldToScreen(p, transform, actualViewport);
  for (const entity of entities) {
    if (!entity.visible) continue;
    // ADR-470 — per-element reinforcement visibility (override → view-level) + cut-plane
    // parity: στο ενεργό υψόμετρο τομής δείχνουμε μόνο όσα υπάρχουν στο/κάτω από το επίπεδο.
    if (entity.type === 'column') {
      if (!entity.params.reinforcement) continue; // ADR-460 — κάθε σχήμα (όχι μόνο ορθογωνική)
      if (!isStructuralComponentVisible('reinforcement', entity)) continue;
      if (isHiddenByCutPlane(entity, bimSettings.viewRange, bimSettings.cutPlaneActive)) continue;
      const pxPerMm = mmToSceneUnits(entity.params.sceneUnits ?? 'mm') * transform.scale;
      drawColumnRebar2D(ctx, entity.params, pxPerMm, worldToScreen);
    } else if (entity.type === 'beam') {
      if (!entity.params.reinforcement) continue; // ADR-471 — δοκάρι με ορισμένο/auto οπλισμό
      if (!isStructuralComponentVisible('reinforcement', entity)) continue;
      if (isHiddenByCutPlane(entity, bimSettings.viewRange, bimSettings.cutPlaneActive)) continue;
      const pxPerMm = mmToSceneUnits(entity.params.sceneUnits ?? 'mm') * transform.scale;
      drawBeamRebar2D(ctx, entity, pxPerMm, worldToScreen);
    }
  }
}

/**
 * ADR-449 Slice X2 μέρος Β — ζωγραφίζει τον ΕΝΙΑΙΟ σοβά (2Δ merged silhouette) ως scene-level
 * overlay μέσα στο cached normal-state bitmap. Καταναλώνει την ΙΔΙΑ `computeStructuralFinishSilhouette`
 * SSoT με το 3Δ (`bim-scene-structural-finish-sync`) + το κοινό corner-geometry SSoT
 * (`computeMiteredOuter` μέσω `drawStructuralFinishOutline`). No-op όταν ο διακόπτης «Σοβατισμένη
 * όψη» είναι κλειστός ή κανένα στοιχείο δεν έχει ενεργό σοβά. ADR-040: pure draw, zero subscriptions.
 */
export function drawStructuralFinishSkin2D(
  ctx: CanvasRenderingContext2D,
  entities: readonly DxfEntityUnion[],
  transform: ViewTransform,
  actualViewport: Viewport,
): void {
  // ADR-470 — φιλτράρουμε ΠΡΙΝ χτιστεί το merged silhouette ώστε ο σοβάς να
  // σέβεται (α) το per-element plaster override και (β) το ενεργό υψόμετρο τομής
  // (cut-plane parity με το σώμα). View-level OFF + κανένα override ⇒ visible=[]
  // ⇒ silhouette null ⇒ no-op (ίδιο με το προηγούμενο early-return).
  const _finishBim = useBimRenderSettingsStore.getState();
  const _finishVisible = entities.filter((e) =>
    isStructuralComponentVisible('plaster', e) &&
    !isHiddenByCutPlane(e, _finishBim.viewRange, _finishBim.cutPlaneActive),
  );
  const silhouette = buildStructuralFinishSilhouette2D(_finishVisible);
  if (!silhouette) return;
  const worldToScreen = (p: Point2D): Point2D =>
    CoordinateTransforms.worldToScreen(p, transform, actualViewport);
  for (const band of silhouette.bands) {
    drawStructuralFinishOutline(ctx, band.faces, silhouette.sceneUnits, worldToScreen);
  }
}
