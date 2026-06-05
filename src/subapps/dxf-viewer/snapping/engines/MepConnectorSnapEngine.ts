/**
 * ADR-408 Φ9 — MEP Connector Snap Engine.
 *
 * Snaps the cursor to the world position of any MEP connector in the scene so
 * the `mep-segment` tool's start/end clicks **connect** to existing network
 * points (Revit pipe/duct "Connect To"):
 *   - a duct/pipe **segment** → its two endpoint connectors (`startPoint` /
 *     `endPoint`, resolved by `segmentConnectorWorldPosition`),
 *   - a **fixture** / **panel** → its embedded connector(s) (resolved by the
 *     point-host `connectorWorldPosition`).
 *
 * Returns `type: BIM_MEP_CONNECTOR` so the SnapIndicatorOverlay renders the
 * connector ◇ diamond marker, and emits `description: 'bim-mep-connector'` for
 * the "Σύνδεσμος ΜΕΡ" i18n tooltip.
 *
 * Priority −1.5 (BIM_MEP_CONNECTOR): above generic ENDPOINT (0) and column
 * centre (−1) — a connector is an exact MEP attach point — but below the −2 BIM
 * face corners, which are higher structural precision.
 *
 * The snap is applied centrally in `systems/cursor/mouse-handler-up.ts` BEFORE
 * the active tool reads the click, so the segment tool gets connected endpoints
 * for free (no tool-side wiring).
 *
 * @see ../../bim/mep-segments/mep-segment-connectors.ts — segment endpoint resolver
 * @see ../../bim/types/mep-connector-types.ts — connectorWorldPosition (point hosts)
 * @see ../engines/WallCornerSnapEngine.ts — pattern reference (ADR-370)
 * @see canvas-v2/overlays/SnapIndicatorOverlay.tsx — ◇ visual + i18n label
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import {
  isMepSegmentEntity,
  isMepFixtureEntity,
  isElectricalPanelEntity,
  isMepManifoldEntity,
  isMepRadiatorEntity,
  isMepBoilerEntity,
} from '../../types/entities';
import { getEntityConnectors } from '../../bim/mep-systems/connector-access';
import { connectorWorldPosition } from '../../bim/types/mep-connector-types';

export class MepConnectorSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.BIM_MEP_CONNECTOR);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      extractMepConnectorPoints,
      'mep_connector',
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const priority = SNAP_ENGINE_PRIORITIES.BIM_MEP_CONNECTOR;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.BIM_MEP_CONNECTOR);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'mep_connector'),
    );

    const candidates: SnapCandidate[] = [];
    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'bim-mep-connector',
        result.distance,
        priority,
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

/**
 * World plan points of an entity's MEP connectors. A segment resolves its two
 * endpoints directly from `startPoint`/`endPoint` (robust even before the seed
 * pass materialises the connector array); a point host resolves each embedded
 * connector via the rotation model. Non-MEP entities → `[]`.
 */
function extractMepConnectorPoints(entity: EntityModel): Point2D[] {
  if (isMepSegmentEntity(entity)) {
    return [
      { x: entity.params.startPoint.x, y: entity.params.startPoint.y },
      { x: entity.params.endPoint.x, y: entity.params.endPoint.y },
    ];
  }
  if (
    isMepFixtureEntity(entity) ||
    isElectricalPanelEntity(entity) ||
    isMepManifoldEntity(entity) ||
    isMepRadiatorEntity(entity) ||
    isMepBoilerEntity(entity)
  ) {
    const { position, rotation } = entity.params;
    const connectors = getEntityConnectors(entity);
    // A legacy host with no materialised connector still snaps at its origin
    // (its default connector sits at `localPosition` zero → the host position).
    if (connectors.length === 0) return [{ x: position.x, y: position.y }];
    return connectors.map((c) => {
      const w = connectorWorldPosition(c, position, rotation ?? 0);
      return { x: w.x, y: w.y };
    });
  }
  return [];
}
