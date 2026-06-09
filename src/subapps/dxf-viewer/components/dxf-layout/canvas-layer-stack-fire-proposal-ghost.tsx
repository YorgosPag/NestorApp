/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * FireProposalGhostPreviewMount (ADR-433 Slice 2) — micro-leaf for the
 * fire-protection (sprinkler) auto-design proposal ghost. Mirror of
 * `HvacProposalGhostPreviewMount`, but driven by the LOW-FREQUENCY
 * `useFireProposal()` store (set on Generate, cleared on Accept/Reject) instead of
 * the 60 fps cursor stream — so the shell never re-renders on its account.
 *
 * Always mounted; it is an inert leaf while no proposal is under review.
 */

'use client';

import React from 'react';
import {
  useFireProposalGhostPreview,
  type UseFireProposalGhostPreviewProps,
} from '../../hooks/tools/useFireProposalGhostPreview';
import type { ViewTransform } from '../../rendering/types/Types';

export interface FireProposalGhostPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const FireProposalGhostPreviewMount = React.memo(function FireProposalGhostPreviewMount(
  props: FireProposalGhostPreviewMountProps,
) {
  const hookProps: UseFireProposalGhostPreviewProps = {
    transform: props.transform,
    getCanvas: props.getCanvas,
    getViewportElement: props.getViewportElement,
  };
  useFireProposalGhostPreview(hookProps);
  return null;
});
