/**
 * ZoomWindowSubscriber — ADR-374 micro-leaf (ADR-040 compliant).
 *
 * Subscribes to ZoomWindowStore via useSyncExternalStore (the ONLY store
 * subscription for the zoom-window tool). Renders ZoomWindowOverlay when
 * the drag is active; nothing otherwise.
 *
 * Living BELOW the CanvasLayerStack shell satisfies ADR-040 §1
 * (orchestrators MUST NOT subscribe to high-freq stores).
 */
'use client';

import React, { useSyncExternalStore } from 'react';
import { ZoomWindowStore } from '../../../systems/zoom-window/ZoomWindowStore';
import ZoomWindowOverlay from '../../../canvas-v2/overlays/ZoomWindowOverlay';

interface ZoomWindowSubscriberProps {
  className?: string;
}

export const ZoomWindowSubscriber = React.memo(function ZoomWindowSubscriber({
  className,
}: ZoomWindowSubscriberProps) {
  const state = useSyncExternalStore(
    ZoomWindowStore.subscribe,
    ZoomWindowStore.getSnapshot,
    ZoomWindowStore.getServerSnapshot,
  );

  if (!state.isActive) return null;

  return (
    <ZoomWindowOverlay
      zoomWindowState={{
        isActive: state.isActive,
        isDragging: state.isDragging,
        startPoint: state.startPoint,
        currentPoint: state.currentPoint,
        previewRect: state.previewRect,
      }}
      className={className}
    />
  );
});
