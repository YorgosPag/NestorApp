'use client';

/**
 * ADR-344 Phase 6.D — Host wrapper for Text Properties tab.
 *
 * Bridges the FloatingPanelContainer to the pure `TextPropertiesPanel`.
 * Annotation scale management, font family, line spacing and layer
 * controls all live in the Ribbon contextual tab (ADR-345 Fase 6 SSoT).
 *
 * Only token insertion is wired here; the TipTap editor handle arrives
 * in Phase 7 (canvas-side text editor integration).
 */

import React, { useCallback } from 'react';
import { TextPropertiesPanel } from './TextPropertiesPanel';
import { useTextSelectionStore } from '../../state/text-toolbar';
import { useDxfTextServices } from './hooks/useDxfTextServices';
import { InsertTextTokenCommand } from '../../core/commands/text/InsertTextTokenCommand';
import { getGlobalCommandHistory } from '../../core/commands';

export function TextPropertiesPanelHost() {
  const selectedIds = useTextSelectionStore((s) => s.selectedIds);
  const services = useDxfTextServices();

  const onInsertToken = useCallback((token: string) => {
    if (!services || selectedIds.length === 0) return;
    const h = getGlobalCommandHistory();
    for (const entityId of selectedIds) {
      h.execute(new InsertTextTokenCommand(
        { entityId, token },
        services.sceneManager,
        services.layerProvider,
        services.auditRecorder,
      ));
    }
  }, [services, selectedIds]);

  return (
    <TextPropertiesPanel onInsertToken={onInsertToken} />
  );
}
