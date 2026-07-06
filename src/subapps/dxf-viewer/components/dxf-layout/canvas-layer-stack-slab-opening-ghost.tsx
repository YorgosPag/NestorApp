/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * SlabOpeningGhostPreviewMount (ADR-363 Phase 3.7b+) — micro-leaf για το
 * slab-opening placement ghost preview. Extracted as separate file to keep
 * canvas-layer-stack-leaves.tsx ≤500 lines (Google SRP / N.7.1).
 *
 * Subscribes εσωτερικά στο cursor world position store (useSlabOpeningGhostPreview)
 * — CanvasSection δεν re-renderάρει σε mousemove.
 */

'use client';

import React from 'react';
import { useSlabOpeningGhostPreview } from '../../hooks/tools/useSlabOpeningGhostPreview';
import type { SlabOpeningKind } from '../../bim/types/slab-opening-types';
import type { SlabOpeningParamOverrides } from '../../hooks/drawing/slab-opening-completion';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { ViewTransform } from '../../rendering/types/Types';
import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type { SceneUnits } from '../../utils/scene-units';

export interface SlabOpeningGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  kind: SlabOpeningKind;
  overrides: SlabOpeningParamOverrides;
  /** ADR-574 Σ2b — locked host slab resolver (WYSIWYG ghost via commit builders). */
  getHostSlab: () => SlabEntity | null;
  hoveredEdgeMidpointGrip?: UnifiedGripInfo | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
  /** ADR-370 — active scene units για mm→scene conversion στο ghost rectangle. */
  getSceneUnits?: () => SceneUnits;
}

export const SlabOpeningGhostPreviewMount = React.memo(function SlabOpeningGhostPreviewMount(
  props: SlabOpeningGhostPreviewMountProps,
) {
  useSlabOpeningGhostPreview(props);
  return null;
});
