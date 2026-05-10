'use client';

/**
 * Leaf subscriber for live cursor world coordinates in the toolbar status bar.
 *
 * WHY: Subscribing to `useCursorWorldPosition()` higher in the tree
 * (ToolbarWithCursorCoordinates / EnhancedDXFToolbar) cascaded a full toolbar
 * re-render on every mousemove — N×ToolButton + N×ActionButton each re-running
 * `useTranslation` over 6 namespaces and rebuilding their Tooltip subtrees.
 * Profile (Firefox 2026-05-10): Tooltip 30% + useTranslation 29% of frame.
 *
 * Moving the subscription to this leaf keeps the rest of the toolbar tree
 * stable; only this component re-renders at mousemove rate. ADR-040 Phase H.
 */

import React from 'react';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { formatCoordinate } from '../../rendering/entities/shared/distance-label-utils';

interface ToolbarCoordinatesDisplayProps {
  precision: number;
  className?: string;
}

export const ToolbarCoordinatesDisplay: React.FC<ToolbarCoordinatesDisplayProps> = React.memo(
  function ToolbarCoordinatesDisplay({ precision, className }) {
    const worldPosition = useCursorWorldPosition();
    const x = worldPosition?.x ?? 0;
    const y = worldPosition?.y ?? 0;
    return (
      <strong className={className}>
        X: {formatCoordinate(x, precision)}, Y: {formatCoordinate(y, precision)}
      </strong>
    );
  },
);
