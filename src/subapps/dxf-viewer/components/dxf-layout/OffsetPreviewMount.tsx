'use client';
import React from 'react';
import { useOffsetPreview } from '../../hooks/tools/useOffsetPreview';

interface OffsetPreviewMountProps {
  // ADR-040 Phase XXII.B — το transform prop αφαιρέθηκε (βλ. ImmediateTransformStore SSoT).
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
