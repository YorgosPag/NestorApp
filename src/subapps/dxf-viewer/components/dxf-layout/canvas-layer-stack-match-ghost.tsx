/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-581 Φ6 — MatchHoverGhostPreviewMount: micro-leaf for the «σύριγγα» live
 * hover ghost. Mirror of `MepFixtureGhostPreviewMount`: subscribes internally
 * (`useMatchHoverGhostPreview` → hover / brush / activeTool) so CanvasSection does
 * NOT re-render. Store-driven — no external payload prop (like the body-drag mount).
 */

'use client';

import React from 'react';
import { useMatchHoverGhostPreview } from '../../hooks/tools/useMatchHoverGhostPreview';
import type { ViewTransform } from '../../rendering/types/Types';
import type { useLevels } from '../../systems/levels';

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface MatchHoverGhostPreviewMountProps {
  transform: ViewTransform;
  levelManager: LevelManagerLike;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MatchHoverGhostPreviewMount = React.memo(function MatchHoverGhostPreviewMount(
  props: MatchHoverGhostPreviewMountProps,
) {
  useMatchHoverGhostPreview(props);
  return null;
});
