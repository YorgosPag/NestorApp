'use client';
import React, { useState } from 'react';
import type { DXFViewerLayoutProps } from '../../integration/types';
import { ToolbarSection } from './ToolbarSection';
import { CanvasSection } from './CanvasSection';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';

/**
 * Renders the DXF viewer in its normal, non-fullscreen layout.
 */
export const NormalView: React.FC<DXFViewerLayoutProps> = (props) => {
  // Shared overlay state between toolbar and canvas
  const [overlayMode, setOverlayMode] = useState<OverlayEditorMode>('select');
  const [currentStatus, setCurrentStatus] = useState<Status>('for-sale');
  const [currentKind, setCurrentKind] = useState<OverlayKind>('unit');

  return (
    <div className="relative flex flex-col h-full bg-gray-900">
      <ToolbarSection 
        {...props} 
        overlayMode={overlayMode}
        setOverlayMode={setOverlayMode}
        currentStatus={currentStatus}
        setCurrentStatus={setCurrentStatus}
        currentKind={currentKind}
        setCurrentKind={setCurrentKind}
      />
      <div className="flex-1 flex overflow-hidden">
        <CanvasSection 
          {...props} 
          overlayMode={overlayMode}
          currentStatus={currentStatus}
          currentKind={currentKind}
        />
      </div>

      {/* FloatingPanel μετακινήθηκε στο DXFViewerLayout */}
    </div>
  );
};
