/**
 * GRIP GHOST PREVIEW — pure draw helpers
 *
 * Self-contained canvas-drawing utilities used by `useGripGhostPreview`'s draw
 * callback: dashed rubber-band leaders, the move-distance readout leader, the
 * endpoint-reshape angle arc, the live gradient-origin marker, and the ADR-543
 * co-move partner ghosts. Extracted from `useGripGhostPreview` (file-size SRP
 * split) — these are stateless renderers, distinct from the hook orchestration.
 *
 * @module hooks/tools/grip-ghost-preview-draw-helpers
 * @see hooks/tools/useGripGhostPreview — the consuming hook
 * @see ADR-040 — Preview Canvas Performance
 * @see ADR-363 / ADR-507 / ADR-543 — the individual readout/co-move behaviours
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { AnySceneEntity, Entity, SceneLayer } from '../../types/entities';
import { isLineEntity, isPolylineEntity, isColumnEntity, isWallEntity } from '../../types/entities';
// ADR-357/397/561 — endpoint-reshape 🟢/🔴 direction arc: SAME centralized paint the wall
// rotation + line/polyline endpoint reshape share (signed swept angle, zero divergence).
import { paintDirectionArc } from '../../canvas-v2/preview-canvas/direction-arc-paint';
import { rotateSweepDegFromDirs } from '../grips/grip-projections';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { drawGhostEntity, GHOST_DEFAULTS } from '../../rendering/ghost';
// ADR-449 — the moving member body ghost renders through the REAL entity renderer (WYSIWYG),
// and a wall additionally re-forms its live join-miter (same SSoT as commit + resize).
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
import { applyJointMiterPreview } from '../../bim/walls/wall-joint-miter-preview';
import type { BimPreviewRenderer } from '../../canvas-v2/preview-canvas/bim-preview-render';
import type { ExtendedSceneEntity } from '../drawing/drawing-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// ADR-363 §5.6/§5.6b — live 🟠 warning outline όσο το grip-drag κρατά κολόνα σε σχέσεις τοιχίου (aspect>4)
// Ή τοιχίο σε ασυνήθιστο πάχος/μήκος.
import { detectColumnBecomesWall } from '../../bim/columns/column-aspect';
import { detectMemberExtentCrossing } from '../../bim/columns/shear-wall-extents';
// ADR-363 §5.6c — ΓΕΝΙΚΟ live 🟠 gate για ΟΛΟΥΣ τους τύπους (Γ/Τ/Π/Ι/πολύγωνο). Φθηνό (includeReinforcement
// default false) → ασφαλές για το 60fps hot-path (ADR-040): ΔΕΝ αγγίζει τον βαρύ suggester οπλισμού.
import { detectColumnRelationshipWarning } from '../../bim/columns/section-relationship-warning';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { buildCoincidentPartnerGhostEntities } from '../../systems/stretch/coincident-endpoint-comove';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
// ADR-449 — LIVE finish-skin (σοβάς) preview reuses the committed scene-level pass.
import { drawStructuralFinishSkin2D } from '../../canvas-v2/dxf-canvas/dxf-renderer-structural-overlays';
// ADR-508 §wall-hud / §column-hud — LIVE «λευκές ενδείξεις» τοίχου & κολόνας στο σύρσιμο λαβής, στο ΙΔΙΟ
// RAF/frame με το ghost (ΚΟΙΝΟΣ SSoT με τη σχεδίαση → σταθερές, μηδέν flicker/διπλότυπο).
import type { DxfGripDragPreview } from '../grip-computation';
import type { SceneUnits } from '../../utils/scene-units';
import type { WallEntity } from '../../bim/types/wall-types';
import type { ColumnEntity } from '../../bim/types/column-types';
// ADR-363 / ADR-572 Γ1 — leader dash+colour SSoT (μηδέν bespoke inline setLineDash/strokeStyle).
import { applyOverlayLeaderStyle } from '../../canvas-v2/preview-canvas/overlay-line-style';
import { buildSegmentHudMeta, paintWallHud } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import { paintColumnHud } from '../../canvas-v2/preview-canvas/column-hud-paint';
// ADR-508 §line-hud / ADR-561 — polyline vertex-reshape HUD: which incident segment(s) change length.
import { getPolylineVertexIncidentSegments } from '../../systems/polyline/polyline-grips';
// SSoT point interpolation (ADR-561 corner-arc nesting) — μηδέν inline lerp.
import { lerpPoint } from '../../rendering/entities/shared/geometry-utils';
import { buildWallHudSpecLabel } from '../drawing/wall-hud-spec-label';
import { buildColumnHudSpecLabel } from '../drawing/column-hud-spec-label';

// ── Constants ──────────────────────────────────────────────────────────────────

// ADR-363 leader dash ([6,4]) → SSoT token in overlay-line-style.ts (`OVERLAY_LEADER_DASH`).
// The discreet move-readout leader colour was removed with the pill (ADR-560, Giorgio 2026-07-04).

/** ADR-507 Φ5 A3b — half-size (CSS px) του live gradient-origin grip-marker (fixed on-screen). */
const GRADIENT_ORIGIN_MARKER_HALF_PX = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** ADR-363 Phase 1G.3 — draw one dashed world-space segment on the preview canvas. */
export function drawDashedSegment(
  ctx: CanvasRenderingContext2D,
  fromW: { x: number; y: number },
  toW: { x: number; y: number },
  transform: ViewTransform,
  vp: { width: number; height: number },
): void {
  const fromS = CoordinateTransforms.worldToScreen(fromW, transform, vp);
  const toS = CoordinateTransforms.worldToScreen(toW, transform, vp);
  ctx.save();
  // Rubber-band «κουμπώνει» στο ghost → χρώμα derived από GHOST_DEFAULTS.color (semantic), dash/width SSoT.
  applyOverlayLeaderStyle(ctx, GHOST_DEFAULTS.color);
  ctx.beginPath();
  ctx.moveTo(fromS.x, fromS.y);
  ctx.lineTo(toS.x, toS.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * ADR-357/397/561 — the SSoT «endpoint-reshape 🟢/🔴 direction arc». Given the FIXED pivot,
 * the ORIGINAL moved point and the NEW moved point, it derives the signed swept angle via the
 * shared `rotateSweepDegFromDirs` and paints the centralized `paintDirectionArc`. ONE glue for
 * BOTH the plain-line endpoint reshape AND the polyline endpoint-vertex reshape — they differ
 * only in how the fixed/moved points are picked, so the arc can never diverge between them.
 */
function paintEndpointReshapeArc(
  ctx: CanvasRenderingContext2D,
  fixedW: Point2D,
  origMovedW: Point2D,
  movedW: Point2D,
  t: ViewTransform,
  vp: Viewport,
): void {
  const refDir = { x: origMovedW.x - fixedW.x, y: origMovedW.y - fixedW.y };
  const curDir = { x: movedW.x - fixedW.x, y: movedW.y - fixedW.y };
  paintDirectionArc(ctx, fixedW, origMovedW, movedW, rotateSweepDegFromDirs(refDir, curDir), t, vp);
}

/**
 * ADR-357/397/561 — endpoint RESHAPE direction arc(s) for BOTH a plain line and an OPEN
 * polyline's true endpoint. Dragging such an endpoint pivots the single adjacent segment about
 * its ONE fixed neighbour → the SAME centralized 🟢/🔴 `paintDirectionArc` + live signed angle
 * the wall rotation uses. The two branches differ only in how the fixed/orig/moved points are
 * picked, so the arc can never diverge. No-op for move/hot-grip/rotation grips (handled
 * elsewhere) or interior/corner polyline vertices (two neighbours → no single pivot).
 *
 * For a JOINED SYSTEM (open polyline, n ≥ 3) reshaping a free endpoint draws TWO arcs at the join
 * (Giorgio 2026-07-05): (1) how far the moving leg SWUNG from its original orientation, and (2) the
 * live ANGLE between the moving (ghost) leg and the FIXED adjacent leg. Both reuse the ONE
 * `paintEndpointReshapeArc` (center + baseline ray + arrow ray) → zero new formula.
 */
export function paintGripEndpointReshapeArcs(
  ctx: CanvasRenderingContext2D,
  dp: DxfGripDragPreview,
  entity: Entity,
  transformed: Entity,
  t: ViewTransform,
  vp: Viewport,
): void {
  if (dp.movesEntity || dp.hotGrip || dp.rotatePivot || transformed === entity) return;

  if (isLineEntity(entity) && isLineEntity(transformed)) {
    const startMoved =
      transformed.start.x !== entity.start.x || transformed.start.y !== entity.start.y;
    const fixedW = startMoved ? transformed.end : transformed.start;
    const movedW = startMoved ? transformed.start : transformed.end;
    const origMovedW = startMoved ? entity.start : entity.end;
    paintEndpointReshapeArc(ctx, fixedW, origMovedW, movedW, t, vp);
    return;
  }

  if (isPolylineEntity(entity) && isPolylineEntity(transformed)) {
    const oPoly = entity as unknown as { vertices: Point2D[]; closed: boolean };
    const tPoly = transformed as unknown as { vertices: Point2D[] };
    const i = dp.gripIndex;
    const n = oPoly.vertices.length;
    const isOpenEndpoint = !oPoly.closed && n >= 2 && (i === 0 || i === n - 1);
    if (isOpenEndpoint && i < tPoly.vertices.length) {
      // Σημείο ένωσης (pivot) = ο σταθερός γείτονας γύρω από τον οποίο περιστρέφεται το κινούμενο σκέλος.
      const pivotW = i === 0 ? oPoly.vertices[1] : oPoly.vertices[n - 2];
      const movedW = tPoly.vertices[i];
      // (1) ΤΟΞΟ ΣΤΡΟΦΗΣ: πόσο στράφηκε το κινούμενο σκέλος από την ΑΡΧΙΚΗ του θέση (baseline)
      // στο φάντασμα (arrow) — αμετάβλητη υπάρχουσα ένδειξη.
      paintEndpointReshapeArc(ctx, pivotW, oPoly.vertices[i], movedW, t, vp);
      // (2) ΤΟΞΟ ΓΩΝΙΑΣ ΓΩΝΙΑΣ (Giorgio 2026-07-05): δεύτερο 🟢/🔴 ζεύγος στο ΙΔΙΟ σημείο ένωσης που
      // δείχνει τη ζωντανή γωνία ΑΝΑΜΕΣΑ στο ΣΤΑΘΕΡΟ γειτονικό σκέλος και το κινούμενο (φάντασμα) σκέλος.
      // ΙΔΙΟ SSoT helper (μηδέν νέα formula): center=σημείο ένωσης, baseline=σταθερό σκέλος (pivot→fixedEnd),
      // ΒΕΛΟΣ→φάντασμα σκέλος (pivot→moved) (Giorgio 2026-07-05: «βέλος προς το φάντασμα»). Το σταθερό σκέλος
      // υπάρχει μόνο όταν το σημείο ένωσης έχει κι άλλον γείτονα πέρα από το κινούμενο (n ≥ 3 — αλλιώς είναι
      // μεμονωμένη γραμμή αποθηκευμένη ως polyline, καμία γωνία γωνίας). Το σταθερό σκέλος διαβάζεται από τα
      // ΑΡΧΙΚΑ vertices (δεν μετακινείται).
      //
      // Επειδή ΚΑΙ το τόξο στροφής ΚΑΙ αυτό τελειώνουν στο φάντασμα σκέλος, θα είχαν ΙΔΙΑ ακτίνα (=μήκος
      // κινούμενου σκέλους) → στοιβαγμένα βελάκια. Το φωλιάζουμε σε μικρότερη ΟΜΟΚΕΝΤΡΗ ακτίνα δίνοντας ένα
      // arrow-σημείο πάνω στην ΙΔΙΑ ακτίνα «φαντάσματος» αλλά πιο κοντά στο pivot: ίδια φορά/γωνία/χρώμα
      // (η κατεύθυνση δεν αλλάζει → το `rotateSweepDegFromDirs` δίνει την ίδια γωνία), απλώς πιο μέσα.
      const fixedIdx = i === 0 ? 2 : n - 3;
      if (fixedIdx >= 0 && fixedIdx < n) {
        // ΟΜΟΚΕΝΤΡΗ ακτίνα: σημείο στο 62% της ακτίνας «φαντάσματος» (κοινό `lerpPoint` SSoT, μηδέν
        // inline lerp) ώστε το τόξο γωνίας να φωλιάζει μέσα από το τόξο στροφής — ίδια φορά/γωνία/χρώμα,
        // απλώς πιο κοντά στο pivot. Local const → self-contained για Fast-Refresh safety.
        const cornerArcRadiusScale = 0.62;
        const nestedArrowW = lerpPoint(pivotW, movedW, cornerArcRadiusScale);
        paintEndpointReshapeArc(ctx, pivotW, oPoly.vertices[fixedIdx], nestedArrowW, t, vp);
      }
    }
  }
}

/**
 * ADR-507 Φ5 A3b — live gradient-origin grip-marker. Ζωγραφίζει το «τετράγωνο» της λαβής
 * στη ΖΩΝΤΑΝΗ θέση (κέρσορας) στο preview canvas, full-opacity, ώστε να ΑΚΟΛΟΥΘΕΙ ορατά το
 * drag (το committed grip κρύβεται από το main canvas — `HatchRenderer.getGrips`). Ghost-cyan
 * γέμισμα + λευκό περίγραμμα = «η λαβή που σέρνεις», fixed on-screen size σε κάθε zoom.
 */
export function drawGradientOriginMarker(ctx: CanvasRenderingContext2D, screenPt: { x: number; y: number }): void {
  const h = GRADIENT_ORIGIN_MARKER_HALF_PX;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = GHOST_DEFAULTS.color;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(screenPt.x - h, screenPt.y - h, h * 2, h * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * ADR-543 — articulated joint: when a single line endpoint is reshaped and another selected
 * line shares that endpoint, draw the partner line(s) reshaping by the same delta (live preview
 * matching the co-move commit). The `startMoved === endMoved` guard keeps this to single-endpoint
 * reshapes only (excludes whole-entity move where both ends shift, and zero-delta). Reuses the
 * SSoT `buildCoincidentPartnerGhostEntities` so the preview geometry equals the commit.
 */
export function drawComovePartnerGhosts(
  ctx: CanvasRenderingContext2D,
  origEntity: Entity,
  transformed: Entity,
  getEntity: (id: string) => Entity | undefined,
  t: ViewTransform,
  vp: { width: number; height: number },
): void {
  if (!isLineEntity(origEntity) || !isLineEntity(transformed)) return;
  const startMoved = transformed.start.x !== origEntity.start.x || transformed.start.y !== origEntity.start.y;
  const endMoved = transformed.end.x !== origEntity.end.x || transformed.end.y !== origEntity.end.y;
  if (startMoved === endMoved) return; // both (whole move) or neither (idle) → not a single-endpoint reshape
  const kind = startMoved ? 'line-start' : 'line-end';
  const origMoved = startMoved ? origEntity.start : origEntity.end;
  const newMoved = startMoved ? transformed.start : transformed.end;
  const ghosts = buildCoincidentPartnerGhostEntities({
    draggedEntity: origEntity,
    draggedRefs: [{ entityId: origEntity.id, kind }],
    selectedEntityIds: SelectedEntitiesStore.getSelectedEntityIds(),
    getEntity,
    delta: { x: newMoved.x - origMoved.x, y: newMoved.y - origMoved.y },
  });
  for (const ghost of ghosts) {
    drawGhostEntity(ctx, ghost as unknown as DxfEntityUnion, t, vp);
  }
}

/**
 * ADR-363 §5.6/§5.6b/§5.6c — LIVE 🟠 warning outline κατά το grip-drag κολόνας/τοιχίου: ζωγραφίζει το
 * περίγραμμα του φαντάσματος **πορτοκαλί** (ΟΧΙ κόκκινο — δεν είναι απαγορευτικό, απλώς προειδοποιεί)
 * όταν το τραβηγμένο σχήμα:
 *   §5.6  — ορθογώνια κολόνα περνά το κατώφλι κολόνα→τοιχίο (rounded aspect > 4, EC2 §9.6.1), ή
 *   §5.6b — τοιχίο ξεπερνά ασυνήθιστο πάχος (>1.5m) / μήκος (>30m), ή
 *   §5.6c — ΟΠΟΙΟΣΔΗΠΟΤΕ τύπος (Γ/Τ/Π/Ι/πολύγωνο/σύνθετη/τοιχίο) εισάγει νέα παραβίαση «σχέσης»
 *           διατομής (γεωμετρική εκφύλιση / λυγηρότητα — φθηνό gate, ΧΩΡΙΣ οπλισμό, ADR-040 hot-path safe).
 * Μένει όσο ισχύει η υπέρβαση· χάνεται μόλις επανέλθει στο τυπικό. Ταυτίζεται με τα dialog-on-release
 * (ΙΔΙΑ gates· το §5.6c ghost χρησιμοποιεί το φθηνό subset — ο πλήρης έλεγχος-incl-οπλισμό ζει στο dialog).
 * Πάνω από το body ghost.
 */
export function drawColumnAspectWallWarning(
  ctx: CanvasRenderingContext2D,
  original: Entity,
  transformed: Entity,
  t: ViewTransform,
  vp: { width: number; height: number },
): void {
  if (!isColumnEntity(original) || !isColumnEntity(transformed)) return;
  const warn =
    detectColumnBecomesWall(original.params, transformed.params) !== null ||
    detectMemberExtentCrossing(original.params, transformed.params) !== null ||
    detectColumnRelationshipWarning(original.params, transformed.params) !== null;
  if (!warn) return;
  const verts = transformed.geometry?.footprint?.vertices ?? [];
  if (verts.length < 2) return;
  const color = resolveGhostStatusColor('warning');
  if (!color) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.strokeStyle = color.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const first = CoordinateTransforms.worldToScreen(verts[0], t, vp);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < verts.length; i++) {
    const p = CoordinateTransforms.worldToScreen(verts[i], t, vp);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/**
 * ADR-449 — pure entity list for the live finish-skin (σοβάς) preview: the full scene with
 * the dragged wall (and its live-mitered neighbours) swapped for their PREVIEW versions, so
 * the merged plaster silhouette re-forms around the wall's NEW position. The silhouette is
 * scene-wide (exterior/interior classifier + union with stationary walls), so we must feed the
 * whole scene — not just the moving wall — with only the affected entities replaced by id.
 */
export function buildFinishSkinPreviewEntities<E extends { readonly id: string }>(
  sceneEntities: readonly E[],
  ghostWall: E,
  neighbours: readonly E[],
): E[] {
  const byId = new Map<string, E>();
  byId.set(ghostWall.id, ghostWall);
  for (const n of neighbours) byId.set(n.id, n);
  return buildFinishSkinPreviewEntitiesFromSwaps(sceneEntities, byId);
}

/**
 * ADR-449 — swap-map variant of {@link buildFinishSkinPreviewEntities} for a MULTI-member
 * drag (body-drag can move several BIM members at once): replace every scene entity whose id
 * is in `swaps` (dragged members + their mitered neighbours) with its preview version, keeping
 * stationary entities by reference. One unified preview scene → ONE merged silhouette pass.
 */
export function buildFinishSkinPreviewEntitiesFromSwaps<E extends { readonly id: string }>(
  sceneEntities: readonly E[],
  swaps: ReadonlyMap<string, E>,
): E[] {
  return sceneEntities.map((e) => swaps.get(e.id) ?? e);
}

/** ADR-449 — structural member types that carry a finish-skin (σοβάς): wall / column / beam. */
const STRUCTURAL_FINISH_MEMBER_TYPES: ReadonlySet<string> = new Set(['wall', 'column', 'beam']);

/** ADR-449 — true when the dragged entity type carries a finish-skin (gate for the σοβά preview). */
export function isStructuralFinishMember(type: string | undefined): boolean {
  return type !== undefined && STRUCTURAL_FINISH_MEMBER_TYPES.has(type);
}

/**
 * ADR-449 / ADR-363 — LIVE finish-skin (σοβάς) preview while moving/rotating/resizing a
 * structural member (WALL / COLUMN / BEAM).
 *
 * Ζητούμενο (Giorgio): με ενεργή τη «Σοβατισμένη όψη», κατά την επεξεργασία δομικού μέλους η
 * προεπισκόπηση να δείχνει και τον σοβά live — πώς ακριβώς θα τυλίγει τη ΝΕΑ θέση στο επόμενο κλικ.
 * (Αρχικά μόνο τοίχος· επεκτάθηκε σε κολώνα/δοκάρι — ίδιος SSoT μηχανισμός.)
 *
 * SSoT reuse (μηδέν νέα geometry): καλεί τον ΙΔΙΟ scene-level pass που ζωγραφίζει τον committed σοβά
 * (`drawStructuralFinishSkin2D`), τροφοδοτημένο με τη σκηνή όπου το dragged μέλος (+ οι mitered γείτονες
 * ενός τοίχου) είναι στη θέση προεπισκόπησης → το merged silhouette (`computeStructuralFinishSilhouette`)
 * ξαναχτίζεται στη νέα θέση. Ο κάθε τύπος τροφοδοτεί ήδη φρέσκο footprint στο ghost του
 * (`applyEntityPreview`: computeWallGeometry / computeColumnGeometry / beam outline). No-op όταν ο
 * διακόπτης σοβά είναι κλειστός (gate ανά στοιχείο). ADR-040: pure draw, μηδέν subscriptions. Καλείται
 * ΜΕΤΑ το σώμα-φάντασμα (mirror της committed σειράς).
 */
export function drawStructuralFinishSkinPreview(
  ctx: CanvasRenderingContext2D,
  sceneEntities: readonly { readonly id: string }[],
  ghostMember: DxfEntityUnion,
  neighbours: readonly { readonly id: string }[],
  t: ViewTransform,
  vp: { width: number; height: number },
): void {
  const preview = buildFinishSkinPreviewEntities<{ readonly id: string }>(sceneEntities, ghostMember, neighbours);
  drawStructuralFinishSkin2D(ctx, preview as unknown as readonly DxfEntityUnion[], t, vp);
}

/**
 * ADR-449 — MULTI-member variant of {@link drawStructuralFinishSkinPreview}: one unified merged
 * silhouette pass over the whole scene with EVERY dragged member (+ its mitered neighbours,
 * accumulated in `swaps`) swapped to its preview position. Used by the body-drag MOVE path where
 * several BIM members can move together — calling the single-member draw once per member would
 * paint the plaster N times with only one member displaced each time. No-op via the internal gate
 * when «Σοβατισμένη όψη» is off. ADR-040: pure draw.
 */
export function drawStructuralFinishSkinPreviewForSwaps(
  ctx: CanvasRenderingContext2D,
  sceneEntities: readonly { readonly id: string }[],
  swaps: ReadonlyMap<string, { readonly id: string }>,
  t: ViewTransform,
  vp: Viewport,
): void {
  const preview = buildFinishSkinPreviewEntitiesFromSwaps(sceneEntities, swaps);
  drawStructuralFinishSkin2D(ctx, preview as unknown as readonly DxfEntityUnion[], t, vp);
}

/** ADR-449 — the mitred ghost + neighbour ghosts a member body-preview drew (feed to the σοβά swap). */
export interface MemberGhostPreviewResult {
  /** The drawn member ghost — join-mitred for a wall, otherwise the input `transformed`. */
  readonly ghost: DxfEntityUnion;
  /** Mitred neighbour wall ghosts already drawn underneath — also part of the finish-skin swap. */
  readonly neighbours: readonly ExtendedSceneEntity[];
}

/**
 * ADR-363 §wall-joint-miter-preview / ADR-550 — draw ONE moving structural-member body ghost through
 * the REAL entity renderer (WYSIWYG), re-forming a wall's LIVE join-miter against the scene first
 * (same `applyJointMiterPreview` SSoT as commit): affected neighbours are drawn mitered UNDERNEATH,
 * then the (possibly mitred) member ghost on top. Columns/beams have no join → drawn as-is.
 *
 * Shared by BOTH the grip-resize path (`useGripGhostPreview`) and the body-drag MOVE path
 * (`useEntityBodyDragPreview`) so the moving ghost — and the finish-skin silhouette fed from its
 * returned ghost+neighbours — cannot diverge between the two gestures. ADR-040: pure draw.
 */
export function drawMemberBodyGhostWithJoinMiter(
  bimPreview: BimPreviewRenderer,
  transformed: DxfEntityUnion,
  sceneEntities: readonly AnySceneEntity[],
  sceneUnits: SceneUnits,
  layersById: Record<string, SceneLayer> | undefined,
  t: ViewTransform,
  vp: Viewport,
): MemberGhostPreviewResult {
  let ghost = transformed;
  let neighbours: readonly ExtendedSceneEntity[] = [];
  if ((transformed as { type?: string }).type === 'wall') {
    const wallsForJoin = sceneEntities.filter(isWallEntity);
    const columnFootprintsForJoin = sceneEntities
      .filter(isColumnEntity)
      .map((c) => c.geometry.footprint.vertices);
    const augmented = applyJointMiterPreview(
      transformed as unknown as ExtendedSceneEntity, wallsForJoin, columnFootprintsForJoin, sceneUnits,
    );
    if (augmented) {
      neighbours = (augmented as { jointNeighbors?: readonly ExtendedSceneEntity[] }).jointNeighbors ?? [];
      for (const n of neighbours) {
        drawRealEntityPreview(bimPreview, n as unknown as DxfEntityUnion, layersById, t, vp);
      }
      ghost = augmented as unknown as DxfEntityUnion;
    }
  }
  drawRealEntityPreview(bimPreview, ghost, layersById, t, vp);
  return { ghost, neighbours };
}

/**
 * ADR-508 §wall-hud/§column-hud — grip kinds ΧΩΡΙΣ live HUD (καθαρή μετακίνηση / περιστροφή που έχει
 * δική της ένδειξη). Τα `*-poly-vertex-*` (free-form) εξαιρούνται χωριστά (startsWith).
 */
const MEMBER_HUD_SKIP: ReadonlySet<string> = new Set([
  'wall-midpoint', 'wall-rotation', 'column-center', 'column-rotation',
]);

/**
 * ADR-508 §wall-hud/§column-hud — LIVE «λευκές ενδείξεις» ΤΟΙΧΟΥ ή ΚΟΛΟΝΑΣ κατά το σύρσιμο λαβής,
 * ζωγραφισμένες στο **ΙΔΙΟ frame/RAF** με το grip ghost (ο caller το καλεί ΜΕΤΑ το ghost draw) → ΣΤΑΘΕΡΕΣ,
 * χωρίς race με ξεχωριστό leaf. **FULL SSoT** — ΙΔΙΟΙ painters/formatters με τη σχεδίαση:
 *   · τοίχος → `buildSegmentHudMeta` + `paintWallHud` (μήκος/γωνία/πάχος·ύψος)·
 *   · κολόνα (ΟΛΟΙ οι τύποι) → `paintColumnHud` (ορθογ./τοιχίο: παρειές· κύκλος: Ø· πολύγωνο: Ø+N·
 *     Γ/Τ/Π/Ι/σύνθετο: aligned δ. ανά ακμή· + ∠γωνία + ύψος). Το per-sub-dim pill αποσύρθηκε.
 * Μόνο σε λαβές αλλαγής διαστάσεων (skip move/rotate/poly-vertex). No-op σε μηδενική αλλαγή (`changed=false`).
 */
export function drawMemberGripHud(
  ctx: CanvasRenderingContext2D,
  dp: DxfGripDragPreview,
  transformed: DxfEntityUnion,
  changed: boolean,
  sceneUnits: SceneUnits,
  t: ViewTransform,
  vp: { width: number; height: number },
): void {
  if (!changed) return;
  const type = (transformed as { type?: string }).type;
  if (dp.wallGripKind && !MEMBER_HUD_SKIP.has(dp.wallGripKind) && type === 'wall') {
    const w = transformed as unknown as WallEntity;
    const meta = buildSegmentHudMeta(w.params.start, w.params.end, sceneUnits, w.params.thickness, w.params.height);
    paintWallHud(ctx, meta, buildWallHudSpecLabel(meta), t, vp);
    return;
  }
  if (
    dp.columnGripKind && !MEMBER_HUD_SKIP.has(dp.columnGripKind) &&
    !dp.columnGripKind.startsWith('column-poly-vertex-') && type === 'column'
  ) {
    const c = transformed as unknown as ColumnEntity;
    paintColumnHud(ctx, c.geometry.footprint.vertices, c.params, buildColumnHudSpecLabel(c.params.height), sceneUnits, t, vp);
    return;
  }
  // ADR-508 §line-hud / ADR-561 — ΕΝΩΜΕΝΟ ΣΥΣΤΗΜΑ (polyline) vertex-reshape parity με τη ΜΕΜΟΝΩΜΕΝΗ
  // γραμμή: όταν σέρνεις κορυφή (π.χ. το άκρο ενός σκέλους 2 ενωμένων γραμμών), ΚΑΘΕ σκέλος που αλλάζει
  // μήκος παίρνει τις ΙΔΙΕΣ λευκές ενδείξεις (μήκος + ∠γωνία) μέσω του ΚΟΙΝΟΥ `buildSegmentHudMeta`+
  // `paintWallHud` (`specLabel=''` — η γραμμή/polyline δεν έχει BIM ταυτότητα). Endpoint → 1 σκέλος,
  // γωνιακή/εσωτερική κορυφή → 2 σκέλη (Revit temporary-dimensions parity, Giorgio 2026-07-05).
  //
  // ⚠️ Το κλείδωμα γίνεται στο `dp.gripIndex` (ΟΧΙ στο `polylineGripKind`): το vertex-reshape path
  // (`buildDxfDragPreview`) ΔΕΝ προωθεί `polylineGripKind` στο `dp` (μόνο το rotation path το κάνει) →
  // ένα guard πάνω σε αυτό δεν κουμπώνει ΠΟΤΕ. Ίδιο proven pattern με τα polyline sibling overlays
  // (`paintGripEndpointReshapeArcs` arc + `getPolylineGripAlignmentAnchors` traces): `isPolylineEntity`
  // + `gripIndex`. Οι λαβές whole-entity move/rotation εξαιρούνται από τον έλεγχο `!movesEntity`/
  // `!rotatePivot` ΚΑΙ επειδή το `gripIndex` τους είναι ≥ vertexCount → `getPolylineVertexIncidentSegments`
  // επιστρέφει []. Το `transformed` είναι ΗΔΗ 'polyline' (`normalizePreviewEntity`, ADR-561) με
  // post-reshape vertices → WYSIWYG μήκος/γωνία.
  if (type === 'polyline' && !dp.movesEntity && !dp.rotatePivot) {
    const poly = transformed as unknown as { vertices: Point2D[]; closed: boolean };
    const segments = getPolylineVertexIncidentSegments(dp.gripIndex, poly.vertices.length, poly.closed);
    if (segments.length > 0) {
      for (const [a, b] of segments) {
        paintWallHud(ctx, buildSegmentHudMeta(poly.vertices[a], poly.vertices[b], sceneUnits), '', t, vp);
      }
      return;
    }
  }
  // ADR-508 §line-hud / ADR-363 Slice F/G — plain DXF LINE parity με τον τοίχο (Giorgio 2026-07-04
  // «όταν σέρνω άκρο ή μέσο της γραμμής, γωνία+μήκος ΑΚΡΙΒΩΣ όπως ο τοίχος»): endpoint reshape
  // (grip 0/1) + midpoint/MOVE-cross (grip 2/4) δείχνουν την ΙΔΙΑ aligned διάσταση μήκους + ∠γωνία,
  // μέσω του ΚΟΙΝΟΥ `buildSegmentHudMeta`+`paintWallHud`. Η γραμμή δεν έχει BIM ταυτότητα → `specLabel=''`
  // (μόνο μήκος+γωνία, χωρίς πάχος/ύψος). Η λαβή περιστροφής (`line-rotation`) εξαιρείται — έχει το δικό
  // της arc/polar overlay (mirror του `wall-rotation` skip). N.11-clean: κενό label, καμία μετάφραση εδώ.
  const asEntity = transformed as unknown as Entity;
  if (isLineEntity(asEntity) && dp.lineGripKind !== 'line-rotation') {
    const meta = buildSegmentHudMeta(asEntity.start, asEntity.end, sceneUnits);
    paintWallHud(ctx, meta, '', t, vp);
  }
}
