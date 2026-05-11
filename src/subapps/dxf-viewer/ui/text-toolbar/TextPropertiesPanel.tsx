'use client';

/**
 * ADR-344 Phase 5.F — Text Properties tab content.
 *
 * Subset of the toolbar shown when a text entity is selected but NOT in
 * active edit mode. Mirrors AutoCAD's Properties palette. Uses the same
 * panel components as the floating ribbon (`TextToolbar`), so behavior is
 * identical — only the chrome differs.
 *
 * The host (`usePanelContentRenderer`) decides when to mount this — when
 * `selectedEntityIds` contains at least one text entity and
 * `useTextEditingStore.activeEntityId` is null.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StylePanel,
  FormattingPanel,
  ParagraphPanel,
  InsertPanel,
} from './panels';
import {
  LayerSelectorDropdown,
  AnnotationScaleManager,
  type LayerSelectorEntry,
} from './controls';
import { useCanEditText } from '../../hooks/useCanEditText';
import { useTextToolbarStore } from '../../state/text-toolbar';
import { DxfDocumentVersion } from '../../text-engine/types';
import type { AnnotationScale } from '../../text-engine/types';

interface TextPropertiesPanelProps {
  readonly layers: readonly LayerSelectorEntry[];
  readonly availableFonts: readonly string[];
  readonly documentVersion: DxfDocumentVersion;
  readonly annotationScales: readonly AnnotationScale[];
  readonly paperHeightDefault: number;
  readonly onRequestFontUpload: () => void;
  readonly onInsertToken: (token: string) => void;
  readonly onAnnotationScalesChange: (next: readonly AnnotationScale[]) => void;
}

export function TextPropertiesPanel({
  layers,
  availableFonts,
  documentVersion,
  annotationScales,
  paperHeightDefault,
  onRequestFontUpload,
  onInsertToken,
  onAnnotationScalesChange,
}: TextPropertiesPanelProps) {
  const { t } = useTranslation(['textToolbar']);
  const caps = useCanEditText();
  const layerId = useTextToolbarStore((s) => s.layerId);
  const currentScale = useTextToolbarStore((s) => s.currentScale);
  const setValue = useTextToolbarStore((s) => s.setValue);
  const disabled = !caps.canEdit;

  return (
    <section
      aria-label={t('textToolbar:properties.label')}
      className="flex flex-col gap-3 p-2"
    >
      <header>
        <h3 className="text-sm font-medium">{t('textToolbar:properties.title')}</h3>
      </header>

      <StylePanel disabled={disabled} />
      <FormattingPanel
        availableFonts={availableFonts}
        documentVersion={documentVersion}
        onRequestFontUpload={onRequestFontUpload}
        canUploadFont={caps.canEdit}
        disabled={disabled}
      />
      <ParagraphPanel disabled={disabled} />

      <LayerSelectorDropdown
        value={layerId}
        layers={layers}
        canUnlockLayer={caps.canUnlockLayer}
        onChange={(id) => setValue('layerId', id)}
        disabled={disabled}
      />

      <AnnotationScaleManager
        scales={annotationScales}
        currentScale={currentScale}
        paperHeightDefault={paperHeightDefault}
        onScalesChange={onAnnotationScalesChange}
        onCurrentScaleChange={(name) => setValue('currentScale', name)}
        disabled={disabled}
      />

      <InsertPanel onInsert={onInsertToken} disabled={disabled} />
    </section>
  );
}
