'use client';

import { buildViewerProps } from '../utils/buildViewerProps';
import type { ViewerProps, PublicViewerHookShape } from '../types/publicViewer';

export function useViewerProps(hook: PublicViewerHookShape) {
  const viewerProps: ViewerProps = buildViewerProps(hook);
  return viewerProps;
}
