'use client';
import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

interface DynamicInputFieldProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
  isActive?: boolean;
  isAnchored?: boolean;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  fieldType?: 'coordinate' | 'angle' | 'length';
}

export function DynamicInputField({
  label,
  value,
  onChange,
  onFocus,
  inputRef,
  disabled = false,
  isActive = false,
  isAnchored = false,
  placeholder,
  onKeyDown,
  fieldType = 'coordinate'
}: DynamicInputFieldProps) {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (fieldType === 'angle') {
      // Angle-specific validation: 0-360° and comma to period normalization
      let value = inputValue.replace(',', '.');
      // Basic validation: only numbers, period and empty
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        const num = parseFloat(value);
        if (value === '' || (num >= 0 && num <= 360)) {
          const newEvent = { ...e, target: { ...e.target, value } };
          onChange(newEvent);
          return;
        }
      }
      return; // Don't call onChange if validation fails
    } else if (fieldType === 'length') {
      // Length-specific validation: no negative values
      if (!inputValue.startsWith('-')) {
        onChange(e);
      }
    } else {
      // Default coordinate behavior: normalize comma to period
      const normalizedValue = inputValue.replace(',', '.');
      const newEvent = { ...e, target: { ...e.target, value: normalizedValue } };
      onChange(newEvent);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (fieldType === 'length') {
      // Block minus key for length field
      if (e.key === '-' || e.key === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();

        return;
      }
    }
    
    // Call custom onKeyDown if provided
    onKeyDown?.(e);
  };
  return (
    <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
      <label
        className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.WIDTH.SM} ${
          isActive ? `${colors.text.info} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD}` : colors.text.secondary
        }`}
      >
        {label}:
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        disabled={disabled}
        placeholder={placeholder}
        className={`flex-1 ${colors.text.WHITE} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.SM} rounded border ${quick.focus} focus:outline-none
          ${isAnchored ? `${colors.bg.warning} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.warning}` : `${colors.bg.hover} ${quick.none}`}
          ${disabled ? `${colors.bg.accent} ${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.CURSOR.NOT_ALLOWED} ${quick.muted}` : ''}
          ${isActive ? quick.focus : ''}`}
      />
    </div>
  );
}