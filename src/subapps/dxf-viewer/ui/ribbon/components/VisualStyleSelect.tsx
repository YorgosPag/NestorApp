'use client';

/**
 * ADR-446 — «Στυλ Προβολής» ribbon dropdown (View tab, Revit «Visual Style»).
 *
 * A single Radix `@/components/ui/select` (ADR-001 — NOT EnterpriseComboBox /
 * native `<select>`) that picks the per-view {@link VisualStylePreset}. Thin
 * reader/writer of the `visualStyle` field on `useBimRenderSettingsStore` (the
 * SSoT, Firestore-persisted) — same thin reader/writer shape as the BIM style
 * dropdowns (`BimStyleSelects`). The 3D faces + edges pipelines read the resolved axes
 * event-time; `useBim3DVgResync` rebuilds the scene when the preset flips.
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import {
  VISUAL_STYLE_PRESETS,
  type VisualStylePreset,
} from '../../../config/bim-visual-style';

export const VisualStyleSelect: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const visualStyle = useBimRenderSettingsStore((s) => s.visualStyle);
  const setVisualStyle = useBimRenderSettingsStore((s) => s.setVisualStyle);

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{t('ribbon.commands.visualStyle.label')}</span>
      <Select value={visualStyle} onValueChange={(v) => setVisualStyle(v as VisualStylePreset)}>
        <SelectTrigger size="sm" aria-label={t('ribbon.commands.visualStyle.label')}>
          <SelectValue />
        </SelectTrigger>
        {/* w-auto overrides the popper's trigger-width lock so long Greek preset
            labels (e.g. «Σκιασμένο με Ακμές») are never clipped. */}
        <SelectContent className="w-auto min-w-[13rem]">
          {VISUAL_STYLE_PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset} className="whitespace-nowrap">
              {t(`ribbon.commands.visualStyle.presets.${preset}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
};
