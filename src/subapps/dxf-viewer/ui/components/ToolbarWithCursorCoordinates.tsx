'use client';

import React from 'react';
import type { EnhancedDXFToolbarPropsExtended } from '../toolbar/types';
import { EnhancedDXFToolbar } from '../toolbar/EnhancedDXFToolbar';
import { useCursor } from '../../systems/cursor';

export function ToolbarWithCursorCoordinates(props: EnhancedDXFToolbarPropsExtended) {
  const { worldPosition, settings } = useCursor();

  return (
    <EnhancedDXFToolbar
      {...props}
      mouseCoordinates={worldPosition}
      showCoordinates={settings.behavior.coordinate_display}
    />
  );
}
