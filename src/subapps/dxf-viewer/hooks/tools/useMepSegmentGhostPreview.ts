/**
 * ADR-408 Φ8 — MEP segment 2D placement ghost preview hook.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
 *
 * ADR-574 Σ2 — WYSIWYG rubber-band: το draw closure χτίζει ΠΛΗΡΗ `MepSegmentEntity`
 * με τους ΙΔΙΟΥΣ commit builders (`buildDefaultMepSegmentParams` +
 * `buildMepSegmentEntity`, ίδιο overrides/domain/sceneUnits source με το commit —
 * το bridge mirror του `useMepSegmentTool` FSM) από (startPoint = 1o click) →
 * (endPoint = live cursor), και το ζωγραφίζει μέσω του κοινού
 * `renderWysiwygPlacementGhost` (πραγματικός segment renderer). Έτσι η rubber-band
 * ΕΙΝΑΙ byte-identical με το committed duct/pipe (section fill / material hatch /
 * lineweight), αντί για το legacy translucent offset-rectangle + anchor-dots.
 * preview ≡ commit by identity.
 *
 * This is a 2-click placement tool: the hook is active only during `isAwaitingEnd`
 * (first click done, awaiting the second). The fixed start point + section spec
 * come from the segment tool bridge (same source the commit reads); the cursor
 * provides the live end point. OSNAP: the effective cursor locks to the snapped
 * point — matches the committed second-click point (WYSIWYG).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 * @see bim/ghosts/wysiwyg-placement-ghost — renderWysiwygPlacementGhost SSoT
 */

import { useCallback } from 'react';
import type { Entity, Point2D, ViewTransform } from '../../rendering/types/Types';
import type { MepSegmentDomain } from '../../bim/types/mep-segment-types';
import {
  buildDefaultMepSegmentParams,
  buildMepSegmentEntity,
} from '../drawing/mep-segment-completion';
import { renderWysiwygPlacementGhost } from '../../bim/ghosts/wysiwyg-placement-ghost';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { mepSegmentToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-segment-tool-bridge-store';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

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

export function useMepSegmentGhostPreview(
  props: Readonly<UseMepSegmentGhostPreviewProps>,
): void {
  const { isAwaitingEnd, transform, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    // ADR-574 Σ2 — build the FULL duct/pipe entity with the SAME commit builders +
    // start/overrides/domain/sceneUnits source (bridge mirrors the tool FSM), so the
    // rubber-band ≡ commit. Start = 1st click (bridge), end = live cursor. The end
    // is a free point (cursor carries no connector z) — matches the free-end commit.
    const h = mepSegmentToolBridgeStore.get();
    const startPoint = h?.startPoint;
    if (!startPoint) return;
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
    if (!built.ok) return;
    renderWysiwygPlacementGhost(ctx, built.entity as unknown as Entity, t, viewport);
  }, []);

  useCanvasGhostPreview({
    isActive: isAwaitingEnd,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: true,
    draw,
  });
}
