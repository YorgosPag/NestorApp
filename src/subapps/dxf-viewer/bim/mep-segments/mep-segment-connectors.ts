/**
 * ADR-408 Φ9 — world position of a linear segment's endpoint connectors.
 *
 * A point host (fixture / panel) resolves its connector world position by
 * rotating a host-local offset about the host origin (`connectorWorldPosition`
 * in `mep-connector-types.ts`). A linear `mep-segment` has no `position` +
 * `rotation`: its two world endpoints (`startPoint` / `endPoint`) ARE its
 * transform. So the endpoint connectors are resolved DIRECTLY from those points
 * — never via `connectorWorldPosition`, whose rotation model does not apply here.
 *
 * Lives in `mep-segments/` (not `mep-connector-types.ts`) to avoid the import
 * cycle that pulling `MepSegmentParams` into the connector-types SSoT would
 * create.
 *
 * @see ../types/mep-connector-types.ts — SEGMENT_START/END_CONNECTOR_ID + builder
 * @see ../types/mep-segment-types.ts — MepSegmentParams
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ9
 */

import type { Point3D } from '../types/bim-base';
import type { MepSegmentParams } from '../types/mep-segment-types';
import { resolveSegmentEndpointElevationsMm } from '../types/mep-segment-types';
import {
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../types/mep-connector-types';

/**
 * World position of a segment endpoint connector. `seg-start` → `startPoint`,
 * `seg-end` → `endPoint` (both world canvas-unit plan coords); `z` carries that
 * endpoint's OWN elevation (mm) — the start and end may sit at different heights
 * (sloped run / riser, ADR-408 Φ-A), so each connector reports its own z, NOT a
 * shared centreline. Returns `null` for any other connector id (a segment owns
 * exactly these two endpoint connectors).
 *
 * The result follows the segment for free: `startPoint`/`endPoint` ARE the
 * segment's persisted transform, so a move/edit of the segment relocates the
 * connector with no extra wiring.
 */
export function segmentConnectorWorldPosition(
  connectorId: string,
  params: MepSegmentParams,
): Point3D | null {
  const elev = resolveSegmentEndpointElevationsMm(params);
  if (connectorId === SEGMENT_START_CONNECTOR_ID) {
    return { x: params.startPoint.x, y: params.startPoint.y, z: elev.startMm };
  }
  if (connectorId === SEGMENT_END_CONNECTOR_ID) {
    return { x: params.endPoint.x, y: params.endPoint.y, z: elev.endMm };
  }
  return null;
}
