'use client';

import React from 'react';
import { NormalView, FullscreenView } from '../components/dxf-layout';
import type { DXFViewerLayoutProps } from './types';

/**
 * Main layout component for the DXF Viewer.
 * Acts as an orchestrator, deciding which view mode to render (Normal or Fullscreen).
 */
export const DXFViewerLayout: React.FC<DXFViewerLayoutProps> = (props) => {
    
  // The logic for which view to show (e.g. fullscreen) would be managed by the parent state.
  // For now, we'll just render the NormalView.
  // In a future step, a state like 'viewMode' could be used to switch between NormalView and FullscreenView.

  return (
    <div className="relative flex flex-col h-full">
      <NormalView {...props} />
    </div>
  );
};
