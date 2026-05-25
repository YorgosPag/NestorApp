/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * OpeningGhostPreviewMount (ADR-363 Phase 2 canvas-wiring follow-up,
 * 2026-05-25) — micro-leaf για το opening placement ghost preview. Extracted
 * as separate file to keep canvas-layer-stack-leaves.tsx ≤500 lines
 * (Google SRP / N.7.1).
 *
 * Subscribes εσωτερικά στο cursor world position store (useOpeningGhostPreview)
 * — CanvasSection / CanvasLayerStack δεν re-renderάρει σε mousemove.
 */

'use client';

import React from 'react';
import { useOpeningGhostPreview } from '../../hooks/tools/useOpeningGhostPreview';
import type { OpeningKind } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningParamOverrides } from '../../hooks/drawing/opening-completion';
import type { ViewTransform } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';

export interface OpeningGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  kind: OpeningKind;
  overrides: OpeningParamOverrides;
  /** Resolver — returns the locked host wall όσο `isAwaitingPosition === true`. */
  getHostWall: () => WallEntity | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
  /** ADR-370 — active scene units για mm→scene conversion. */
  getSceneUnits?: () => SceneUnits;
}

export const OpeningGhostPreviewMount = React.memo(function OpeningGhostPreviewMount(
  props: OpeningGhostPreviewMountProps,
) {
  useOpeningGhostPreview(props);
  return null;
});
