/**
 * ADR-505 (finish/rebar export) — Γεωμετρία οπλισμού ΠΛΑΚΑΣ σε κάτοψη (pure SSoT).
 *
 * Το «σώμα» του πρώην `drawSlabRebar2D` ΠΡΙΝ το ctx. Universal για ΟΛΑ τα είδη
 * πλάκας: δι-διευθυντικές σχάρες (// X + // Y) στο bbox − cover, **clip-αρισμένες
 * στο πολύγωνο** μέσω του ΙΔΙΟΥ `coveredIntervals` SSoT (αντί ctx.clip → λειτουργεί
 * και σε non-canvas consumers/DXF, με ίδιο αποτέλεσμα σε ορθογώνιες πλάκες). Σύμβαση:
 *   - κάτω σχάρα → συμπαγείς γραμμές (κύριος οπλισμός).
 *   - άνω σχάρα  → διακεκομμένες (`dashed`) γραμμές (στηρίξεων/hogging — Revit «top mark»).
 *
 * Καταναλώνεται από: `slab-rebar-2d.ts` (canvas) + `overlay-dxf-collector.ts` (DXF).
 *
 * @see ../../renderers/slab-rebar-2d.ts — ο canvas consumer
 * @see ../../geometry/shared/segment-polygon-coverage.ts — clip SSoT
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { SlabEntity } from '../../types/slab-types';
import type { RebarMesh } from './slab-foundation-reinforcement-types';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { resolveActiveSlabReinforcementForEntity } from '../active-reinforcement';
import { coveredIntervals, type Pt2 } from '../../geometry/shared/segment-polygon-coverage';
import type { RebarPlanGeometry, RebarPlanPath } from './rebar-plan-geometry-types';

interface Bbox { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }

function outlineBbox(verts: readonly { x: number; y: number }[]): Bbox | null {
  if (verts.length < 3) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}

const lerp = (a: Pt2, b: Pt2, t: number): Point2D => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });

/** Κόβει το τμήμα a→b στα κομμάτια του που πέφτουν ΜΕΣΑ στο outline (clip SSoT). */
function clipSegment(a: Pt2, b: Pt2, outline: readonly Pt2[], diameterMm: number, dashed: boolean, out: RebarPlanPath[]): void {
  for (const [t0, t1] of coveredIntervals(a, b, outline)) {
    if (t1 - t0 < 1e-9) continue;
    out.push({ points: [lerp(a, b, t0), lerp(a, b, t1)], closed: false, diameterMm, dashed });
  }
}

/**
 * Δι-διευθυντική σχάρα (ράβδοι // X + // Y) πάνω στο bbox − cover, clip-αρισμένη στο
 * outline. `meshX` = γραμμές // X (βήμα κατά Y)· `meshY` = γραμμές // Y (βήμα κατά X).
 */
function meshPaths(
  bbox: Bbox,
  coverCanvas: number,
  meshX: RebarMesh,
  meshY: RebarMesh,
  outline: readonly Pt2[],
  s: number,
  dashed: boolean,
  out: RebarPlanPath[],
): void {
  const x0 = bbox.minX + coverCanvas, x1 = bbox.maxX - coverCanvas;
  const y0 = bbox.minY + coverCanvas, y1 = bbox.maxY - coverCanvas;
  if (x1 <= x0 || y1 <= y0) return;

  const stepY = meshX.spacingMm * s;
  if (stepY > 0) {
    for (let y = y0; y <= y1 + 1e-6; y += stepY) {
      clipSegment({ x: x0, y }, { x: x1, y }, outline, meshX.diameterMm, dashed, out);
    }
  }
  const stepX = meshY.spacingMm * s;
  if (stepX > 0) {
    for (let x = x0; x <= x1 + 1e-6; x += stepX) {
      clipSegment({ x, y: y0 }, { x, y: y1 }, outline, meshY.diameterMm, dashed, out);
    }
  }
}

/**
 * Γεωμετρία οπλισμού πλάκας στην κάτοψη (world coords). `null` όταν δεν έχει ορισμένο
 * `structuralReinforcement` ή εκφυλισμένη γεωμετρία.
 */
export function collectSlabRebarPlanGeometry(slab: SlabEntity): RebarPlanGeometry | null {
  const r = resolveActiveSlabReinforcementForEntity(slab);
  if (!r) return null;
  const verts = slab.params.outline.vertices;
  const bbox = outlineBbox(verts);
  if (!bbox) return null;
  const s = mmToSceneUnits(slab.params.sceneUnits ?? 'mm');
  if (s <= 0) return null;
  const cover = r.coverMm * s;
  const outline: Pt2[] = verts.map((v) => ({ x: v.x, y: v.y }));

  const paths: RebarPlanPath[] = [];
  meshPaths(bbox, cover, r.bottomMeshX, r.bottomMeshY, outline, s, false, paths); // κάτω = συμπαγείς
  meshPaths(bbox, cover, r.topMeshX, r.topMeshY, outline, s, true, paths);        // άνω = διακεκομμένες
  return { paths, dots: [] };
}
