'use client';
import React from 'react';
import { useOffsetPreview } from '../../hooks/tools/useOffsetPreview';
import type { ViewTransform } from '../../rendering/types/Types';

interface OffsetPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * ADR-510 Φ4d micro-leaf — draws the OFFSET live ghost. No pointer capture: the
 * «άμεσο» UX recomputes the ghost each frame from cursor + source.
 * ADR-040 cardinal rule 1: only this component subscribes to OffsetToolStore.
 */
export const OffsetPreviewMount = React.memo(function OffsetPreviewMount(
  props: OffsetPreviewMountProps,
) {
  useOffsetPreview(props);
  return null;
});
