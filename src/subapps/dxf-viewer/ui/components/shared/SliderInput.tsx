/**
 * 🏢 ENTERPRISE SLIDER INPUT COMPONENT
 * Reusable Slider Input Component με centralized styling
 * Eliminates duplicate slider patterns across UI components
 *
 * ✅ ENTERPRISE FEATURES:
 * - Centralized colors με PANEL_COLORS
 * - Quick styling patterns
 * - Type-safe semantic colors support
 */

import React from 'react';
import { PANEL_COLORS } from '../../config/panel-tokens';
import { quick } from '../../styles/quick-styles';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  tooltip?: string;
  className?: string;
}

export function SliderInput({
  label,
  value,
  min,
  max,
  onChange,
  tooltip,
  className = ''
}: SliderInputProps) {
  const colors = useSemanticColors();
  return (
    <div className={className}>
      <label
        className={`block text-xs ${colors.text.muted} mb-1`}
        title={tooltip}
      >
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer slider ${quick.input} ${colors.bg.secondary}`}
      />
    </div>
  );
}