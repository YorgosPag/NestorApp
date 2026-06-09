/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ElectricalProposalGhostPreviewMount (ADR-430 Slice 2) — micro-leaf for the
 * electrical-strong auto-design proposal ghost. Mirror of
 * `HeatingProposalGhostPreviewMount`, driven by the LOW-FREQUENCY
 * `useElectricalProposal()` store (set on Generate, cleared on Accept/Reject) instead
 * of the 60 fps cursor stream — so the shell never re-renders on its account.
 *
 * Always mounted; it is an inert leaf while no proposal is under review.
 */

'use client';

import React from 'react';
import {
  useElectricalProposalGhostPreview,
  type UseElectricalProposalGhostPreviewProps,
} from '../../hooks/tools/useElectricalProposalGhostPreview';
import type { ViewTransform } from '../../rendering/types/Types';

export interface ElectricalProposalGhostPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const ElectricalProposalGhostPreviewMount = React.memo(
  function ElectricalProposalGhostPreviewMount(props: ElectricalProposalGhostPreviewMountProps) {
    const hookProps: UseElectricalProposalGhostPreviewProps = {
      transform: props.transform,
      getCanvas: props.getCanvas,
      getViewportElement: props.getViewportElement,
    };
    useElectricalProposalGhostPreview(hookProps);
    return null;
  },
);
