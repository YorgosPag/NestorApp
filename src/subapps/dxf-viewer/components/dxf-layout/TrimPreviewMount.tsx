'use client';
import React from 'react';
import { useTrimPreview } from '../../hooks/tools/useTrimPreview';
import type { ViewTransform } from '../../rendering/types/Types';

interface TrimPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * ADR-350 Phase 2 micro-leaf — draws TRIM hover highlight on PreviewCanvas.
 * Subscribes only to TrimToolStore. Only this component re-renders during
 * a TRIM session — NOT CanvasLayerStack (ADR-040 cardinal rule 1).
 */
export const TrimPreviewMount = React.memo(function TrimPreviewMount(
  props: TrimPreviewMountProps,
) {
  useTrimPreview(props);
  return null;
});
