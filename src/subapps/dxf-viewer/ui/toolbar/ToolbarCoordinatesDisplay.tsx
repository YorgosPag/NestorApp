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

import React, { useEffect, useRef } from 'react';
import {
  getImmediateWorldPosition,
  subscribeToImmediateWorldPosition,
} from '../../systems/cursor/ImmediatePositionStore';
// 🏢 ADR-462: display-unit SSoT — cursor X/Y readout follows the status-bar unit
import {
  formatCoordinateForDisplay,
  currentDisplayUnitLabel,
} from '../../config/display-length-format';
import { displayUnitState } from '../../config/display-unit-state';

interface ToolbarCoordinatesDisplayProps {
  precision: number;
  className?: string;
}

/**
 * Live cursor X/Y in the status bar. ADR-040: instead of subscribing via React
 * (`useCursorWorldPosition` → a React re-render + `commitTextUpdate` on every
 * mousemove), the readout writes `textContent` DIRECTLY from the world-position
 * store subscription — same bypass-React pattern as the compositor crosshair.
 * Result: zero React reconciliation on the 60fps cursor stream.
 */
export const ToolbarCoordinatesDisplay: React.FC<ToolbarCoordinatesDisplayProps> = React.memo(
  function ToolbarCoordinatesDisplay({ precision, className }) {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
      const render = (): void => {
        const wp = getImmediateWorldPosition();
        const x = wp?.x ?? 0;
        const y = wp?.y ?? 0;
        if (ref.current) {
          // ADR-462: convert canonical-mm → active display unit + locale; a single
          // unit label trails both axes (Revit/AutoCAD status-bar convention).
          const fx = formatCoordinateForDisplay(x, { precision, withUnit: false });
          const fy = formatCoordinateForDisplay(y, { precision, withUnit: false });
          ref.current.textContent = `X: ${fx}, Y: ${fy} ${currentDisplayUnitLabel()}`;
        }
      };
      render();
      const offPosition = subscribeToImmediateWorldPosition(render);
      // Live unit switch: repaint the readout the moment the selector changes,
      // not only on the next mousemove.
      const offUnit = displayUnitState.subscribe(render);
      return () => {
        offPosition();
        offUnit();
      };
    }, [precision]);

    return <strong ref={ref} className={className} />;
  },
);
