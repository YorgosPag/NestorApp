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
import { useBorderTokens } from '../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

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
  const { quick } = useBorderTokens();
  return (
    <div className={className}>
      <label
        className={`block ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_XS}`}
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
        className={`w-full ${PANEL_LAYOUT.HEIGHT.SM} rounded-lg appearance-none cursor-pointer slider ${quick.input} ${colors.bg.secondary}`}
      />
    </div>
  );
}