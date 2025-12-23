'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scale } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { normalizeNumericInput, validateNumericInput } from './shared/input-validation';

interface ScaleControlsProps {
  currentZoom: number; // Το τρέχον zoom level (π.χ. 0.01 για 1:100)
  onSetScale: (scale: number) => void; // Callback για αλλαγή κλίμακας
}

export const ScaleControls: React.FC<ScaleControlsProps> = ({
  currentZoom,
  onSetScale
}) => {
  const iconSizes = useIconSizes();
  const [inputValue, setInputValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const zoomToScale = useCallback((zoom: number): number => {
    if (zoom <= 0) return 100;
    return Math.round(1 / zoom);
  }, []);

  const formatScaleDisplay = useCallback((zoom: number): string => {
    const scale = zoomToScale(zoom);
    return scale.toString();
  }, [zoomToScale]);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(formatScaleDisplay(currentZoom));
    }
  }, [currentZoom, isEditing, formatScaleDisplay]);

  const scaleValidationOptions = { minValue: 1, maxValue: 10000, defaultValue: 100 };
  
  const normalizeInput = useCallback((value: string): number => {
    return normalizeNumericInput(value, scaleValidationOptions);
  }, []);

  const validateInput = useCallback((value: string): boolean => {
    return validateNumericInput(value, scaleValidationOptions);
  }, []);

  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    setTimeout(() => {
      e.target.select();
    }, 0);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
  }, []);

  const applyScale = useCallback((explicitValue?: string) => {
    const valueToUse = explicitValue !== undefined ? explicitValue : inputValue;
    
    setIsEditing(false);
    
    if (!validateInput(valueToUse)) {
      const currentDisplay = formatScaleDisplay(currentZoom);
      setInputValue(currentDisplay);
      return;
    }
    
    const newScale = normalizeInput(valueToUse);
    const currentScale = zoomToScale(currentZoom);
    
    if (Math.abs(newScale - currentScale) > 0.1) {
      onSetScale(newScale);
    }
    
    setInputValue(newScale.toString());
  }, [inputValue, currentZoom, validateInput, normalizeInput, formatScaleDisplay, zoomToScale, onSetScale]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const currentValue = (e.target as HTMLInputElement).value;
      applyScale(currentValue);
    }
  }, [applyScale]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const currentValue = e.target.value;
    applyScale(currentValue);
  }, [applyScale]);

  return (
    <div className="flex items-center gap-1 bg-gray-900 rounded px-2 py-1">
      <Scale className={`${iconSizes.xs} text-gray-400`} />
      <span className="text-xs text-gray-400">1:</span>
      
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        className="w-16 px-1 py-0 bg-gray-800 border border-gray-600 rounded text-white text-xs text-center focus:border-blue-500 focus:outline-none transition-colors select-all"
        title="Drawing scale (1:100 means 1 unit = 100 real units) - Press Enter or click away to apply"
        placeholder="100"
      />
    </div>
  );
};
