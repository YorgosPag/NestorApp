/**
 * ADR-642 §6.8 (Φ6-B) — Complex-Linetype OSNAP Engine (railway rails + sleepers).
 *
 * ONE parametric engine (mirror of `BimCharacteristicSnapEngine` / `DimLineSnapEngine`)
 * that snaps to the RENDERED geometry of a complex linetype — the two parallel rails and
 * the perpendicular cross-ties (sleepers) of a railway line — NOT just the axis the entity
 * stores. The registry instantiates it once per point category, each under its own snap
 * type so the marker glyph differs (Giorgio 2026-07-13):
 *
 *   - `COMPLEX_ENDPOINT`     (category 'endpoint')     — ■ square  (rail & sleeper ends)
 *   - `COMPLEX_MIDPOINT`     (category 'midpoint')     — △ triangle (rail & sleeper mids)
 *   - `COMPLEX_INTERSECTION` (category 'intersection') — ✕ cross    (rail × sleeper)
 *
 * The snappable geometry is derived, canvas-free, by the pure
 * `sampleComplexLinetypeSnapGeometry` sampler (which reuses the SAME `walkCyclePlacements`
 * arc-length walk the stroker draws with — N.18, no clone). The complex def is resolved
 * from the entity's linetype through the ONE name→def SSoT (`resolveLinetypeDef`), exactly
 * as the render style resolver does — so a snap sits precisely on the painted rail/tie.
 *
 * Beyond standard CAD: AutoCAD does not snap to linetype-generated geometry — ADR-642 §6.8
 * documents this as a conscious, Giorgio-requested deviation.
 *
 * @see snapping/engines/complex-linetype-snap-geometry.ts — the pure sampler
 * @see snapping/engines/BimCharacteristicSnapEngine.ts — the one-class-many-types pattern
 * @see canvas-v2/overlays/SnapIndicatorGlyph.tsx — the ■/△/✕ glyph aliases
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex, SnapIndexSlot } from '../../core/spatial';
import { isLineEntity, isPolylineEntity, isLWPolylineEntity } from '../../types/entities';
import { resolveLinetypeDef } from '../../rendering/linetype-dash-resolver';
import { isSimpleExpressible } from '../../config/complex-linetype-adapters';
import {
  sampleComplexLinetypeSnapGeometry,
  hasSnappablePatternGeometry,
  type ComplexLinetypeSnapGeometry,
} from './complex-linetype-snap-geometry';

/** Which pattern-geometry point category one engine instance indexes. */
export type ComplexSnapCategory = 'endpoint' | 'midpoint' | 'intersection';

/** The entity's world-space axis polyline (the line the pattern is stroked along). */
function extractAxis(entity: EntityModel): { pts: Point2D[]; closed: boolean } | null {
  if (isLineEntity(entity)) return { pts: [entity.start, entity.end], closed: false };
  if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
    return entity.vertices && entity.vertices.length >= 2
      ? { pts: entity.vertices, closed: !!entity.closed }
      : null;
  }
  return null;
}

/**
 * Resolve an entity's complex linetype and sample its rendered pattern geometry, or
 * `null` when the entity carries no genuine snappable pattern (plain/solid/dashed lines,
 * non-linear entities). Same resolution path as the renderer (`resolveLinetypeDef`).
 */
function getEntityComplexSnapGeometry(entity: EntityModel): ComplexLinetypeSnapGeometry | null {
  const def = resolveLinetypeDef(entity.linetypeName)?.complex;
  if (!def || isSimpleExpressible(def) || !hasSnappablePatternGeometry(def)) return null;
  const axis = extractAxis(entity);
  if (!axis) return null;
  return sampleComplexLinetypeSnapGeometry(def, axis.pts, axis.closed);
}

export class ComplexLinetypeSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;
  private readonly category: ComplexSnapCategory;
  private readonly priority: number;
  private readonly slot: SnapIndexSlot;
  /** Internal (non-user-facing) debug label — mirrors `Endpoint`/`Dimension Line` peers. */
  private readonly label: string;

  /**
   * @param snapType the `ExtendedSnapType` this engine serves (COMPLEX_ENDPOINT/MIDPOINT/INTERSECTION)
   * @param category which pattern-geometry category to index from each entity
   * @param priority SnapEngineRegistry priority for emitted candidates
   */
  constructor(snapType: ExtendedSnapType, category: ComplexSnapCategory, priority: number) {
    super(snapType);
    this.category = category;
    this.priority = priority;
    this.slot = `complex_${category}`;
    this.label = `Pattern ${category}`;
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => this.extractPoints(entity),
      this.slot,
    );
  }

  private extractPoints(entity: EntityModel): Point2D[] {
    const geom = getEntityComplexSnapGeometry(entity);
    if (!geom) return [];
    const pts =
      this.category === 'endpoint'
        ? geom.endpoints
        : this.category === 'midpoint'
          ? geom.midpoints
          : geom.intersections;
    return pts as Point2D[];
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const radius = context.worldRadiusForType(cursorPoint, this.snapType);
    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, this.slot),
    );

    const candidates: SnapCandidate[] = [];
    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(point, this.label, result.distance, this.priority, entity.id));

      if (candidates.length >= context.maxCandidates) break;
    }

    return { candidates };
  }

  dispose(): void {
    this.spatialIndex?.clear();
  }
}
