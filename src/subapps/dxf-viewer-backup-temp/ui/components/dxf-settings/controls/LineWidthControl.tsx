/**
 * LINE WIDTH CONTROL Component
 * Standalone control για line width με debouncing
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Slider } from '../../../../../../components/ui/slider';

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">
          {label}
        </label>
        {showValue && (
          <span className="text-xs text-gray-400 font-mono">
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

      {/* Visual preview bar */}
      <div className="h-2 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-150"
          style={{
            width: `${((localValue - min) / (max - min)) * 100}%`,
            opacity: disabled ? 0.5 : 1
          }}
        />
      </div>
    </div>
  );
};