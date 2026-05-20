/**
 * Slab geometry computation (ADR-363 Phase 3 + Phase 3.8).
 *
 * Pure SSoT function — derives `SlabGeometry` cache από `SlabParams`.
 * Idempotent + side-effect free. Algorithm:
 *
 *   1. polygon = params.outline (closed CCW, mm world coords)
 *   2. area (m²) = |shoelaceArea(vertices)| / 1e6
 *   3. perimeter (m) = sum-of-edges / 1000
 *   4. bbox (mm) = AABB folds vertices σε z=0 plane
 *   5. netArea (m²) = area (Phase 3 — slab-openings subtraction Phase 3.5)
 *   6. volume (m³) = netArea × thickness / 1000
 *   7. maxFreeSpanM (m) = analytical clear span between supporting elements
 *      (Phase 3.8) — fallback to min(bbox.w, bbox.h) when no supports given.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { SlabGeometry, SlabParams } from '../types/slab-types';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import type { Point3D, Polygon3D } from '../types/bim-base';
import {
  polygonArea,
  polygonBbox,
  polygonPerimeter,
  polygonIntersectionAreaMm2,
} from './shared/polygon-utils';

// ─── Beam deduction input (Phase 5.5i+) ──────────────────────────────────────

/**
 * Minimal beam descriptor for slab volume deduction (Phase 5.5i+).
 * Passed by `useSlabPersistence` from the current level scene — no Firestore
 * query needed (beams already in memory).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5i+
 */
export interface BeamFootprintForDeduction {
  /** Plan-view beam outline (convex polygon, CCW, mm world coords). */
  readonly outline: Polygon3D;
  /** Structural depth (mm) — how deep the beam cuts into the slab. */
  readonly depthMm: number;
}

// ─── Wall footprint for free-span computation (Phase 3.8) ────────────────────

/**
 * Minimal wall descriptor for slab free-span analytical computation (Phase 3.8).
 * Passed by `useSlabPersistence` from scene walls already in memory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §3.8
 */
export interface WallFootprintForSpan {
  /** Plan-view wall footprint polygon (CCW, mm world coords). */
  readonly outline: Polygon3D;
}

const MM_TO_M = 1 / 1000;

/**
 * Compute `SlabGeometry` από `SlabParams`. Pure SSoT για slab-derived
 * γεωμετρία. Caller MUST ensure `outline.vertices.length >= 3` (validator
 * guard upstream). Όταν λιγότερες κορυφές, area/perimeter/volume = 0.
 *
 * Phase 3.7: Όταν δοθεί `slabOpenings`, το `netArea` = `area − Σ(opening.area)`
 * (clamped σε ≥ 0). Το `volume` υπολογίζεται με το `netArea`. Όταν παραλειφθεί
 * → netArea == area (legacy behaviour).
 *
 * Phase 3.8: Όταν δοθούν `beamFootprints` ή `wallFootprints`, το `maxFreeSpanM`
 * υπολογίζεται αναλυτικά (clear span μεταξύ inner faces supporting elements).
 * Χωρίς supports → fallback min(bbox.w, bbox.h).
 *
 * Throws nothing — validation σε `validateSlabParams()`.
 */
export function computeSlabGeometry(
  params: SlabParams,
  slabOpenings?: readonly SlabOpeningEntity[],
  beamFootprints?: readonly BeamFootprintForDeduction[],
  wallFootprints?: readonly WallFootprintForSpan[],
): SlabGeometry {
  const vertices = params.outline.vertices;
  const bbox = polygonBbox(vertices);
  const areaMm2 = polygonArea(vertices);
  const perimeterMm = polygonPerimeter(vertices);
  const areaM2 = areaMm2 * (MM_TO_M * MM_TO_M);
  const perimeterM = perimeterMm * MM_TO_M;

  const openingsAreaM2 = sumSlabOpeningAreasM2(slabOpenings);
  const netAreaM2 = Math.max(0, areaM2 - openingsAreaM2);
  const thicknessMm = Math.max(0, params.thickness);
  const grossVolumeM3 = netAreaM2 * thicknessMm * MM_TO_M;
  const beamDeductionM3 = sumBeamDeductionsM3(params.outline.vertices, thicknessMm, beamFootprints);
  const volumeM3 = Math.max(0, grossVolumeM3 - beamDeductionM3);

  const supportOutlines = collectSupportOutlines(beamFootprints, wallFootprints);
  const maxFreeSpanM = computeSlabMaxFreeSpanM(vertices, supportOutlines);

  return {
    polygon: params.outline,
    bbox,
    area: areaM2,
    netArea: netAreaM2,
    volume: volumeM3,
    perimeter: perimeterM,
    maxFreeSpanM,
  };
}

/**
 * Sum των m² εμβαδών όλων των slab-openings που ζουν πάνω σε ένα slab.
 * Pure helper — caller φιλτράρει ήδη ανά slabId πριν δώσει τη λίστα. Όταν
 * `openings` undefined ή κενό → 0.
 */
function sumSlabOpeningAreasM2(
  openings: readonly SlabOpeningEntity[] | undefined,
): number {
  if (!openings || openings.length === 0) return 0;
  let total = 0;
  for (const o of openings) {
    if (o.geometry && Number.isFinite(o.geometry.area)) {
      total += o.geometry.area;
    }
  }
  return total;
}

/**
 * Convenience: returns the bbox span estimate σε m (min of width/height).
 * Used από validator για free span check (Phase 3.8 — slabs span the shorter
 * direction, so min(w,h) is the structurally relevant dimension).
 */
export function getSlabMaxBboxDimensionM(params: SlabParams): number {
  const bb = polygonBbox(params.outline.vertices);
  const dx = bb.max.x - bb.min.x;
  const dy = bb.max.y - bb.min.y;
  return Math.min(dx, dy) * MM_TO_M;
}

// ─── Phase 3.8 — Analytical free-span computation ───────────────────────────

/**
 * Collect support polygon outlines from both beam and wall footprints.
 * Returns a single flat list for use by `computeSlabMaxFreeSpanM`.
 */
function collectSupportOutlines(
  beamFootprints: readonly BeamFootprintForDeduction[] | undefined,
  wallFootprints: readonly WallFootprintForSpan[] | undefined,
): readonly Polygon3D[] {
  const result: Polygon3D[] = [];
  if (beamFootprints) {
    for (const b of beamFootprints) result.push(b.outline);
  }
  if (wallFootprints) {
    for (const w of wallFootprints) result.push(w.outline);
  }
  return result;
}

/**
 * Centroid of a polygon (arithmetic mean of vertices — sufficient for
 * symmetric/near-symmetric structural slabs).
 */
function computePolygonCentroid(vertices: readonly Point3D[]): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  for (const v of vertices) {
    sumX += v.x;
    sumY += v.y;
  }
  const n = vertices.length;
  return { x: sumX / n, y: sumY / n };
}

/**
 * Analytical free-span computation (Phase 3.8).
 *
 * Algorithm: sample N_ANGLES directions (0…π), project slab and all support
 * outlines onto each direction. For each direction the clear span = distance
 * between the nearest inner faces of opposing supports (clamped to slab
 * extent). Returns the maximum clear span across all directions σε m.
 *
 * Fallback: when no valid opposing-support pairs found → min(bbox.w, bbox.h).
 *
 * Complexity: O(N_ANGLES × S) where S = number of support polygons (typically
 * < 20 for a floor plan level).
 */
export function computeSlabMaxFreeSpanM(
  slabVertices: readonly Point3D[],
  supportOutlines: readonly Polygon3D[],
): number {
  const bb = polygonBbox(slabVertices);
  const dx = bb.max.x - bb.min.x;
  const dy = bb.max.y - bb.min.y;
  const bboxFallbackM = Math.min(dx, dy) * MM_TO_M;

  if (slabVertices.length < 3 || supportOutlines.length < 2) {
    return bboxFallbackM;
  }

  const centroid = computePolygonCentroid(slabVertices);
  const N_ANGLES = 12;
  let maxSpanMm = 0;

  for (let i = 0; i < N_ANGLES; i++) {
    const theta = (i * Math.PI) / N_ANGLES;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const centroidProj = centroid.x * cosT + centroid.y * sinT;

    // Slab extent in this direction
    let slabMin = Infinity;
    let slabMax = -Infinity;
    for (const v of slabVertices) {
      const p = v.x * cosT + v.y * sinT;
      if (p < slabMin) slabMin = p;
      if (p > slabMax) slabMax = p;
    }

    // Inner faces: max projection of supports "behind" centroid, min of those "ahead"
    let maxBeforeInner = -Infinity;
    let minAfterInner = Infinity;

    for (const support of supportOutlines) {
      let sMin = Infinity;
      let sMax = -Infinity;
      for (const v of support.vertices) {
        const p = v.x * cosT + v.y * sinT;
        if (p < sMin) sMin = p;
        if (p > sMax) sMax = p;
      }
      const sCenter = (sMin + sMax) / 2;
      if (sCenter < centroidProj) {
        if (sMax > maxBeforeInner) maxBeforeInner = sMax;
      } else {
        if (sMin < minAfterInner) minAfterInner = sMin;
      }
    }

    if (Number.isFinite(maxBeforeInner) && Number.isFinite(minAfterInner)) {
      const clearSpan = Math.min(minAfterInner - maxBeforeInner, slabMax - slabMin);
      if (clearSpan > maxSpanMm) maxSpanMm = clearSpan;
    }
  }

  return maxSpanMm > 0 ? maxSpanMm * MM_TO_M : bboxFallbackM;
}

/**
 * Phase 5.5i+ — Σ beam volume deductions (m³) για ένα slab.
 *
 * Για κάθε beam footprint: intersection area (S-H clip) × min(beamDepth, slabThickness)
 * → mm³ → m³. Αθροίζεται στο total deduction που αφαιρείται από το slab volume.
 *
 * Industry precedent: Revit Material Takeoff, ArchiCAD Interactive Schedule —
 * both deduct beam footprint × min(beam depth, slab thickness) from slab volume.
 */
function sumBeamDeductionsM3(
  slabVertices: readonly Point3D[],
  slabThicknessMm: number,
  beamFootprints: readonly BeamFootprintForDeduction[] | undefined,
): number {
  if (!beamFootprints || beamFootprints.length === 0) return 0;
  let total = 0;
  for (const beam of beamFootprints) {
    const intersectionMm2 = polygonIntersectionAreaMm2(slabVertices, beam.outline.vertices);
    if (intersectionMm2 <= 0) continue;
    const effectiveDepthMm = Math.min(beam.depthMm, slabThicknessMm);
    total += intersectionMm2 * effectiveDepthMm / 1e9;
  }
  return total;
}
