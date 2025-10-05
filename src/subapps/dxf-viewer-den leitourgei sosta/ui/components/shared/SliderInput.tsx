/**
 * Reusable Slider Input Component
 * Eliminates duplicate slider patterns across UI components
 */

import React from 'react';

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
  return (
    <div className={className}>
      <label 
        className="block text-xs text-gray-300 mb-1"
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
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
      />
    </div>
  );
}