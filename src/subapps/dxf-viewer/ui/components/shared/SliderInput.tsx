/**
 * =============================================================================
 * SLIDER INPUT — SSoT per tutti gli slider del DXF Viewer (ADR-342-ext)
 * =============================================================================
 *
 * Unico componente per range slider usato in Settings, Palettes, Panels.
 * Rimpiazza 8+ occorrenze di <input type="range"> sparse nel codebase.
 *
 * Varianti:
 *   - Solo slider (default)
 *   - Slider + numero affiancato (showNumberInput)
 *   - Valore mostrato accanto alla label (showValue + formatValue)
 */

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

// =============================================================================
// PROPS
// =============================================================================

interface SliderInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Default 1. Use fractional step for float values (e.g. 0.1) */
  step?: number;
  /** Label shown above the slider */
  label?: string;
  /** Show formatted value to the right of the label */
  showValue?: boolean;
  /** Custom value formatter. Default: String(value) */
  formatValue?: (v: number) => string;
  /** Show paired <input type="number"> to the right of the slider */
  showNumberInput?: boolean;
  disabled?: boolean;
  tooltip?: string;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SliderInput({
  value,
  min,
  max,
  onChange,
  step = 1,
  label,
  showValue = false,
  formatValue,
  showNumberInput = false,
  disabled = false,
  tooltip,
  className = '',
}: SliderInputProps) {
  const colors = useSemanticColors();
  const { quick, radius } = useBorderTokens();

  const displayValue = formatValue ? formatValue(value) : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange(parseFloat(e.target.value));

  const rangeClassName = `flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${disabled ? `${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}` : PANEL_LAYOUT.CURSOR.POINTER}`;

  const numberClassName = `${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`;

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${className}`} title={tooltip}>
      {(label || showValue) && (
        <div className={`flex justify-between items-center`}>
          {label && (
            <label
              className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}
            >
              {label}
            </label>
          )}
          {showValue && (
            <span
              className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}
            >
              {displayValue}
            </span>
          )}
        </div>
      )}

      <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD}`}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={rangeClassName}
        />
        {showNumberInput && (
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className={numberClassName}
          />
        )}
      </div>
    </div>
  );
}
