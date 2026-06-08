/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * DrainageProposalGhostPreviewMount (ADR-427 Slice 2) — micro-leaf for the
 * sanitary-drainage auto-design proposal ghost. Mirror of
 * `WaterProposalGhostPreviewMount`, but driven by the LOW-FREQUENCY
 * `useDrainageProposal()` store (set on Generate, cleared on Accept/Reject) instead
 * of the 60 fps cursor stream — so the shell never re-renders on its account.
 *
 * Always mounted; it is an inert leaf while no proposal is under review.
 */

'use client';

import React from 'react';
import {
  useDrainageProposalGhostPreview,
  type UseDrainageProposalGhostPreviewProps,
} from '../../hooks/tools/useDrainageProposalGhostPreview';
import type { ViewTransform } from '../../rendering/types/Types';

export interface DrainageProposalGhostPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const DrainageProposalGhostPreviewMount = React.memo(
  function DrainageProposalGhostPreviewMount(props: DrainageProposalGhostPreviewMountProps) {
    const hookProps: UseDrainageProposalGhostPreviewProps = {
      transform: props.transform,
      getCanvas: props.getCanvas,
      getViewportElement: props.getViewportElement,
    };
    useDrainageProposalGhostPreview(hookProps);
    return null;
  },
);
