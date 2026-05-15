'use client';
import React from 'react';
import { useTrimPreview } from '../../hooks/tools/useTrimPreview';
import { useTrimDragCapture } from '../../hooks/tools/useTrimDragCapture';
import type { ViewTransform } from '../../rendering/types/Types';

interface TrimPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * ADR-350 micro-leaf — draws TRIM preview + captures fence drag.
 * ADR-040 cardinal rule 1: only this component subscribes to TrimToolStore.
 */
export const TrimPreviewMount = React.memo(function TrimPreviewMount(
  props: TrimPreviewMountProps,
) {
  useTrimPreview(props);
  useTrimDragCapture({ transform: props.transform, getViewportElement: props.getViewportElement });
  return null;
});
