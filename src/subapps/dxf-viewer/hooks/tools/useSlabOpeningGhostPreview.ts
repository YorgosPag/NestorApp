/**
 * ADR-363 Phase 3.7b+ / ADR-574 Σ2b — Slab-opening placement ghost preview hook.
 *
 * Dual-branch WYSIWYG variant του placement-ghost primitive (ADR-624):
 *   1. Placement ghost (`buildGhostEntity` + `paintGhost`) — χτίζει την ΠΛΗΡΗ synthetic
 *      `SlabOpeningEntity` με τους ΙΔΙΟΥΣ commit builders (`buildDefaultSlabOpeningParams`
 *      + `buildSlabOpeningPreviewEntity`, `overrides` + `kind` merged, όπως το
 *      `useSlabOpeningTool.commitFromState`) πάνω στο locked host slab. Εντός πλάκας →
 *      πλήρες WYSIWYG μέσω του ΠΡΑΓΜΑΤΙΚΟΥ `SlabOpeningRenderer`. Εκτός πλάκας
 *      (`isOutsideSlab`) → 🔴 status schematic μέσω του κοινού `drawEntityStatusSchematic`
 *      SSoT (big-player: το placement ghost ποτέ δεν σβήνει στις άκρες).
 *   2. Edge-midpoint hover indicator (`drawOverlay`) — πράσινο «+vertex» affordance στη
 *      θέση του `hoveredEdgeMidpointGrip` (pre-drag hover).
 *
 * RAF/clear/viewport/cursor → `useCanvasGhostPreview` harness (ADR-398 §4).
 * Gate: `isActive = isAwaitingPosition || hoveredEdgeMidpointGrip != null`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Phase 3.7b+
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

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
import { drawEntityStatusSchematic } from '../../bim/ghosts/ghost-status-polygon-draw';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { type SceneUnits } from '../../utils/scene-units';
import { useWysiwygPlacementGhost } from './use-wysiwyg-placement-ghost';

export interface UseSlabOpeningGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly kind: SlabOpeningKind;
  /** Width/depth from ribbon overrides — falls back to kind defaults. */
  readonly overrides: SlabOpeningParamOverrides;
  /**
   * ADR-574 Σ2b — resolver για locked host slab (null όταν δεν υπάρχει
   * awaiting-position host). Mirror του `getHostWall` στο `useOpeningGhostPreview`.
   */
  readonly getHostSlab: () => SlabEntity | null;
  /** ADR-363 Phase 3.7b++ — pre-drag hover indicator for edge-midpoint grips. */
  readonly hoveredEdgeMidpointGrip?: UnifiedGripInfo | null;
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
  /** ADR-370 — active scene units· propagated στον `buildDefaultSlabOpeningParams`. */
  getSceneUnits?(): SceneUnits;
}

/** Το placement payload: entity + το out-of-slab flag που καθορίζει το paint mode. */
interface SlabOpeningGhostBuild {
  readonly entity: Entity;
  readonly isOutsideSlab: boolean;
}

export function useSlabOpeningGhostPreview(props: Readonly<UseSlabOpeningGhostPreviewProps>): void {
  const { isAwaitingPosition, kind, overrides, getHostSlab, hoveredEdgeMidpointGrip, transform, getCanvas, getViewportElement, getSceneUnits } = props;

  // Gate: ενεργό είτε σε placement είτε σε hover mode.
  const isActive = isAwaitingPosition || hoveredEdgeMidpointGrip != null;

  useWysiwygPlacementGhost<SlabOpeningGhostBuild>({
    isActive,
    transform,
    getCanvas,
    getViewportElement,
    buildGhostEntity: ({ effectiveCursor }): SlabOpeningGhostBuild | null => {
      if (!(isAwaitingPosition && effectiveCursor)) return null;
      const hostSlab = getHostSlab();
      if (!hostSlab) return null;
      // Build the FULL entity με τους ΙΔΙΟΥΣ commit builders + overrides source
      // (kind merged in, ακριβώς όπως `commitFromState`), ώστε preview ≡ commit.
      const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
      const overridesWithKind: SlabOpeningParamOverrides = { ...overrides, kind };
      const params = buildDefaultSlabOpeningParams(hostSlab, effectiveCursor, overridesWithKind, sceneUnits);
      // Preview-tolerant build: παρακάμπτει ΜΟΝΟ το `outlineOutsideSlab` hard-reject.
      const built = buildSlabOpeningPreviewEntity(params, hostSlab, getDefaultLayerId());
      if (!built) return null;
      return { entity: built.entity as unknown as Entity, isOutsideSlab: built.isOutsideSlab };
    },
    paintGhost: ({ ctx, transform: t, viewport }, build) => {
      // εκτός πλάκας → 🔴 status schematic μέσω του ΙΔΙΟΥ `drawEntityStatusSchematic`
      // SSoT με το scene preview path· εντός → πλήρες WYSIWYG.
      const overlapColor = build.isOutsideSlab ? resolveGhostStatusColor('overlap') : null;
      if (!(overlapColor && drawEntityStatusSchematic(ctx, build.entity, overlapColor, t, viewport))) {
        renderWysiwygPlacementGhost(ctx, build.entity, t, viewport);
      }
    },
    drawOverlay: ({ ctx, transform: t, viewport }) => {
      // Edge-midpoint hover indicator (bespoke, ADR-574 §C — δεν είναι placement ghost).
      if (!hoveredEdgeMidpointGrip) return;
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
    },
    drawDeps: [isAwaitingPosition, kind, overrides, getHostSlab, hoveredEdgeMidpointGrip, getSceneUnits],
  });
}
