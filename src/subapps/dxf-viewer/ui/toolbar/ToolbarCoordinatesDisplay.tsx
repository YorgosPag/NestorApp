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
// ADR-366 §B.2.Q1 follow-up — in 3D the cursor readout carries a third (vertical) axis.
import {
  getBim3DCursorReadout,
  subscribeBim3DCursorReadout,
} from '../../bim-3d/stores/Bim3DCursorReadoutStore';

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
      const fmt = (v: number): string => formatCoordinateForDisplay(v, { precision, withUnit: false });
      const render = (): void => {
        if (!ref.current) return;
        // ADR-462: convert canonical-mm → active display unit + locale; a single unit
        // label trails all axes (Revit/AutoCAD status-bar convention).
        // ADR-366 §B.2.Q1 follow-up — in the 3D viewport the cursor readout carries a
        // third (vertical) axis; the 3D channel takes precedence when active, else the
        // 2D world-position channel renders the usual X/Y.
        const r3d = getBim3DCursorReadout();
        if (r3d) {
          ref.current.textContent = `X: ${fmt(r3d.x)}, Y: ${fmt(r3d.y)}, Z: ${fmt(r3d.z)} ${currentDisplayUnitLabel()}`;
          return;
        }
        const wp = getImmediateWorldPosition();
        ref.current.textContent = `X: ${fmt(wp?.x ?? 0)}, Y: ${fmt(wp?.y ?? 0)} ${currentDisplayUnitLabel()}`;
      };
      render();
      const offPosition = subscribeToImmediateWorldPosition(render);
      const off3D = subscribeBim3DCursorReadout(render);
      // Live unit switch: repaint the readout the moment the selector changes,
      // not only on the next mousemove.
      const offUnit = displayUnitState.subscribe(render);
      return () => {
        offPosition();
        off3D();
        offUnit();
      };
    }, [precision]);

    return <strong ref={ref} className={className} />;
  },
);
