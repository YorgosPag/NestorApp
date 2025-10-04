'use client';
import React from 'react';

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
        console.log('Length field: Minus key blocked (length cannot be negative)');
        return;
      }
    }
    
    // Call custom onKeyDown if provided
    onKeyDown?.(e);
  };
  return (
    <div className="flex items-center gap-2">
      <label
        className={`text-xs w-8 ${
          isActive ? 'text-cyan-400 font-semibold' : 'text-gray-300'
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
        className={`flex-1 text-white px-2 py-1 text-sm rounded border focus:border-cyan-400 focus:outline-none
          ${isAnchored ? 'bg-yellow-600 font-bold border-yellow-400' : 'bg-gray-700 border-transparent'}
          ${disabled ? 'bg-gray-600 opacity-50 cursor-not-allowed border-gray-500' : ''}
          ${isActive ? 'border-cyan-400' : ''}`}
      />
    </div>
  );
}