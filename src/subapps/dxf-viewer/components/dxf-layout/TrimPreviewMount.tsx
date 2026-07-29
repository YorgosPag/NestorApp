'use client';
import React from 'react';
import { useTrimPreview } from '../../hooks/tools/useTrimPreview';
import { useTrimDragCapture } from '../../hooks/tools/useTrimDragCapture';

interface TrimPreviewMountProps {
  // ADR-040 Phase XXII.B — το transform prop αφαιρέθηκε (βλ. ImmediateTransformStore SSoT).
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
  useTrimDragCapture({ getViewportElement: props.getViewportElement });
  return null;
});
