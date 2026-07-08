/**
 * ADR-597 — Generic BIM Characteristic-Point Snap Engine (ΕΝΑ class, αντικαθιστά τα 5).
 *
 * ONE parametric engine that snaps to the corner / midpoint / center characteristic
 * points of EVERY BIM entity, sourced from the `bim-characteristic-points` SSoT
 * dispatcher. It replaces the 5 near-identical per-entity corner engines
 * (`{Wall,Beam,Slab,Column,Opening}CornerSnapEngine`) — «ΙΔΙΟΣ κώδικας παντού,
 * μηδέν διπλότυπο» (Giorgio). The registry instantiates it once per category:
 *
 *   - `BIM_CORNER`   (category 'corner')   — the ┘ L-bracket glyph
 *   - `BIM_MIDPOINT` (category 'midpoint') — Φ3
 *   - `BIM_CENTER`   (category 'center')   — Φ3
 *
 * The per-entity label differentiation («Γωνία τοίχου» vs «Γωνία δοκαριού») comes
 * from the candidate `description` (`bim-<root>-<suffix>`), resolved per-candidate via
 * the geometry-free `bimCharacteristicDescription`. «Περίεργα σχήματα» (curved /
 * polyline / L / circular …) emit an EMPTY description → snap glyph ΧΩΡΙΣ label (req #4).
 *
 * @see bim/utils/bim-characteristic-points.ts — point + label SSoT
 * @see snapping/engines/WallCornerSnapEngine.ts — the (deleted) per-entity pattern
 * @see canvas-v2/overlays/SnapIndicatorOverlay.tsx — ┘ glyph + i18n label
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import {
  getBimCharacteristicPointsOfCategory,
  bimCharacteristicDescription,
  type BimCharCategory,
} from '../../bim/utils/bim-characteristic-points';

export class BimCharacteristicSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;
  private readonly category: BimCharCategory;
  private readonly priority: number;
  /** Spatial-index slot key — typed to the ISpatialIndex.querySnap BIM union. */
  private readonly slot: 'bim_corner' | 'bim_midpoint' | 'bim_center';

  /**
   * @param snapType the `ExtendedSnapType` this engine serves (BIM_CORNER/MIDPOINT/CENTER)
   * @param category which characteristic-point category to index from each entity
   * @param priority SnapEngineRegistry priority for emitted candidates
   */
  constructor(snapType: ExtendedSnapType, category: BimCharCategory, priority: number) {
    super(snapType);
    this.category = category;
    this.priority = priority;
    this.slot = `bim_${category}`;
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => getBimCharacteristicPointsOfCategory(entity, this.category),
      this.slot,
    );
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

      candidates.push(this.createCandidate(
        point,
        bimCharacteristicDescription(entity, this.category),
        result.distance,
        this.priority,
        entity.id,
      ));

      if (candidates.length >= context.maxCandidates) break;
    }

    return { candidates };
  }

  dispose(): void {
    this.spatialIndex?.clear();
  }
}
