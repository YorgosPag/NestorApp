'use client';

/**
 * ADR-344 Phase 6.D — Host wrapper for Text Properties tab.
 *
 * Bridges the FloatingPanelContainer to the pure `TextPropertiesPanel`
 * component. Sources its data from real stores / scene model:
 *
 *   - layers           ← `useTextPanelLayers`   (current scene's STYLE table)
 *   - availableFonts   ← `useTextPanelFonts`    (fontCache + scene fonts)
 *   - documentVersion  ← `useTextPanelDocumentVersion` ($ACADVER lookup)
 *   - annotationScales ← synced from selected entity's textNode on selection
 *                        change; edits immediately dispatched as commands
 *
 * The two callback wirings (font upload modal, token insert into editor)
 * remain deferred to Phase 7: they require a portaled modal container
 * and a live TipTap editor handle respectively, both of which arrive
 * with the canvas-side text editor integration in the next phase.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TextPropertiesPanel } from './TextPropertiesPanel';
import type { AnnotationScale } from '../../text-engine/types';
import { useTextPanelLayers } from './hooks/useTextPanelLayers';
import { useTextPanelFonts } from './hooks/useTextPanelFonts';
import { useTextPanelDocumentVersion } from './hooks/useTextPanelDocumentVersion';
import { useTextSelectionStore } from '../../state/text-toolbar';
import { useCurrentSceneModel } from './hooks/useCurrentSceneModel';
import { useDxfTextServices } from './hooks/useDxfTextServices';
import { ensureTextNode } from '../../text-engine/edit';
import { UpdateTextAnnotationScalesCommand } from '../../core/commands/text/UpdateTextAnnotationScalesCommand';
import { getGlobalCommandHistory } from '../../core/commands';
import type { AnySceneEntity } from '../../types/scene';

export function TextPropertiesPanelHost() {
  // Phase 6.E: selection sync + command bridge are mounted in DxfViewerContent
  // (always-on) so they work whether this panel is open or not.

  const layers = useTextPanelLayers();
  const availableFonts = useTextPanelFonts();
  const documentVersion = useTextPanelDocumentVersion();
  const [scales, setScales] = useState<readonly AnnotationScale[]>([]);

  const selectedIds = useTextSelectionStore((s) => s.selectedIds);
  const scene = useCurrentSceneModel();
  const services = useDxfTextServices();

  // Sync annotation scales from first selected entity on selection change.
  const prevFirstId = useRef<string | null>(null);
  useEffect(() => {
    const firstId = selectedIds[0] ?? null;
    if (firstId === prevFirstId.current) return;
    prevFirstId.current = firstId;
    if (!firstId || !scene) { setScales([]); return; }
    const byId = new Map<string, AnySceneEntity>();
    for (const e of scene.entities) byId.set(e.id, e);
    const entity = byId.get(firstId);
    if (!entity || (entity.type !== 'text' && entity.type !== 'mtext')) { setScales([]); return; }
    const node = ensureTextNode(entity as unknown as Parameters<typeof ensureTextNode>[0]);
    setScales(node.annotationScales);
  }, [selectedIds, scene]);

  const handleScalesChange = useCallback((next: readonly AnnotationScale[]) => {
    setScales(next);
    if (!services) return;
    const history = getGlobalCommandHistory();
    for (const entityId of selectedIds) {
      const cmd = new UpdateTextAnnotationScalesCommand(
        { entityId, annotationScales: next },
        services.sceneManager,
        services.layerProvider,
        services.auditRecorder,
      );
      history.execute(cmd);
    }
  }, [services, selectedIds]);

  const onRequestFontUpload = useCallback(() => {
    // Phase 7 — open FontManagerPanel via the floating-panel modal portal.
  }, []);

  const onInsertToken = useCallback((_token: string) => {
    // Phase 7 — dispatch into the active TipTap editor session via a
    // shared editor handle published by the in-canvas text overlay.
  }, []);

  return (
    <TextPropertiesPanel
      layers={layers}
      availableFonts={availableFonts}
      documentVersion={documentVersion}
      annotationScales={scales}
      paperHeightDefault={2.5}
      onRequestFontUpload={onRequestFontUpload}
      onInsertToken={onInsertToken}
      onAnnotationScalesChange={handleScalesChange}
    />
  );
}
