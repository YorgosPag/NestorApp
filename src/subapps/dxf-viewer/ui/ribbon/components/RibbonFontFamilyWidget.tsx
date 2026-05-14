'use client';

/**
 * ADR-345 Fase 6 — Font family widget for the Text Editor contextual tab.
 *
 * Leaf component: reads/writes `fontFamily` directly from
 * `useTextToolbarStore` (ADR-040 compliant micro-leaf). Reuses the
 * existing `FontFamilyCombobox` control with search + upload (SSoT).
 *
 * onRequestUpload is a no-op until Phase 7 wires the font manager portal.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { useTextPanelFonts } from '../../text-toolbar/hooks/useTextPanelFonts';
import { FontFamilyCombobox } from '../../text-toolbar/controls/FontFamilyCombobox';

export function RibbonFontFamilyWidget() {
  const { t } = useTranslation('dxf-viewer-shell');
  const rawFontFamily = useTextToolbarStore((s) => s.fontFamily);
  // Empty string = entity has no explicit fontFamily (inherits DXF style). Treat as null
  // so FontFamilyCombobox shows a placeholder instead of a blank trigger button.
  const fontFamily = rawFontFamily === '' ? null : rawFontFamily;
  const setValue = useTextToolbarStore((s) => s.setValue);
  const fonts = useTextPanelFonts();

  const handleChange = useCallback(
    (next: string) => setValue('fontFamily', next),
    [setValue],
  );

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.textEditor.font.family')}
      </span>
      <span className="dxf-ribbon-widget-compact">
        <FontFamilyCombobox
          value={fontFamily}
          availableFonts={fonts}
          onChange={handleChange}
          onRequestUpload={() => {}}
          canUpload={true}
        />
      </span>
    </span>
  );
}
