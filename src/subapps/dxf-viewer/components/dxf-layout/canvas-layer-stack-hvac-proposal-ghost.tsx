/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * HvacProposalGhostPreviewMount (ADR-432 Slice 2) — micro-leaf for the
 * HVAC (ventilation) auto-design proposal ghost. Mirror of
 * `WaterProposalGhostPreviewMount`, but driven by the LOW-FREQUENCY
 * `useHvacProposal()` store (set on Generate, cleared on Accept/Reject) instead
 * of the 60 fps cursor stream — so the shell never re-renders on its account.
 *
 * Always mounted; it is an inert leaf while no proposal is under review.
 */

'use client';

import React from 'react';
import {
  useHvacProposalGhostPreview,
  type UseHvacProposalGhostPreviewProps,
} from '../../hooks/tools/useHvacProposalGhostPreview';
import type { ViewTransform } from '../../rendering/types/Types';

export interface HvacProposalGhostPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const HvacProposalGhostPreviewMount = React.memo(function HvacProposalGhostPreviewMount(
  props: HvacProposalGhostPreviewMountProps,
) {
  const hookProps: UseHvacProposalGhostPreviewProps = {
    transform: props.transform,
    getCanvas: props.getCanvas,
    getViewportElement: props.getViewportElement,
  };
  useHvacProposalGhostPreview(hookProps);
  return null;
});
