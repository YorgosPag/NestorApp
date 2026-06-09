/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * GasProposalGhostPreviewMount (ADR-434 Slice 2) — micro-leaf for the gas
 * (φυσικό αέριο) auto-design proposal ghost. Mirror of
 * `HvacProposalGhostPreviewMount`, but driven by the LOW-FREQUENCY
 * `useGasProposal()` store (set on Generate, cleared on Accept/Reject) instead of
 * the 60 fps cursor stream — so the shell never re-renders on its account.
 *
 * Always mounted; it is an inert leaf while no proposal is under review.
 */

'use client';

import React from 'react';
import {
  useGasProposalGhostPreview,
  type UseGasProposalGhostPreviewProps,
} from '../../hooks/tools/useGasProposalGhostPreview';
import type { ViewTransform } from '../../rendering/types/Types';

export interface GasProposalGhostPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const GasProposalGhostPreviewMount = React.memo(function GasProposalGhostPreviewMount(
  props: GasProposalGhostPreviewMountProps,
) {
  const hookProps: UseGasProposalGhostPreviewProps = {
    transform: props.transform,
    getCanvas: props.getCanvas,
    getViewportElement: props.getViewportElement,
  };
  useGasProposalGhostPreview(hookProps);
  return null;
});
