/**
 * ADR-650 M10 — geo-referencing AUTO-ALIGN (Revit «quick align» first guess).
 *
 * Giorgio's decision: auto-align is a CONVENIENCE first estimate (translation only),
 * NOT the authoritative geo-reference — the user refines it with a manual common point
 * («Specify/Acquire Coordinates»). It maps the robust CENTER of the building (local DXF
 * coords) onto the robust CENTER of the terrain (ΕΓΣΑ world coords), so the plan lands
 * on the survey «about right» and the user nudges from there.
 *
 * Both centers use {@link computeRobustCenter} — median + MAD trimming — so a stray
 * ~17 km legend/stamp cluster or far outliers in the raw DXF do NOT drag the estimate
 * (Εύρημα #1: the naive `processedData.bounds` is wrong; robust bounds are mandatory).
 *
 * Pure module — zero React/DOM/store deps.
 *
 * @see ./geo-transform.ts — fromOnePointPair (translation-only reference)
 * @see ../zoom/utils/robust-bounds.ts — computeRobustCenter
 */

import type { Point2D } from '../../rendering/types/Types';
import { computeRobustCenter } from '../zoom/utils/robust-bounds';
import { fromOnePointPair, type GeoReference } from './geo-transform';

export interface AutoAlignResult {
  /** Translation-only reference mapping the building center onto the terrain center. */
  readonly geo: GeoReference;
  /** Robust building center (local DXF, canonical mm) — the picked local anchor. */
  readonly localCenter: Point2D;
  /** Robust terrain center (ΕΓΣΑ world, canonical mm) — the target world anchor. */
  readonly worldCenter: Point2D;
  /** Survivor counts after outlier/secondary-cluster trimming (diagnostics/UI). */
  readonly localKept: number;
  readonly worldKept: number;
}

/**
 * Produce a translation-only geo-reference from the robust centers of the building
 * (local DXF points) and the terrain (world ΕΓΣΑ points). Returns `null` when either
 * side has no points (nothing to align).
 *
 * @param localPoints building/plan coordinates in the DXF local frame (canonical mm)
 * @param worldPoints terrain/survey coordinates in ΕΓΣΑ world (canonical mm)
 */
export function autoAlignByRobustCenters(
  localPoints: readonly Point2D[],
  worldPoints: readonly Point2D[],
): AutoAlignResult | null {
  const local = computeRobustCenter(localPoints);
  const world = computeRobustCenter(worldPoints);
  if (!local || !world) return null;
  return {
    geo: fromOnePointPair(local.center, world.center),
    localCenter: local.center,
    worldCenter: world.center,
    localKept: local.kept,
    worldKept: world.kept,
  };
}
