'use client';

import React from 'react';
import type { EnhancedDXFToolbarPropsExtended } from '../toolbar/types';
import { EnhancedDXFToolbar } from '../toolbar/EnhancedDXFToolbar';
import { useCursor } from '../../systems/cursor';

// ADR-040 Phase H (2026-05-10): cursor world position is now subscribed inside
// ToolbarCoordinatesDisplay (leaf) — reading it here re-rendered the whole
// toolbar tree on every mousemove (Tooltip 30% / useTranslation 29% in profile).
export function ToolbarWithCursorCoordinates(props: EnhancedDXFToolbarPropsExtended) {
  const { settings } = useCursor();

  return (
    <EnhancedDXFToolbar
      {...props}
      showCoordinates={settings.behavior.coordinate_display}
    />
  );
}
