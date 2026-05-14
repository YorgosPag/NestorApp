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
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { useTextPanelFonts } from '../../text-toolbar/hooks/useTextPanelFonts';
import { FontFamilyCombobox } from '../../text-toolbar/controls/FontFamilyCombobox';

export function RibbonFontFamilyWidget() {
  const fontFamily = useTextToolbarStore((s) => s.fontFamily);
  const setValue = useTextToolbarStore((s) => s.setValue);
  const fonts = useTextPanelFonts();

  const handleChange = useCallback(
    (next: string) => setValue('fontFamily', next),
    [setValue],
  );

  return (
    <FontFamilyCombobox
      value={fontFamily}
      availableFonts={fonts}
      onChange={handleChange}
      onRequestUpload={() => {}}
      canUpload={true}
    />
  );
}
