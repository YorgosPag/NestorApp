/**
 * ADR-363 Phase 2b — Polygon-backed column per-vertex grip handlers
 * (U-shape «από περίγραμμα» + composite).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Provides the
 * per-vertex editing path for polygon-backed cross-sections, mirror του
 * `bim/slabs/slab-grips.ts` outline-vertex pattern. The base width/depth grips
 * are NO-OPs for polygon-backed kinds (`buildUshapeLocal`/`buildCompositeLocal`
 * ignore width/depth when a polygon is present), so each polygon vertex gets its
 * own grip instead (the vertex index travels encoded in the `column-poly-vertex-
 * ${n}` grip-kind string — see `hooks/grip-types.ts`).
 *
 * SSoT:
 *   - Geometry math via `computeColumnGeometry()` (called by
 *     `UpdateColumnParamsCommand` at commit time — this module returns ONLY new
 *     `ColumnParams`).
 *   - World ↔ local frame primitives από `column-grip-utils.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 2b
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { GripInfo } from '../../hooks/useGripMovement';
import {
  columnCenterMoveGrip,
  columnRotationHandleMidwayWorld,
  localToWorld,
  polygonBackedBboxMm,
  projectDeltaToLocal,
  rotate,
  rotationHandleWorld,
} from './column-grip-utils';
import { mmScaleFor } from '../../utils/scene-units';
import { computeColumnGeometry, materializeColumnLocalPolygonMm } from '../geometry/column-geometry';
import {
  interiorAnchorPoint,
  interiorAnchorPointWithClearance,
} from '../geometry/shared/polygon-interior-point';
import type { ColumnGripDragInput } from './column-grips';

/**
 * Το ακριβές polygon (LOCAL mm, bbox-centered, CCW) ενός polygon-backed τοιχίου,
 * ή `undefined` αν το kind δεν είναι polygon-backed / λείπει το polygon.
 */
export function columnPolygon(params: ColumnParams): readonly Point2D[] | undefined {
  if (params.kind === 'U-shape') return params.ushape?.polygon;
  if (params.kind === 'composite') return params.composite?.polygon;
  return undefined;
}

/**
 * World position της κορυφής `index` ενός polygon-backed τοιχίου. `localToWorld`
 * εφαρμόζει centroid + rotation + scale (ADR-397), ίδιο SSoT με τη γεωμετρία.
 */
export function polyVertexHandlePosition(params: ColumnParams, index: number): Point2D {
  const poly = columnPolygon(params);
  if (!poly || index < 0 || index >= poly.length) return localToWorld({ x: 0, y: 0 }, params);
  return localToWorld(poly[index], params);
}

/**
 * ADR-363/449 + ADR-520 — world θέση της λαβής περιστροφής ενός free-reshape στοιχείου. Το
 * ΕΣΩΤΕΡΙΚΟ σημείο της διατομής (`interiorAnchorPoint`) φιλοξενεί πλέον τον **σταυρό μετακίνησης**
 * (ADR-520)· για να ΜΗΝ συμπίπτει η περιστροφή με τον σταυρό, μετατοπίζεται προς τα **κάτω** (local
 * −Y, mirror ορθογώνιας/πολυγωνικής `−depth/4`) κατά `min(depth/4, clearance·0.85)`. Το φράγμα από
 * την `clearance` εγγυάται ότι η λαβή μένει **μέσα στο σώμα** ακόμη και σε κοίλα Γ/Τ (ο εγγεγραμμένος
 * δίσκος ακτίνας clearance είναι όλος εντός). Params-pure ώστε emission ≡ drag (μηδέν jump).
 */
export function freeReshapeRotationWorld(params: ColumnParams): Point2D {
  const verts = computeColumnGeometry(params).footprint.vertices;
  if (verts.length < 3) return localToWorld({ x: 0, y: 0 }, params);
  const { point, clearance } = interiorAnchorPointWithClearance(verts);
  // ADR-520 — ΙΔΙΟ SSoT placement με rect/polygon (`columnRotationHandleMidwayWorld`), με base
  // το body-interior σημείο + clearance φράγμα ώστε να μένει μέσα στο κοίλο σώμα.
  return columnRotationHandleMidwayWorld(point, params.depth, params.rotation, mmScaleFor(params), clearance);
}

/**
 * Κοινό SSoT: δοθέντος του μετακινημένου polygon (LOCAL mm), re-center στο bbox-center,
 * compensate `position` κατά `rotate(center·s)` ώστε οι μη-θιγμένες κορυφές να μένουν στη
 * θέση τους (WYSIWYG, κάθε anchor), refresh `width`/`depth` = bbox (panel truthfulness), και
 * επιστροφή νέων params (composite ή U-shape, ανά kind). Geometry → `UpdateColumnParamsCommand`.
 * Χρησιμοποιείται ΚΑΙ από vertex-move (`resizePolyVertex`) ΚΑΙ από edge-move (`moveColumnEdgeFree`).
 */
function commitPolygonReshape(originalParams: ColumnParams, moved: readonly Point2D[]): ColumnParams {
  const s = mmScaleFor(originalParams);
  let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
  for (const p of moved) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const centered: Point2D[] = moved.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  const { dimX, dimY } = polygonBackedBboxMm(centered);
  const worldShift = rotate({ x: cx * s, y: cy * s }, originalParams.rotation);
  const next: ColumnParams = {
    ...originalParams,
    position: {
      x: originalParams.position.x + worldShift.x,
      y: originalParams.position.y + worldShift.y,
      z: originalParams.position.z ?? 0,
    },
    width: dimX,
    depth: dimY,
  };
  return originalParams.kind === 'composite'
    ? { ...next, composite: { polygon: centered } }
    : { ...next, ushape: { ...originalParams.ushape, polygon: centered } };
}

/**
 * Επιστρέφει params εγγυημένα **polygon-backed** + το polygon. Αν το kind είναι ήδη
 * polygon-backed (`composite`/`U-shape`+polygon) → ως έχει· αλλιώς (L/T/I/U-παραμετρικό/polygon)
 * **materialize** σε `composite` (custom profile, `materializeColumnLocalPolygonMm` — ΙΔΙΟ SSoT
 * με τη γεωμετρία). `null` αν degenerate (<3 κορυφές). Idempotent (drag-start originalParams).
 */
function ensurePolygonBacked(
  originalParams: ColumnParams,
): { params: ColumnParams; poly: readonly Point2D[] } | null {
  const existing = columnPolygon(originalParams);
  if (existing) return { params: originalParams, poly: existing };
  const polygon = materializeColumnLocalPolygonMm(originalParams);
  if (polygon.length < 3) return null;
  return { params: { ...originalParams, kind: 'composite', composite: { polygon } }, poly: polygon };
}

/**
 * Μετακίνηση μίας κορυφής polygon-backed διατομής (ADR-363 Phase 2b). Σέρνει ΜΟΝΟ τη
 * συγκεκριμένη κορυφή (οι υπόλοιπες μένουν οπτικά στη θέση τους). Non-polygon-backed /
 * out-of-range index: no-op. Recenter/commit μέσω του κοινού `commitPolygonReshape`.
 */
export function resizePolyVertex(
  input: Readonly<ColumnGripDragInput>,
  index: number,
): ColumnParams {
  const { originalParams, delta } = input;
  const poly = columnPolygon(originalParams);
  if (!poly || index < 0 || index >= poly.length) return originalParams;
  const s = mmScaleFor(originalParams);
  const { dxLocal, dyLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const moved: Point2D[] = poly.map((p, i) =>
    i === index ? { x: p.x + dxLocal / s, y: p.y + dyLocal / s } : { x: p.x, y: p.y },
  );
  return commitPolygonReshape(originalParams, moved);
}

/**
 * ADR-363/449 — **free per-corner reshape ΤΗΣ ΣΤΑΤΙΚΗΣ ΔΙΑΤΟΜΗΣ** οποιουδήποτε shaped column.
 * Όταν το kind είναι ήδη polygon-backed → `resizePolyVertex`. Αλλιώς **materialize** σε
 * `composite` (custom profile) ΠΡΙΝ τη μετακίνηση κορυφής — μηδέν νέα γεωμετρία· ο σοβάς (ADR-449)
 * ακολουθεί αυτόματα. Out-of-range index → no-op.
 */
export function reshapeColumnCornerFree(
  input: Readonly<ColumnGripDragInput>,
  index: number,
): ColumnParams {
  const backed = ensurePolygonBacked(input.originalParams);
  if (!backed || index < 0 || index >= backed.poly.length) return input.originalParams;
  return resizePolyVertex({ ...input, originalParams: backed.params }, index);
}

/**
 * ADR-363/449 — **μετακίνηση ΟΛΗΣ μιας πλευράς** της στατικής διατομής. Σέρνει ΚΑΙ τις δύο
 * κορυφές της ακμής `edgeIndex` (i, i+1) κατά το ΙΔΙΟ local delta → η πλευρά μετατοπίζεται
 * (παραμένει παράλληλη/ίδιου μήκους) και οι δύο γειτονικές ακμές προσαρμόζονται. Materialize σε
 * `composite` αν το kind είναι παραμετρικό (ίδιο pattern με το corner). Recenter μέσω
 * `commitPolygonReshape`. Out-of-range / degenerate → no-op. Ο σοβάς ακολουθεί αυτόματα.
 */
export function moveColumnEdgeFree(
  input: Readonly<ColumnGripDragInput>,
  edgeIndex: number,
): ColumnParams {
  const backed = ensurePolygonBacked(input.originalParams);
  if (!backed) return input.originalParams;
  const n = backed.poly.length;
  if (edgeIndex < 0 || edgeIndex >= n) return input.originalParams;
  const s = mmScaleFor(backed.params);
  const { dxLocal, dyLocal } = projectDeltaToLocal(input.delta, backed.params.rotation);
  const j = (edgeIndex + 1) % n;
  const moved: Point2D[] = backed.poly.map((p, i) =>
    i === edgeIndex || i === j ? { x: p.x + dxLocal / s, y: p.y + dyLocal / s } : { x: p.x, y: p.y },
  );
  return commitPolygonReshape(backed.params, moved);
}

/**
 * ADR-363/449 — grips για free reshape ΤΗΣ ΣΤΑΤΙΚΗΣ ΔΙΑΤΟΜΗΣ: rotation + ΜΙΑ λαβή ανά **κορυφή**
 * (corner reshape, `column-poly-vertex-${i}`) + ΜΙΑ λαβή στο **μέσο κάθε πλευράς** (move-whole-side,
 * `column-poly-edge-${i}`) του rendered footprint (`geometry.footprint.vertices`, world SSoT). Στο
 * σύρσιμο → composite. Αντικαθιστά τα παραμετρικά arm/width/depth grips (πλήρης έλεγχος γωνιών+πλευρών).
 */
export function freeCornerReshapeGrips(entity: Readonly<ColumnEntity>): GripInfo[] {
  // Προτίμησε το rendered footprint (SSoT)· fallback σε computeColumnGeometry όταν λείπει (robust
  // ανεξαρτήτως αν ο caller έχει γεμίσει το geometry cache).
  const verts = entity.geometry?.footprint?.vertices ?? computeColumnGeometry(entity.params).footprint.vertices;
  const n = verts.length;
  const grips: GripInfo[] = [];

  // ADR-520 — σταυρός μετακίνησης (4 αυτόνομα βελάκια) στο ΕΣΩΤΕΡΙΚΟ σημείο του σώματος
  // (όχι bbox-centre — για κοίλα Γ/Τ/composite μπορεί να πέσει στην εγκοπή). Reuse του ΚΟΙΝΟΥ
  // `columnCenterMoveGrip` SSoT (ίδιο με ορθογώνια/κυκλική/πολυγωνική)· περνά τη body-interior
  // θέση ως όρισμα. Όταν συγχωνεύονται κολόνες (→ composite) το σύμβολο μετακίνησης εμφανίζεται.
  if (n >= 3) {
    grips.push(columnCenterMoveGrip(entity, interiorAnchorPoint(verts)));
  }

  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    // ADR-363/449 + ADR-520 — λαβή περιστροφής σε ΕΣΩΤΕΡΙΚΟ σημείο, μετατοπισμένη προς τα κάτω
    // ώστε να ΜΗΝ συμπίπτει με τον σταυρό μετακίνησης (single SSoT `freeReshapeRotationWorld` →
    // emission ≡ drag, μηδέν jump). Φράγμα clearance → πάντα μέσα στο σώμα.
    position: n >= 3 ? freeReshapeRotationWorld(entity.params) : rotationHandleWorld(entity.params),
    movesEntity: false,
    columnGripKind: 'column-rotation',
  });
  grips.push(...perVertexAndEdgeGrips(entity, verts));
  return grips;
}

/**
 * ADR-518 — ΚΟΙΝΟ SSoT για τις λαβές **κορυφών + μέσων-πλευρών** ενός footprint (world κορυφές).
 * Μία λαβή ανά **κορυφή** (`column-poly-vertex-i`, reshape γωνίας) + μία λαβή στο **μέσο κάθε
 * πλευράς** (`column-poly-edge-i`, μετακίνηση όλης της πλευράς). Εξήχθη ώστε ΚΑΙ το
 * `freeCornerReshapeGrips` (L/T/U/composite) ΚΑΙ το `polygonReshapeGrips` (regular polygon) να
 * μοιράζονται ΕΝΑ σημείο εκπομπής — μηδέν διπλότυπο (N.0.2). Stable indices 10+i / 100+i.
 */
function perVertexAndEdgeGrips(
  entity: Readonly<ColumnEntity>,
  verts: readonly { readonly x: number; readonly y: number }[],
): GripInfo[] {
  const n = verts.length;
  const grips: GripInfo[] = [];
  verts.forEach((v, i) => {
    grips.push({
      entityId: entity.id,
      gripIndex: 10 + i,
      type: 'corner',
      position: { x: v.x, y: v.y },
      movesEntity: false,
      columnGripKind: `column-poly-vertex-${i}`,
    });
  });
  // ADR-363/449 — μέσο κάθε πλευράς: σύρσιμο μετακινεί ΟΛΗ την πλευρά (edge i = κορυφές i, i+1).
  verts.forEach((v, i) => {
    const w = verts[(i + 1) % n];
    grips.push({
      entityId: entity.id,
      gripIndex: 100 + i,
      type: 'edge',
      position: { x: (v.x + w.x) / 2, y: (v.y + w.y) / 2 },
      movesEntity: false,
      columnGripKind: `column-poly-edge-${i}`,
    });
  });
  return grips;
}

/**
 * ADR-518 — Πλήρες set λαβών **κανονικής πολυγωνικής** κολόνας (`kind === 'polygon'`), parity με
 * την ορθογώνια:
 *   0     → center MOVE (`column-center`, 4 ξεχωριστά βελάκια) — shared `columnCenterMoveGrip` SSoT
 *   1     → rotation    (`column-rotation`) στο `rotationHandleWorld` (= local (0,−dimY/4), ΑΝΑΜΕΣΑ
 *           στο κέντρο και την κάτω λαβή· ΠΟΤΕ πάνω στο centroid του move glyph)
 *   10+i  → λαβή ανά **κορυφή** του N-gon (`column-poly-vertex-i`)
 *   100+i → λαβή ανά **μέσο πλευράς** (`column-poly-edge-i`)
 *
 * Το vertex/edge drag κάνει materialize σε `composite` (ίδιο SSoT με L/T) στο πρώτο σύρσιμο. Το
 * `polygon` ΔΕΝ μπαίνει στο `usesFreeReshapeGrips` ώστε το rotation **drag** να διαβάζει το ΙΔΙΟ
 * `rotationHandleWorld` με το emission (μηδέν jump). Reuse `perVertexAndEdgeGrips` — μηδέν διπλότυπο.
 */
export function polygonReshapeGrips(entity: Readonly<ColumnEntity>): GripInfo[] {
  const verts = entity.geometry?.footprint?.vertices ?? computeColumnGeometry(entity.params).footprint.vertices;
  return [
    columnCenterMoveGrip(entity),
    {
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: rotationHandleWorld(entity.params),
      movesEntity: false,
      columnGripKind: 'column-rotation',
    },
    ...perVertexAndEdgeGrips(entity, verts),
  ];
}
