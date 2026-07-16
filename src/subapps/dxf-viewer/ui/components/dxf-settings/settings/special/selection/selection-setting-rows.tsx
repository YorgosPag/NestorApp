/**
 * The three row shapes the selection panel is built from.
 *
 * Each was previously written out per field AND per mode — a colour row twice
 * per mode, a slider row three times per mode, the style picker once per mode.
 * They are dumb presentational components: callers pass already-translated
 * strings, so nothing here knows about i18n namespaces.
 *
 * @module ui/components/dxf-settings/settings/special/selection/selection-setting-rows
 */

import React from 'react';

import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { PANEL_LAYOUT } from '../../../../../../config/panel-tokens';
import { ColorDialogTrigger } from '../../../../../color/EnterpriseColorDialog';
import { SliderInput } from '../../../../shared/SliderInput';
import {
  getSelectionLinePreview,
  SELECTION_BORDER_STYLES,
  type SelectionBorderStyle,
} from './selection-line-preview';

// ============================================================================
// CARD
// ============================================================================

/** The rounded surface every setting row sits on. */
function SettingCard({ children }: { children: React.ReactNode }) {
  const colors = useSemanticColors();
  return (
    <div
      className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}
    >
      {children}
    </div>
  );
}

/** Title + secondary description, as used by the slider and picker rows. */
function RowHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const colors = useSemanticColors();
  return (
    <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
      <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{title}</div>
      <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>
        {description}
      </div>
    </div>
  );
}

// ============================================================================
// ROWS
// ============================================================================

interface ColorSettingRowProps {
  /** Already-translated field label. */
  label: string;
  /** Already-translated colour dialog title. */
  dialogTitle: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorSettingRow({
  label,
  dialogTitle,
  value,
  onChange,
}: ColorSettingRowProps) {
  const colors = useSemanticColors();
  return (
    <SettingCard>
      <label
        className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}
      >
        {label}
      </label>
      <ColorDialogTrigger
        value={value}
        onChange={onChange}
        label={value}
        title={dialogTitle}
        alpha={false}
        modes={['hex', 'rgb', 'hsl']}
        palettes={['dxf', 'semantic', 'material']}
        recent
        eyedropper
      />
    </SettingCard>
  );
}

interface SliderSettingRowProps {
  title: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
}

export function SliderSettingRow({
  title,
  description,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
}: SliderSettingRowProps) {
  return (
    <SettingCard>
      <RowHeading title={title} description={description} />
      <SliderInput
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        showValue
        formatValue={formatValue}
      />
    </SettingCard>
  );
}

interface BorderStyleRowProps {
  title: string;
  description: string;
  /** Translated label per style — same order-independent lookup as before. */
  styleLabels: Record<SelectionBorderStyle, string>;
  value: SelectionBorderStyle;
  /** Colour the preview swatches are drawn in. */
  previewColor: string;
  onChange: (style: SelectionBorderStyle) => void;
}

export function BorderStyleRow({
  title,
  description,
  styleLabels,
  value,
  previewColor,
  onChange,
}: BorderStyleRowProps) {
  const colors = useSemanticColors();
  const { getStatusBorder, getElementBorder } = useBorderTokens();

  return (
    <SettingCard>
      <RowHeading title={title} description={description} />
      <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.SM}`}>
        {SELECTION_BORDER_STYLES.map((style) => {
          const isSelected = value === style;
          return (
            <button
              key={style}
              onClick={() => onChange(style)}
              className={`${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                isSelected
                  ? `${colors.bg.primary} ${getStatusBorder('info')}`
                  : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getElementBorder('button', 'default')}`
              }`}
            >
              {/* Dynamic gradient — the one style that cannot be a token. */}
              <div
                className={`${PANEL_LAYOUT.WIDTH.FULL} ${PANEL_LAYOUT.MARGIN.BOTTOM_XS} ${PANEL_LAYOUT.HEIGHT.DIVIDER}`}
                style={{ background: getSelectionLinePreview(style, previewColor) }}
              />
              <span className={`block ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>
                {styleLabels[style]}
              </span>
            </button>
          );
        })}
      </div>
    </SettingCard>
  );
}
