/**
 * ADR-395 G2 — slab net-BOQ geometry feed (SSoT).
 *
 * Extracted from `useSlabPersistence` (CHECK 4 / N.7.1 file-size split). Builds
 * net BOQ geometry for a slab (gross − cutouts − beam intersections). Scene/
 * Firestore slab geometry stays gross (display/3D untouched); only the BOQ
 * payload carries the net. Mirror of `wall-boq-feed`.
 */

import type { SceneModel } from '../../types/entities';
import { closedRingFromEdges } from '../../bim/geometry/shared/polygon-utils';
import type { SlabEntity, SlabGeometry } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { WallEntity } from '../../bim/types/wall-types';
import {
  computeSlabGeometry,
  type BeamFootprintForDeduction,
  type WallFootprintForSpan,
} from '../../bim/geometry/slab-geometry';

/**
 * Collect beam footprints from scene for slab BOQ volume deduction. Reads beams
 * already in memory (no Firestore query).
 */
function collectBeamFootprints(scene: SceneModel | null): BeamFootprintForDeduction[] {
  if (!scene) return [];
  const result: BeamFootprintForDeduction[] = [];
  for (const e of scene.entities) {
    if ((e as { type?: string }).type !== 'beam') continue;
    const beam = e as BeamEntity;
    if (beam.geometry?.outline && beam.params.depth > 0) {
      result.push({ outline: beam.geometry.outline, depthMm: beam.params.depth });
    }
  }
  return result;
}

/**
 * Collect wall footprints from scene for slab free-span computation. Constructs
 * plan-view outline from outerEdge + innerEdge (already in memory).
 */
function collectWallFootprints(scene: SceneModel | null): WallFootprintForSpan[] {
  if (!scene) return [];
  const result: WallFootprintForSpan[] = [];
  for (const e of scene.entities) {
    if ((e as { type?: string }).type !== 'wall') continue;
    const wall = e as WallEntity;
    const outer = wall.geometry?.outerEdge?.points;
    const inner = wall.geometry?.innerEdge?.points;
    if (!outer || !inner || outer.length < 2 || inner.length < 2) continue;
    // CCW outline: outer start→end, inner reversed (end→start) — SSoT closedRingFromEdges
    const outlineVertices = closedRingFromEdges(outer, inner);
    result.push({ outline: { vertices: outlineVertices } });
  }
  return result;
}

/**
 * Collect a slab's cutouts (slab-openings) from the in-memory scene for
 * net-volume subtraction. `computeSlabGeometry` reads each cutout's
 * `geometry.area` (m²), so unit conversion is already baked in.
 */
function collectSlabOpenings(scene: SceneModel | null, slabId: string): SlabOpeningEntity[] {
  if (!scene) return [];
  const result: SlabOpeningEntity[] = [];
  for (const e of scene.entities) {
    if ((e as { type?: string }).type !== 'slab-opening') continue;
    const so = e as SlabOpeningEntity;
    if (so.params?.slabId === slabId) result.push(so);
  }
  return result;
}

/**
 * Net BOQ geometry for a slab (gross − cutouts − beam intersections). Cutouts
 * shrink `netArea`/`volume`; beams shrink `volume`; walls/beams refine
 * `maxFreeSpanM`. Recompute only when a deduction source exists; otherwise reuse
 * the entity's own (gross) geometry.
 */
export function slabBoqGeometry(entity: SlabEntity, scene: SceneModel | null): SlabGeometry {
  const slabOpenings = collectSlabOpenings(scene, entity.id);
  const beamFootprints = collectBeamFootprints(scene);
  const wallFootprints = collectWallFootprints(scene);
  const hasDeductions =
    slabOpenings.length > 0 || beamFootprints.length > 0 || wallFootprints.length > 0;
  return hasDeductions
    ? computeSlabGeometry(entity.params, slabOpenings, beamFootprints, wallFootprints)
    : entity.geometry;
}
