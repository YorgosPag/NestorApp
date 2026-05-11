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
 *   - annotationScales ← local state owned by the panel (per-edit UX)
 *
 * The two callback wirings (font upload modal, token insert into editor)
 * remain deferred to Phase 7: they require a portaled modal container
 * and a live TipTap editor handle respectively, both of which arrive
 * with the canvas-side text editor integration in the next phase.
 */

import React, { useCallback, useState } from 'react';
import { TextPropertiesPanel } from './TextPropertiesPanel';
import type { AnnotationScale } from '../../text-engine/types';
import { useTextPanelLayers } from './hooks/useTextPanelLayers';
import { useTextPanelFonts } from './hooks/useTextPanelFonts';
import { useTextPanelDocumentVersion } from './hooks/useTextPanelDocumentVersion';

export function TextPropertiesPanelHost() {
  const layers = useTextPanelLayers();
  const availableFonts = useTextPanelFonts();
  const documentVersion = useTextPanelDocumentVersion();
  const [scales, setScales] = useState<readonly AnnotationScale[]>([]);

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
      onAnnotationScalesChange={setScales}
    />
  );
}
