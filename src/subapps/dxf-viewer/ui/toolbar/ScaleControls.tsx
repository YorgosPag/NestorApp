'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scale } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { normalizeNumericInput, validateNumericInput } from './shared/input-validation';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';

interface ScaleControlsProps {
  currentZoom: number; // Το τρέχον zoom level (π.χ. 0.01 για 1:100)
  onSetScale: (scale: number) => void; // Callback για αλλαγή κλίμακας
}

export const ScaleControls: React.FC<ScaleControlsProps> = ({
  currentZoom,
  onSetScale
}) => {
  const iconSizes = useIconSizes();
  const { getFocusBorder, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
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
    <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS} ${colors.bg.primary} rounded ${PANEL_LAYOUT.SPACING.COMPACT}`}>
      <Scale className={`${iconSizes.xs} ${colors.text.muted}`} />
      <span className={`text-xs ${colors.text.muted}`}>1:</span>
      
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_X} ${PANEL_LAYOUT.PADDING.VERTICAL_NONE} ${colors.bg.tertiary} ${getStatusBorder('muted')} rounded ${colors.text.inverted} text-xs text-center ${getFocusBorder('input')} focus:outline-none transition-colors select-all`}
        title="Drawing scale (1:100 means 1 unit = 100 real units) - Press Enter or click away to apply"
        placeholder="100"
      />
    </div>
  );
};
