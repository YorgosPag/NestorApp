/**
 * @module useEntityCompleteGuideListener
 * @enterprise ADR-189 (B121) — Entity → Guide notification listener
 *
 * Subscribes to `EventBus.emit('drawing:complete', ...)` (ADR-057 unified
 * completion pipeline) and invokes `handleEntityComplete(entity, tool)` so the
 * user is offered the "Create Guides" action for every freshly-drawn entity.
 *
 * Skips measurement tools (`MEASURE_TOOLS_FOR_GUIDES`) — those already raise
 * the prompt through the dedicated `onMeasurementComplete` callback (B36).
 */
import { useEffect } from 'react';
import { EventBus } from '../../systems/events';
import type { Entity } from '../../types/entities';
import type { ToolType } from '../../ui/toolbar/types';
import { MEASURE_TOOLS_FOR_GUIDES } from '../drawing/useDrawingHandlers';

export function useEntityCompleteGuideListener(
  handleEntityComplete: (entity: Entity, tool: ToolType | string) => void,
): void {
  useEffect(() => {
    const unsubscribe = EventBus.on('drawing:complete', (payload) => {
      if (!payload?.entity || !payload.tool) return;
      if (MEASURE_TOOLS_FOR_GUIDES.has(payload.tool)) return;
      handleEntityComplete(payload.entity as unknown as Entity, payload.tool);
    });
    return () => { unsubscribe(); };
  }, [handleEntityComplete]);
}
