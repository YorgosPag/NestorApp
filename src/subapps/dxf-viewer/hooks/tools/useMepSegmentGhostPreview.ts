/**
 * ADR-408 Φ8 / ADR-574 Σ2 — MEP segment 2D placement ghost preview hook.
 *
 * WYSIWYG rubber-band variant του placement-ghost primitive (ADR-624): το bespoke
 * build χτίζει την ΠΛΗΡΗ `MepSegmentEntity` με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultMepSegmentParams` + `buildMepSegmentEntity`, ίδιο overrides/domain/
 * sceneUnits source με το commit — το bridge mirror του `useMepSegmentTool` FSM) από
 * (startPoint = 1o click) → (endPoint = live cursor), και το primitive τη ζωγραφίζει
 * WYSIWYG (`renderWysiwygPlacementGhost`) — byte-identical με το committed duct/pipe.
 * RAF/clear/viewport/cursor → `useCanvasGhostPreview` harness (ADR-398 §4).
 *
 * 2-click placement tool: ενεργό μόνο σε `isAwaitingEnd` (1o click done, awaiting 2o).
 * Fixed start + section spec έρχονται από το segment tool bridge· ο cursor δίνει το
 * live end point. OSNAP: ο effective cursor κλειδώνει στο snapped point (WYSIWYG).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 */

import type { Entity, Point2D, ViewTransform } from '../../rendering/types/Types';
import type { MepSegmentDomain } from '../../bim/types/mep-segment-types';
import {
  buildDefaultMepSegmentParams,
  buildMepSegmentEntity,
} from '../drawing/mep-segment-completion';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { mepSegmentToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-segment-tool-bridge-store';
import { useWysiwygPlacementGhost } from './use-wysiwyg-placement-ghost';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GhostSegmentSpec {
  /** Fixed start point (world canvas units) — the first-click position. */
  readonly startPoint: Point2D;
  /**
   * Section width in canvas units (derived from the current tool params:
   * `resolveSegmentSection(params).widthMm * mmToSceneUnits(sceneUnits)`).
   */
  readonly sectionWidthCanvas: number;
  /** Domain — drives the palette colour. */
  readonly domain: MepSegmentDomain;
}

export interface UseMepSegmentGhostPreviewProps {
  /**
   * True when the first click has been made and the tool is waiting for the
   * second click (end point). Ghost is drawn only in this phase.
   */
  readonly isAwaitingEnd: boolean;
  readonly transform: ViewTransform;
  /**
   * Legacy segment-spec getter — kept for parent wiring parity (ADR-574: unused
   * here; the WYSIWYG draw reads start + section spec from the bridge instead).
   */
  getGhostSegment?(cursorPos: Readonly<Point2D> | null): GhostSegmentSpec | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Viewport element for size measurement; falls back to `getCanvas` (handled by harness). */
  getViewportElement?(): HTMLElement | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMepSegmentGhostPreview(props: Readonly<UseMepSegmentGhostPreviewProps>): void {
  const { isAwaitingEnd, transform, getCanvas, getViewportElement } = props;

  useWysiwygPlacementGhost({
    isActive: isAwaitingEnd,
    transform,
    getCanvas,
    getViewportElement,
    buildGhostEntity: ({ effectiveCursor }): Entity | null => {
      if (!effectiveCursor) return null;
      // ADR-574 Σ2 — build the FULL duct/pipe entity με τους ΙΔΙΟΥΣ commit builders +
      // start/overrides/domain/sceneUnits source (bridge mirrors the tool FSM), so the
      // rubber-band ≡ commit. Start = 1st click (bridge), end = live cursor.
      const h = mepSegmentToolBridgeStore.get();
      const startPoint = h?.startPoint;
      if (!startPoint) return null;
      const params = buildDefaultMepSegmentParams(
        startPoint,
        effectiveCursor,
        h?.domain,
        h?.overrides ?? {},
        h?.getSceneUnits?.() ?? 'mm',
        h?.startElevationMm ?? null,
        null,
      );
      const built = buildMepSegmentEntity(params, getDefaultLayerId());
      return built.ok ? (built.entity as unknown as Entity) : null;
    },
    drawDeps: [],
  });
}
