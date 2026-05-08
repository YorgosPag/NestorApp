'use client';

import React from 'react';
import type { EnhancedDXFToolbarPropsExtended } from '../toolbar/types';
import { EnhancedDXFToolbar } from '../toolbar/EnhancedDXFToolbar';
import { useCursor, useCursorWorldPosition } from '../../systems/cursor';

export function ToolbarWithCursorCoordinates(props: EnhancedDXFToolbarPropsExtended) {
  const { settings } = useCursor();
  // 🚀 PERF: read worldPosition via useSyncExternalStore to avoid re-rendering
  // the parent toolbar on every mousemove (otherwise the entire toolbar
  // subtree re-renders @ 20fps from cursor reducer dispatch).
  const worldPosition = useCursorWorldPosition();

  return (
    <EnhancedDXFToolbar
      {...props}
      mouseCoordinates={worldPosition}
      showCoordinates={settings.behavior.coordinate_display}
    />
  );
}
