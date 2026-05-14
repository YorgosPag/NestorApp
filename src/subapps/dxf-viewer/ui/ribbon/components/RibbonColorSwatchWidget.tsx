'use client';

/**
 * ADR-345 Fase 6 — Color swatch widget for the Text Editor contextual tab.
 *
 * Leaf component: reads directly from `useTextToolbarStore` (ADR-040
 * compliant — widget is its own micro-leaf, not an orchestrator).
 * Reuses the existing `ColorPickerPopover` (ADR-344 Phase 5.C, SSoT).
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { useTextPanelDocumentVersion } from '../../text-toolbar/hooks/useTextPanelDocumentVersion';
import { ColorPickerPopover } from '../../text-toolbar/controls/ColorPickerPopover';
import { versionSupportsTrueColor } from '../../../text-engine/types';
import type { DxfColor } from '../../../text-engine/types';

export function RibbonColorSwatchWidget() {
  const { t } = useTranslation('dxf-viewer-shell');
  const color = useTextToolbarStore((s) => s.color);
  const setValue = useTextToolbarStore((s) => s.setValue);
  const documentVersion = useTextPanelDocumentVersion();
  const trueColor = versionSupportsTrueColor(documentVersion);

  const handleChange = useCallback(
    (next: DxfColor) => setValue('color', next),
    [setValue],
  );

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.textEditor.font.color')}
      </span>
      <span className="dxf-ribbon-widget-compact">
        <ColorPickerPopover
          value={color}
          onChange={handleChange}
          trueColorSupported={trueColor}
        />
      </span>
    </span>
  );
}
