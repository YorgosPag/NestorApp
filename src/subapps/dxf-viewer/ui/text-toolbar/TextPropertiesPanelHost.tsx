'use client';

/**
 * ADR-344 Phase 5.F — Host wrapper for Text Properties tab.
 *
 * Bridges the FloatingPanelContainer to the pure `TextPropertiesPanel`
 * component. Sources its data (layer list, font list, document version,
 * annotation scales) from stores / scene model.
 *
 * Phase 5: stub-default data sources (empty layers, empty fonts, R2018).
 * Phase 6 wires real LayerStore + FontCache + scene version.
 */

import React, { useCallback, useState } from 'react';
import { TextPropertiesPanel } from './TextPropertiesPanel';
import { DxfDocumentVersion } from '../../text-engine/types';
import type { AnnotationScale } from '../../text-engine/types';
import type { LayerSelectorEntry } from './controls';

const STUB_LAYERS: readonly LayerSelectorEntry[] = [
  { id: '0', name: '0', locked: false, frozen: false },
];

const STUB_FONTS: readonly string[] = ['Arial', 'Times New Roman', 'Liberation Sans'];

export function TextPropertiesPanelHost() {
  const [scales, setScales] = useState<readonly AnnotationScale[]>([]);

  const onRequestFontUpload = useCallback(() => {
    // Phase 6 — open FontManagerPanel (Phase 2 SSoT)
  }, []);

  const onInsertToken = useCallback((_token: string) => {
    // Phase 6 — dispatch into active TipTap editor session
  }, []);

  return (
    <TextPropertiesPanel
      layers={STUB_LAYERS}
      availableFonts={STUB_FONTS}
      documentVersion={DxfDocumentVersion.R2018}
      annotationScales={scales}
      paperHeightDefault={2.5}
      onRequestFontUpload={onRequestFontUpload}
      onInsertToken={onInsertToken}
      onAnnotationScalesChange={setScales}
    />
  );
}
