/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * WaterProposalGhostPreviewMount (ADR-426 Slice 2) — micro-leaf for the
 * water-supply auto-design proposal ghost. Mirror of
 * `MepSegmentGhostPreviewMount`, but driven by the LOW-FREQUENCY
 * `useWaterProposal()` store (set on Generate, cleared on Accept/Reject) instead
 * of the 60 fps cursor stream — so the shell never re-renders on its account.
 *
 * Always mounted; it is an inert leaf while no proposal is under review.
 */

'use client';

import React from 'react';
import {
  useWaterProposalGhostPreview,
  type UseWaterProposalGhostPreviewProps,
} from '../../hooks/tools/useWaterProposalGhostPreview';
import type { ViewTransform } from '../../rendering/types/Types';

export interface WaterProposalGhostPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const WaterProposalGhostPreviewMount = React.memo(function WaterProposalGhostPreviewMount(
  props: WaterProposalGhostPreviewMountProps,
) {
  const hookProps: UseWaterProposalGhostPreviewProps = {
    transform: props.transform,
    getCanvas: props.getCanvas,
    getViewportElement: props.getViewportElement,
  };
  useWaterProposalGhostPreview(hookProps);
  return null;
});
