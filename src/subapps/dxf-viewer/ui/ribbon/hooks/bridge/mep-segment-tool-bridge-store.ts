/**
 * ADR-408 Φ8 — MEP segment tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `mep-manifold-tool-bridge-store.ts`. Module-level mutable
 * cell so the 3D placement hook + ghost can read the `useMepSegmentTool` state
 * (which lives inside `CanvasSection`) without a cross-sibling lift-up.
 *
 * Unlike the point-based manifold bridge, the segment tool is a 2-click FSM, so
 * this handle ALSO mirrors `phase` + `startPoint` (+ the connector elevation the
 * start snapped to). That lets the 3D ghost draw the rubber-band axis
 * (start → cursor) after the first click — the FSM stays the single source of
 * truth, this store is just its read-only projection.
 *
 * Single writer (useMepSegmentTool effect) → multi reader (3D placement hook +
 * ghost, read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see docs/centralized-systems/reference/adrs/ADR-403-3d-bim-element-placement.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type { Point2D } from '../../../../rendering/types/Types';
import type { MepSegmentDomain } from '../../../../bim/types/mep-segment-types';
import type {
  MepSegmentParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/mep-segment-completion';
import type { MepSegmentToolPhase } from '../../../../hooks/drawing/useMepSegmentTool';

/** Snapshot of the segment tool's user-editable + FSM state (read-only mirror). */
export interface MepSegmentToolBridgeHandle {
  readonly isActive: boolean;
  readonly domain: MepSegmentDomain;
  readonly overrides: MepSegmentParamOverrides;
  /** FSM phase — `awaitingEnd` ⇒ the 3D ghost draws the rubber-band axis. */
  readonly phase: MepSegmentToolPhase;
  /** Start anchor (scene units) saved by the first click; null until then. */
  readonly startPoint: Point2D | null;
  /**
   * mm — elevation the start click inherited from a snapped connector
   * (ADR-408 Φ-B1). null ⇒ start was a free point.
   */
  readonly startElevationMm: number | null;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
  /**
   * ADR-408 Φ8 #2b — write a draw-time param override on the live tool (e.g. the
   * centreline elevation, changed BETWEEN the two clicks to author a riser/slope).
   * Mirror of `mep-manifold-tool-bridge-store` / `mep-radiator-tool-bridge-store`.
   */
  setParamOverrides(overrides: MepSegmentParamOverrides): void;
}

export const mepSegmentToolBridgeStore = createToolBridgeStore<MepSegmentToolBridgeHandle>();

export type { SceneUnits };
