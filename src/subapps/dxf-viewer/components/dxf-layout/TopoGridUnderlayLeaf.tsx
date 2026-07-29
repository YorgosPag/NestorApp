/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-656 M11 — TopoGridUnderlayLeaf: the micro-leaf that owns the (low-freq) grid-visibility
 * subscription for the ΕΓΣΑ87 graticule.
 *
 * ADR-040 CHECK 6C forbids `useSyncExternalStore` in the CanvasSection / CanvasLayerStack
 * orchestrators, so the subscription to `topo-grid-store` lives HERE, in a thin leaf, not in the
 * Shell. The Shell hands `transform` / `viewport` down as props (it already threads them to the
 * sibling `GridUnderlayCanvas`); this leaf adds only the visibility flag and forwards everything
 * to `TopoGridUnderlayCanvas`. `visible` is low-freq (a toggle), unlike transform/hover — a single
 * cheap subscription with no per-frame churn.
 */

'use client';

import { useSyncExternalStore } from 'react';
import { TopoGridUnderlayCanvas } from './TopoGridUnderlayCanvas';
import { isTopoGridVisible, subscribeTopoGrid } from '../../systems/topography/topo-grid-store';

// ADR-040 Phase XXII.B — το transform prop αφαιρέθηκε: ο TopoGridUnderlayCanvas ζωγραφίζει
// πλέον μέσω subscribeImmediateTransformFrame (zero React ανά καρέ).
export interface TopoGridUnderlayLeafProps {
  viewport: { width: number; height: number };
  className?: string;
}

export function TopoGridUnderlayLeaf({ viewport, className }: TopoGridUnderlayLeafProps) {
  // LOW-freq subscription (a visibility toggle) — permitted in a leaf, never in the Shell (CHECK 6C).
  const visible = useSyncExternalStore(subscribeTopoGrid, isTopoGridVisible, isTopoGridVisible);

  return (
    <TopoGridUnderlayCanvas
      viewport={viewport}
      visible={visible}
      className={className}
    />
  );
}
