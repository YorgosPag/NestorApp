'use client';
import React from 'react';
import { useExtendPreview } from '../../hooks/tools/useExtendPreview';
import { useExtendDragCapture } from '../../hooks/tools/useExtendDragCapture';
import type { ViewTransform } from '../../rendering/types/Types';

interface ExtendPreviewOverlayProps {
  transform: ViewTransform;
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
  useExtendDragCapture({ transform: props.transform, getViewportElement: props.getViewportElement });
  return null;
});
