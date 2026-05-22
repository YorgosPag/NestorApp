'use client';

/**
 * ADR-366 Phase 9 / C.3.Q7 — useDim3DToolRouting.
 *
 * Cross-mode dispatcher: a single ribbon button drives 2D OR 3D dimension
 * creation depending on the current ViewMode3D. When `mode === '2d'` the call
 * is forwarded to the existing 2D dimension-create hook; otherwise it runs
 * through the 3D pipeline (BimDimensions3DStore + BimDimensions3DService).
 *
 * The hook returns a small action surface so consumers (ribbon button, hotkey
 * dispatcher) stay mode-agnostic.
 */

import { useCallback, useMemo } from 'react';
import { useViewMode3DStore, type ViewMode3D } from '../stores/ViewMode3DStore';
import {
  selectDim3DToolActive,
  useBimDimensions3DStore,
} from '../stores/BimDimensions3DStore';
import type { Dim3DMode } from './dim3d-types';

export type ActiveDimToolMode = '2d' | '3d' | 'inactive';

export interface Dim3DRoutingAPI {
  readonly activeMode: ActiveDimToolMode;
  readonly is3DActive: boolean;
  activate(mode?: Dim3DMode): void;
  deactivate(): void;
  cycleMode(): void;
}

export function useDim3DToolRouting(): Dim3DRoutingAPI {
  const viewMode = useViewMode3DStore((s) => s.mode);
  const toolActive3D = useBimDimensions3DStore(selectDim3DToolActive);
  const activate3D = useBimDimensions3DStore((s) => s.activateTool);
  const deactivate3D = useBimDimensions3DStore((s) => s.deactivateTool);
  const cycle3D = useBimDimensions3DStore((s) => s.cycleToolMode);

  const activeMode = resolveActiveMode(viewMode, toolActive3D);
  const is3DActive = activeMode === '3d';

  const activate = useCallback(
    (mode?: Dim3DMode) => {
      if (viewMode === '2d') {
        // 2D dispatch: existing dim hook owns activation via ADR-362 tool state.
        // We surface intent through a custom event so the 2D ribbon picks it up
        // without coupling 3D module to 2D internals.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('dim:activate-2d', { detail: { mode: mode ?? 'aligned' } }),
          );
        }
        return;
      }
      activate3D(mode);
    },
    [viewMode, activate3D],
  );

  const deactivate = useCallback(() => {
    if (viewMode === '2d') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dim:deactivate-2d'));
      }
      return;
    }
    deactivate3D();
  }, [viewMode, deactivate3D]);

  const cycleMode = useCallback(() => {
    if (viewMode === '2d') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dim:cycle-mode-2d'));
      }
      return;
    }
    cycle3D();
  }, [viewMode, cycle3D]);

  return useMemo(
    () => ({ activeMode, is3DActive, activate, deactivate, cycleMode }),
    [activeMode, is3DActive, activate, deactivate, cycleMode],
  );
}

function resolveActiveMode(viewMode: ViewMode3D, toolActive3D: boolean): ActiveDimToolMode {
  if (viewMode === '2d') return '2d';
  if (toolActive3D) return '3d';
  return 'inactive';
}
