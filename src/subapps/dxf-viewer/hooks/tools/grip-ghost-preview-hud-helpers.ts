/**
 * GRIP GHOST PREVIEW — live member grip HUD painter
 *
 * The «λευκές ενδείξεις» (Revit temporary-dimensions parity) drawn in the SAME
 * frame/RAF as the grip ghost while dragging a wall / column / polygonal BIM
 * member / polyline / plain line handle. Extracted from
 * `grip-ghost-preview-draw-helpers` (file-size SRP split, N.7.1) — this is one
 * self-contained responsibility (live dimension HUD) distinct from the ghost /
 * arc / finish-skin renderers, and it owns its own painter/formatter imports.
 *
 * @module hooks/tools/grip-ghost-preview-hud-helpers
 * @see hooks/tools/grip-ghost-preview-draw-helpers — re-exports `drawMemberGripHud`
 * @see ADR-508 §wall-hud / §column-hud / §polygon-hud / §line-hud
 * @see ADR-040 — Preview Canvas Performance (pure draw, μηδέν subscriptions)
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isLineEntity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfGripDragPreview } from '../grip-computation';
import type { SceneUnits } from '../../utils/scene-units';
import type { WallEntity } from '../../bim/types/wall-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import { buildSegmentHudMeta, paintWallHud } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import { paintColumnHud } from '../../canvas-v2/preview-canvas/column-hud-paint';
// ADR-537/561/508 — polyline HUD-segment selection (which incident segment(s) change length) lives
// in the SHARED 2D↔3D SSoT; this helper is a thin adapter (`dp`→role).
import { resolvePolylineHudSegments, resolveHatchHudSegments, type GripAlignmentRole, type GripAlignmentEntityView } from '../../systems/grip/grip-drag-alignment-role';
// ADR-508 §polygon-hud (Giorgio 2026-07-06) — ordered polygon-footprint corners (ΕΝΑ characteristic SSoT,
// καλύπτει slab/opening/roof/floor-finish/thermal/mep-underfloor) για τις live περιμετρικές διαστάσεις
// ΚΑΘΕ πολυγωνικής BIM οντότητας κατά το reshape λαβής.
import { getBimCharacteristicPointsOfCategory } from '../../bim/utils/bim-characteristic-points';
// ADR-612 §resize-hud — opening-info-tag box edges via its own geometry SSoT (μηδέν νέα γεωμετρία).
import { computeOpeningInfoTagGeometry } from '../../bim/opening-info-tag/opening-info-tag-geometry';
import type { OpeningInfoTagEntity } from '../../types/opening-info-tag';
// ADR-654 §resize-hud — raster image box edges via το ΚΟΙΝΟ rotation-aware vertex SSoT (μηδέν clone).
import { imageEntityRectVertices, type ImageRectShape } from '../../rendering/entities/shared/image-rect-vertices';
import { buildWallHudSpecLabel } from '../drawing/wall-hud-spec-label';
import { buildColumnHudSpecLabel } from '../drawing/column-hud-spec-label';
import { gripKindOf } from '../grip-kinds';

/**
 * ADR-508 §wall-hud/§column-hud — grip kinds ΧΩΡΙΣ live HUD (καθαρή μετακίνηση / περιστροφή που έχει
 * δική της ένδειξη). Οι λαβές reshape (edge, παρειά, ΚΑΙ κορυφή `*-poly-vertex-*`) ΔΕΝ εξαιρούνται —
 * όλες δείχνουν τις περιμετρικές διαστάσεις (Giorgio 2026-07-06, καθολική parity).
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
 * Σε ΟΛΕΣ τις λαβές reshape — edge/παρειά/ΚΟΡΥΦΗ (skip μόνο move/rotate). No-op σε μηδενική αλλαγή (`changed=false`).
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
  const wallKind = gripKindOf(dp, 'wall');
  if (wallKind && !MEMBER_HUD_SKIP.has(wallKind) && type === 'wall') {
    const w = transformed as unknown as WallEntity;
    const meta = buildSegmentHudMeta(w.params.start, w.params.end, sceneUnits, w.params.thickness, w.params.height);
    paintWallHud(ctx, meta, buildWallHudSpecLabel(meta), t, vp);
    return;
  }
  const columnKind = gripKindOf(dp, 'column');
  if (
    columnKind && !MEMBER_HUD_SKIP.has(columnKind) && type === 'column'
  ) {
    // ADR-508 §column-hud (Giorgio 2026-07-06) — ΚΑΙ το σύρσιμο ΚΟΡΥΦΗΣ (`column-poly-vertex-*`)
    // δείχνει πλέον τις ΙΔΙΕΣ περιμετρικές λευκές ενδείξεις με το σύρσιμο ΜΕΣΑΙΑΣ ΛΑΒΗΣ ΠΛΕΥΡΑΣ
    // (Revit temporary-dimensions parity — καθολικά σε ΟΛΕΣ τις λαβές reshape). Το ghost footprint
    // είναι ήδη ενημερωμένο (`applyColumnGripDrag`→`computeColumnGeometry`), οπότε το `paintColumnHud`
    // δείχνει τις ΣΩΣΤΕΣ live διαστάσεις της αναδιαμορφωμένης διατομής. Move/rotate μένουν εκτός
    // (δικό τους overlay) μέσω του `MEMBER_HUD_SKIP`.
    const c = transformed as unknown as ColumnEntity;
    paintColumnHud(ctx, c.geometry.footprint.vertices, c.params, buildColumnHudSpecLabel(c.params.height), sceneUnits, t, vp);
    return;
  }
  // ADR-508 §polygon-hud (Giorgio 2026-07-06) — ΚΑΘΟΛΙΚΑ: ΚΑΘΕ πολυγωνική BIM οντότητα (πλάκα /
  // άνοιγμα πλάκας / άνοιγμα / στέγη / επένδυση δαπέδου / ενδοδαπέδια θέρμανση) δείχνει τις ΙΔΙΕΣ
  // περιμετρικές λευκές ενδείξεις (μήκος + ∠γωνία σε ΚΑΘΕ ακμή) κατά το σύρσιμο λαβής reshape —
  // ίδιο SSoT με polyline/wall/line (`buildSegmentHudMeta`+`paintWallHud`, `specLabel=''`: καθαρή
  // γεωμετρία, χωρίς το column-specific ύψος/Ø — η πλάκα δεν έχει rotation/ύψος). Το outline έρχεται
  // ordered (polygon winding) από το ΕΝΑ characteristic-corner SSoT· το ghost το έχει ΗΔΗ ενημερώσει
  // (`apply*GripDrag`→`compute*Geometry`). Move/rotate εξαιρούνται (`!movesEntity`/`!rotatePivot` —
  // έχουν δικό τους overlay). Η κολόνα πιάνεται πάνω (richer HUD)· η γραμμή/polyline κάτω.
  if (
    (gripKindOf(dp, 'slab') || gripKindOf(dp, 'slab-opening') || gripKindOf(dp, 'opening') ||
      gripKindOf(dp, 'roof') || gripKindOf(dp, 'floor-finish') || gripKindOf(dp, 'mep-underfloor')) &&
    !dp.movesEntity && !dp.rotatePivot
  ) {
    const outline = getBimCharacteristicPointsOfCategory(transformed as unknown as Entity, 'corner');
    const n = outline.length;
    if (n >= 2) {
      for (let i = 0; i < n; i++) {
        paintWallHud(ctx, buildSegmentHudMeta(outline[i], outline[(i + 1) % n], sceneUnits), '', t, vp);
      }
    }
    return;
  }
  // ADR-612 §resize-hud (Giorgio 2026-07-09 «όπως ο τοίχος») — opening-info-tag SIZE grip: λευκές
  // περιμετρικές ενδείξεις (μήκος + ∠γωνία) στις 4 ακμές του κουτιού κατά το resize, ΙΔΙΟ SSoT με
  // polygon/wall/line (`buildSegmentHudMeta`+`paintWallHud`, `specLabel=''` — annotation χωρίς BIM
  // ταυτότητα). ΜΟΝΟ η λαβή μεγέθους· move/rotation έχουν δικό τους overlay (clearance / rotation arc).
  // Το ghost `transformed` είναι ΗΔΗ ενημερωμένο (`applyOpeningInfoTagGripDrag`→worldCorners) → WYSIWYG.
  if (type === 'opening-info-tag' && gripKindOf(dp, 'opening-info-tag') === 'opening-info-tag-size') {
    const c = computeOpeningInfoTagGeometry(transformed as unknown as OpeningInfoTagEntity).worldCorners;
    for (let i = 0; i < c.length; i++) {
      paintWallHud(ctx, buildSegmentHudMeta(c[i], c[(i + 1) % c.length], sceneUnits), '', t, vp);
    }
    return;
  }
  // ADR-654 §resize-hud (Giorgio 2026-07-14 «όπως ο τοίχος») — raster image / entourage sprite: λευκές
  // περιμετρικές ενδείξεις (μήκος + ∠γωνία) στις 4 ακμές του κουτιού κατά το resize (γωνίες + μεσοπλευρικές),
  // ΙΔΙΟ SSoT με polygon/wall/line/opening-info-tag (`buildSegmentHudMeta`+`paintWallHud`, `specLabel=''` —
  // sprite χωρίς BIM ταυτότητα). Move/rotation εξαιρούνται (`!movesEntity`/`!rotatePivot` — δικό τους overlay:
  // clearance / rotation arc). Οι 4 γωνίες από το ΚΟΙΝΟ rotation-aware `imageEntityRectVertices` του ghost
  // `transformed` (ΗΔΗ ενημερωμένο από `applyImageGripDrag`) → WYSIWYG μήκος/γωνία.
  if (type === 'image' && !dp.movesEntity && !dp.rotatePivot) {
    const c = imageEntityRectVertices(transformed as unknown as ImageRectShape);
    if (c) {
      for (let i = 0; i < c.length; i++) {
        paintWallHud(ctx, buildSegmentHudMeta(c[i], c[(i + 1) % c.length], sceneUnits), '', t, vp);
      }
    }
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
    const poly = transformed as unknown as { vertices: Point2D[]; closed: boolean; bulges?: number[] };
    // ADR-508/561 (Giorgio 2026-07-06) — «λαβές των μέσων»: σύρσιμο ΜΕΣΗΣ λαβής ευθύγραμμης πλευράς
    // ολισθαίνει ΟΛΟ το σκέλος (και τις 2 κορυφές του) → λευκές ενδείξεις σε ΚΑΘΕ σκέλος που ακουμπά
    // στις κινούμενες κορυφές (το ίδιο + οι 2 γείτονες). Σύρσιμο ΚΟΡΥΦΗΣ → τα incident σκέλη της.
    // Επιλογή σκελών μέσω του ΚΟΙΝΟΥ 2D↔3D SSoT· η μέτρηση μήκους/γωνίας από ΤΟ reshaped `transformed`.
    const role: GripAlignmentRole = {
      movesEntity: false, // in the `!dp.movesEntity` branch above → always false (dead `=== true`)
      isRotation: dp.rotatePivot != null,
      gripIndex: dp.gripIndex,
      anchorPos: dp.anchorPos ?? null,
      edgeVertexIndices: dp.edgeVertexIndices,
    };
    const segments = resolvePolylineHudSegments(transformed as unknown as GripAlignmentEntityView, role);
    if (segments.length > 0) {
      for (const [a, b] of segments) {
        paintWallHud(ctx, buildSegmentHudMeta(poly.vertices[a], poly.vertices[b], sceneUnits), '', t, vp);
      }
      return;
    }
  }
  // ADR-627 §hatch-hud — hatch boundary VERTEX reshape parity με το περίγραμμα εμβαδού: κάθε ring
  // segment που αλλάζει μήκος παίρνει τις ΙΔΙΕΣ λευκές ενδείξεις (μήκος + ∠γωνία) μέσω του ΚΟΙΝΟΥ
  // `buildSegmentHudMeta`+`paintWallHud` (`specLabel=''` — το hatch δεν έχει BIM ταυτότητα). Τα ring
  // + vertex indices αποκωδικοποιούνται από το grip kind (`resolveHatchHudSegments`, closed ring →
  // reuse του polyline incident-segment SSoT)· η μέτρηση από το reshaped `transformed.boundaryPaths`
  // ghost (WYSIWYG). Move/rotation/gradient/edge-midpoint → null → κανένα HUD (δικό τους overlay).
  if (type === 'hatch' && !dp.movesEntity && !dp.rotatePivot) {
    const role: GripAlignmentRole = {
      movesEntity: false, // in the `!dp.movesEntity` branch above → always false (dead `=== true`)
      isRotation: dp.rotatePivot != null,
      gripIndex: dp.gripIndex,
      anchorPos: dp.anchorPos ?? null,
      edgeVertexIndices: dp.edgeVertexIndices,
      hatchGripKind: gripKindOf(dp, 'hatch'),
    };
    const res = resolveHatchHudSegments(transformed as unknown as GripAlignmentEntityView, role);
    if (res) {
      const ring = (transformed as unknown as { boundaryPaths?: Point2D[][] }).boundaryPaths?.[res.pathIdx];
      if (ring) {
        for (const [a, b] of res.segments) {
          paintWallHud(ctx, buildSegmentHudMeta(ring[a], ring[b], sceneUnits), '', t, vp);
        }
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
  if (isLineEntity(asEntity) && gripKindOf(dp, 'line') !== 'line-rotation') {
    const meta = buildSegmentHudMeta(asEntity.start, asEntity.end, sceneUnits);
    paintWallHud(ctx, meta, '', t, vp);
  }
}
