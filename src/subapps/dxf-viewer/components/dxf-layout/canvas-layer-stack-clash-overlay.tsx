/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ClashOverlayMount (ADR-435 Slice 1) — micro-leaf for the clash-detection report
 * overlay. Mirror of `WaterProposalGhostPreviewMount`, driven by the LOW-FREQUENCY
 * `useClashReport()` store (set on Detect, cleared on Clear) — so the shell never
 * re-renders on its account.
 *
 * Always mounted; an inert leaf while no clash report is under review.
 */

'use client';

import React from 'react';
import {
  useClashOverlayPreview,
  type UseClashOverlayPreviewProps,
} from '../../hooks/tools/useClashOverlayPreview';
import type { ViewTransform } from '../../rendering/types/Types';

export interface ClashOverlayMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const ClashOverlayMount = React.memo(function ClashOverlayMount(
  props: ClashOverlayMountProps,
) {
  const hookProps: UseClashOverlayPreviewProps = {
    transform: props.transform,
    getCanvas: props.getCanvas,
    getViewportElement: props.getViewportElement,
  };
  useClashOverlayPreview(hookProps);
  return null;
});
