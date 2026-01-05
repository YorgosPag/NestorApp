/**
 * LINE WIDTH CONTROL Component
 * Standalone control για line width με debouncing
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Slider } from '../../../../../../components/ui/slider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

interface LineWidthControlProps {
  value: number;
  onChange: (value: number) => void;
  onChangeInstant?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  showValue?: boolean;
}

export const LineWidthControl: React.FC<LineWidthControlProps> = ({
  value,
  onChange,
  onChangeInstant,
  min = 0.25,
  max = 2.0,
  step = 0.05,
  label = 'Line Width',
  disabled = false,
  showValue = true,
}) => {
  const colors = useSemanticColors();
  const [localValue, setLocalValue] = useState(value);

  // Sync local value όταν αλλάζει το external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSliderChange = useCallback((values: number[]) => {
    const newValue = values[0];
    setLocalValue(newValue);

    // Instant feedback για UI
    if (onChangeInstant) {
      onChangeInstant(newValue);
    }

    // Debounced update για store (handled by the hook)
    onChange(newValue);
  }, [onChange, onChangeInstant]);

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
      <div className="flex items-center justify-between">
        <label className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
          {label}
        </label>
        {showValue && (
          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-mono`}>
            {localValue.toFixed(2)}mm
          </span>
        )}
      </div>

      <Slider
        value={[localValue]}
        onValueChange={handleSliderChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full"
      />

      {/* 🏢 ENTERPRISE: Visual preview bar - Using semantic colors */}
      <div className={`h-2 ${colors.bg.secondary} rounded ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}>
        <div
          className={`h-full ${colors.bg.info} transition-all duration-150 ${disabled ? 'opacity-50' : 'opacity-100'}`}
          style={{
            width: `${((localValue - min) / (max - min)) * 100}%`
          }}
        />
      </div>
    </div>
  );
};