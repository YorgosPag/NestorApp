/**
 * ADR-363 Phase 3.7b+ — Slab-opening placement ghost preview hook (RAF-driven).
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic (δύο branches).
 *
 * ADR-574 Σ2b (WYSIWYG migration, 2026-07-06): το placement branch πλέον χτίζει
 * την ΠΛΗΡΗ synthetic `SlabOpeningEntity` με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultSlabOpeningParams` + `buildSlabOpeningPreviewEntity`, ίδιος
 * overrides source — `overrides` + `kind` merged — ακριβώς όπως το
 * `useSlabOpeningTool.commitFromState`) και τη ζωγραφίζει μέσω του ΠΡΑΓΜΑΤΙΚΟΥ
 * `SlabOpeningRenderer` (via `renderWysiwygPlacementGhost` → `BimPreviewRenderer`
 * → `EntityRendererComposite`). Έτσι το ghost είναι byte-identical με το committed
 * opening (kind fill / hatch), αντί για το legacy dashed rectangle + crosshair.
 * Ίδιο pattern με το wall-opening WYSIWYG ghost (`useOpeningGhostPreview`).
 *
 * Big-player edge behaviour: όταν το ορθογώνιο άνοιγμα βγαίνει εκτός host slab,
 * το commit hard-rejects (`outlineOutsideSlab`)· το preview ΔΕΝ εξαφανίζεται —
 * ζωγραφίζει 🔴 status schematic (Revit: opening + warning), μέσω του κοινού
 * `resolveGhostStatusColor('overlap')` + `drawStatusGhostPolygon` SSoT.
 *
 * Phase 3.7b++ extension: when `hoveredEdgeMidpointGrip` is set, draws a green
 * "+vertex" indicator at the grip world position (pre-drag hover affordance).
 *
 * DUAL-BRANCH draw (ΑΜΦΟΤΕΡΑ ταυτόχρονα δυνατά):
 *   1. Placement ghost — όταν `isAwaitingPosition && effectiveCursor` (WYSIWYG / 🔴).
 *   2. Edge-midpoint hover indicator — όταν `hoveredEdgeMidpointGrip` (bespoke, §C).
 *
 * Gate: `isActive = isAwaitingPosition || hoveredEdgeMidpointGrip != null`.
 *
 * ADR-040 compliance:
 *   - NO `useSyncExternalStore` σε orchestrators
 *   - `getImmediateSnap()` imperative read inside RAF callback
 *   - Ghost renders to preview canvas only (bitmap cache unchanged)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Phase 3.7b+
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 * @see hooks/tools/useOpeningGhostPreview — sibling wall-opening WYSIWYG ghost
 * @see bim/ghosts/wysiwyg-placement-ghost — shared real-renderer paint SSoT
 */

import { useCallback } from 'react';
import type { Entity, ViewTransform } from '../../rendering/types/Types';
import type { SlabOpeningKind } from '../../bim/types/slab-opening-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import {
  buildDefaultSlabOpeningParams,
  buildSlabOpeningPreviewEntity,
  type SlabOpeningParamOverrides,
} from '../drawing/slab-opening-completion';
import type { UnifiedGripInfo } from '../grips/unified-grip-types';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { renderWysiwygPlacementGhost } from '../../bim/ghosts/wysiwyg-placement-ghost';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { drawStatusGhostPolygon } from '../../bim/ghosts/ghost-status-polygon-draw';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { type SceneUnits } from '../../utils/scene-units';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseSlabOpeningGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly kind: SlabOpeningKind;
  /** Width/depth from ribbon overrides — falls back to kind defaults. */
  readonly overrides: SlabOpeningParamOverrides;
  /**
   * ADR-574 Σ2b — resolver για locked host slab (null όταν δεν υπάρχει
   * awaiting-position host). Mirror του `getHostWall` στο `useOpeningGhostPreview`:
   * τροφοδοτεί τους ίδιους commit builders ώστε preview ≡ commit by identity.
   */
  readonly getHostSlab: () => SlabEntity | null;
  /** ADR-363 Phase 3.7b++ — pre-drag hover indicator for edge-midpoint grips. */
  readonly hoveredEdgeMidpointGrip?: UnifiedGripInfo | null;
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
  /**
   * ADR-370 — active scene units. Propagated στον `buildDefaultSlabOpeningParams`
   * builder (ο οποίος δίνει προτεραιότητα στο frozen `hostSlab.params.sceneUnits`)
   * ώστε το ghost rectangle να συμπίπτει με το committed entity. Undefined → 'mm'.
   */
  getSceneUnits?(): SceneUnits;
}

export function useSlabOpeningGhostPreview(props: Readonly<UseSlabOpeningGhostPreviewProps>): void {
  const { isAwaitingPosition, kind, overrides, getHostSlab, hoveredEdgeMidpointGrip, transform, getCanvas, getViewportElement, getSceneUnits } = props;

  // Gate: ενεργό είτε σε placement είτε σε hover mode.
  const isActive = isAwaitingPosition || hoveredEdgeMidpointGrip != null;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    // --- Placement ghost (ADR-574 Σ2b — WYSIWYG via real renderer) ---
    if (isAwaitingPosition && effectiveCursor) {
      const hostSlab = getHostSlab();
      if (hostSlab) {
        // Build the FULL entity με τους ΙΔΙΟΥΣ commit builders + overrides source
        // (kind merged in, ακριβώς όπως `commitFromState`), ώστε preview ≡ commit.
        // Scene-units conversion ζει μέσα στον builder → το ghost κάθεται στο ίδιο
        // rectangle που θα φτιάξει το commit.
        const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
        const overridesWithKind: SlabOpeningParamOverrides = { ...overrides, kind };
        const params = buildDefaultSlabOpeningParams(hostSlab, effectiveCursor, overridesWithKind, sceneUnits);
        // Preview-tolerant build: παρακάμπτει ΜΟΝΟ το `outlineOutsideSlab` hard-reject
        // (big-player: το placement ghost ποτέ δεν σβήνει στις άκρες).
        const built = buildSlabOpeningPreviewEntity(params, hostSlab, getDefaultLayerId());
        if (built) {
          if (built.isOutsideSlab) {
            // 🔴 εκτός πλάκας → status schematic αντί WYSIWYG (κοινό SSoT με δοκάρι/κολώνα).
            const statusColor = resolveGhostStatusColor('overlap');
            const outline = params.outline.vertices;
            if (statusColor && outline.length >= 3) {
              drawStatusGhostPolygon(ctx, outline, t, viewport, statusColor);
            }
          } else {
            // εντός πλάκας → πλήρες WYSIWYG μέσω του πραγματικού SlabOpeningRenderer.
            renderWysiwygPlacementGhost(ctx, built.entity as unknown as Entity, t, viewport);
          }
        }
      }
    }

    // --- Edge-midpoint hover indicator (bespoke, ADR-574 §C — δεν είναι placement ghost) ---
    if (hoveredEdgeMidpointGrip) {
      const sp = CoordinateTransforms.worldToScreen(hoveredEdgeMidpointGrip.position, t, viewport);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 200, 120, 0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', sp.x, sp.y);
    }
  }, [isAwaitingPosition, kind, overrides, getHostSlab, hoveredEdgeMidpointGrip, getSceneUnits]);

  useCanvasGhostPreview({
    isActive,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: true,
    draw,
  });
}
