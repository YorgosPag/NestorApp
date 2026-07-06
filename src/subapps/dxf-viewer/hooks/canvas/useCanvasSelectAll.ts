/**
 * useCanvasSelectAll — ADR-040 / ADR-532.
 *
 * Thin wiring hook extracted from CanvasSection to keep the orchestrator under
 * the 500-line budget (N.7.1). Owns the `canvas:select-all` (Ctrl+A) EventBus
 * subscription: selects every DXF entity of the live scene.
 *
 * ADR-040 compliance: adds no store subscription — a single `eventBus.on`
 * listener that reads the scene through the caller-owned `dxfSceneRef` (fresh at
 * event time) and writes through `setSelectedEntityIds` (universalSelection SSoT).
 */
'use client';

import { useEffect, type RefObject } from 'react';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { useEventBus } from '../../systems/events';

export interface UseCanvasSelectAllProps {
  eventBus: ReturnType<typeof useEventBus>;
  dxfSceneRef: RefObject<DxfScene | null>;
  setSelectedEntityIds: (ids: string[]) => void;
}

export function useCanvasSelectAll({
  eventBus,
  dxfSceneRef,
  setSelectedEntityIds,
}: UseCanvasSelectAllProps): void {
  // Ctrl+A: select all DXF entities — fired via EventBus from useKeyboardShortcuts.
  // setSelectedEntityIds writes through universalSelection (SSoT).
  useEffect(() => {
    return eventBus.on('canvas:select-all', () => {
      const entities = dxfSceneRef.current?.entities;
      if (!entities?.length) return;
      setSelectedEntityIds(entities.map(e => e.id));
    });
  }, [eventBus, dxfSceneRef, setSelectedEntityIds]);
}
