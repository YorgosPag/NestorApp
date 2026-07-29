'use client';
import React from 'react';
import { useExtendPreview } from '../../hooks/tools/useExtendPreview';
import { useExtendDragCapture } from '../../hooks/tools/useExtendDragCapture';

interface ExtendPreviewOverlayProps {
  // ADR-040 Phase XXII.B — το transform prop αφαιρέθηκε (βλ. ImmediateTransformStore SSoT).
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * ADR-353 micro-leaf — draws EXTEND preview overlay + captures pointermove.
 * ADR-040 cardinal rule 1: only this component subscribes to ExtendToolStore.
 */
export const ExtendPreviewOverlay = React.memo(function ExtendPreviewOverlay(
  props: ExtendPreviewOverlayProps,
) {
  useExtendPreview(props);
  useExtendDragCapture({ getViewportElement: props.getViewportElement });
  return null;
});
