/**
 * Appearance settings for ONE marquee selection mode.
 *
 * `window` and `crossing` are the same six controls over the same box shape —
 * previously the whole panel was written out twice, once per mode, differing
 * only in which `settings.selection.*` branch it read and which i18n prefix it
 * used. The i18n keys are symmetric (`selectionSettings.<mode>.*`), so the mode
 * is a parameter, not a copy.
 *
 * @module ui/components/dxf-settings/settings/special/selection/SelectionModeSettings
 */

import React from 'react';

import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { PANEL_LAYOUT } from '../../../../../../config/panel-tokens';
import { formatPercent } from '../../../../../../rendering/entities/shared/distance-label-utils';
import { useCursorSettings } from '../../../../../../systems/cursor';
import type {
  SelectionBoxSettings,
  SelectionMode,
} from '../../../../../../systems/cursor/config';
import { SELECTION_MODE_PRESENTATION } from './selection-modes';
import {
  BorderStyleRow,
  ColorSettingRow,
  SliderSettingRow,
} from './selection-setting-rows';

const I18N_NAMESPACES = [
  'dxf-viewer',
  'dxf-viewer-settings',
  'dxf-viewer-wizard',
  'dxf-viewer-guides',
  'dxf-viewer-panels',
  'dxf-viewer-shell',
] as const;

const formatPx = (v: number) => `${v}px`;

export function SelectionModeSettings({ mode }: { mode: SelectionMode }) {
  const { settings, updateSettings } = useCursorSettings();
  const colors = useSemanticColors();
  const { t } = useTranslation([...I18N_NAMESPACES]);

  const box = settings.selection[mode];
  const { icon: ModeIcon, tone } = SELECTION_MODE_PRESENTATION[mode];

  /**
   * Patch the active mode's box. The explicit branch keeps the write fully
   * typed — a computed `[mode]` key would widen the object and lose it.
   */
  const update = (patch: Partial<SelectionBoxSettings>) => {
    const next: SelectionBoxSettings = { ...box, ...patch };
    updateSettings({
      selection:
        mode === 'window'
          ? { ...settings.selection, window: next }
          : { ...settings.selection, crossing: next },
    });
  };

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
      <h4
        className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} flex items-center ${PANEL_LAYOUT.GAP.SM}`}
      >
        <ModeIcon className={`${PANEL_LAYOUT.ICON.REGULAR} ${colors.text[tone]}`} />
        <span>{t(`selectionSettings.${mode}.title`)}</span>
      </h4>
      <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
        {t(`selectionSettings.${mode}.description`)}
      </div>

      <ColorSettingRow
        label={t(`selectionSettings.${mode}.fillColorLabel`)}
        dialogTitle={t(`selectionSettings.${mode}.fillColor`)}
        value={box.fillColor}
        onChange={(fillColor) => update({ fillColor })}
      />

      <SliderSettingRow
        title={t('selectionSettings.common.fillOpacity')}
        description={t('selectionSettings.common.fillOpacityDesc')}
        value={box.fillOpacity}
        min={0}
        max={1}
        step={0.1}
        onChange={(fillOpacity) => update({ fillOpacity })}
        formatValue={formatPercent}
      />

      <ColorSettingRow
        label={t(`selectionSettings.${mode}.borderColorLabel`)}
        dialogTitle={t(`selectionSettings.${mode}.borderColor`)}
        value={box.borderColor}
        onChange={(borderColor) => update({ borderColor })}
      />

      <SliderSettingRow
        title={t('selectionSettings.common.borderOpacity')}
        description={t('selectionSettings.common.borderOpacityDesc')}
        value={box.borderOpacity}
        min={0}
        max={1}
        step={0.1}
        onChange={(borderOpacity) => update({ borderOpacity })}
        formatValue={formatPercent}
      />

      <SliderSettingRow
        title={t('selectionSettings.common.borderWidth')}
        description={t('selectionSettings.common.borderWidthDesc')}
        value={box.borderWidth}
        min={0.25}
        max={5}
        step={0.25}
        onChange={(borderWidth) => update({ borderWidth })}
        formatValue={formatPx}
      />

      <BorderStyleRow
        title={t('selectionSettings.common.borderStyle')}
        description={t('selectionSettings.common.borderStyleDesc')}
        value={box.borderStyle}
        previewColor={box.borderColor}
        onChange={(borderStyle) => update({ borderStyle })}
        styleLabels={{
          solid: t('selectionSettings.borderStyles.solid'),
          dashed: t('selectionSettings.borderStyles.dashed'),
          dotted: t('selectionSettings.borderStyles.dotted'),
          'dash-dot': t('selectionSettings.borderStyles.dashDot'),
        }}
      />
    </div>
  );
}
