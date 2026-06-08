/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * HeatingProposalGhostPreviewMount (ADR-428 Slice 2) — micro-leaf for the heating
 * (hydronic) auto-design proposal ghost. Mirror of
 * `DrainageProposalGhostPreviewMount`, driven by the LOW-FREQUENCY
 * `useHeatingProposal()` store (set on Generate, cleared on Accept/Reject) instead
 * of the 60 fps cursor stream — so the shell never re-renders on its account.
 *
 * Always mounted; it is an inert leaf while no proposal is under review.
 */

'use client';

import React from 'react';
import {
  useHeatingProposalGhostPreview,
  type UseHeatingProposalGhostPreviewProps,
} from '../../hooks/tools/useHeatingProposalGhostPreview';
import type { ViewTransform } from '../../rendering/types/Types';

export interface HeatingProposalGhostPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const HeatingProposalGhostPreviewMount = React.memo(
  function HeatingProposalGhostPreviewMount(props: HeatingProposalGhostPreviewMountProps) {
    const hookProps: UseHeatingProposalGhostPreviewProps = {
      transform: props.transform,
      getCanvas: props.getCanvas,
      getViewportElement: props.getViewportElement,
    };
    useHeatingProposalGhostPreview(hookProps);
    return null;
  },
);
