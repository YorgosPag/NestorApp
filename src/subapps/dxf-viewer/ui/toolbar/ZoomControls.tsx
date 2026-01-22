// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Minus } from "lucide-react";
import { normalizeNumericInput, validateNumericInput } from './shared/input-validation';
import { ZOOM_FACTORS } from '../../config/transform-config';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: Shadcn Tooltip (replaces native title attribute)
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

interface ZoomControlsProps {
  currentZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom: (zoom: number) => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  currentZoom,
  onZoomIn,
  onZoomOut,
  onSetZoom
}) => {
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const { getFocusBorder, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [inputValue, setInputValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση industry-standard zoom factor (20% για UI buttons)
  const ZOOM_STEP_FACTOR = ZOOM_FACTORS.BUTTON_IN; // 1.2 = 20% increase
  const ZOOM_STEP_PERCENTAGE = Math.round((ZOOM_STEP_FACTOR - 1) * 100); // 20%

  // Update input value when currentZoom changes (only if not editing)
  useEffect(() => {
    if (!isEditing) {
      const percentage = Math.round(currentZoom * 100);
      setInputValue(percentage.toString());
    }
  }, [currentZoom, isEditing]);

  const zoomValidationOptions = { minValue: 1, maxValue: 99999, defaultValue: 100 };

  // 🔺 NORMALIZE INPUT - Δέχεται τελεία και κόμμα
  const normalizeInput = useCallback((value: string): number => {
    return normalizeNumericInput(value, zoomValidationOptions);
  }, []);

  // 🔺 VALIDATE INPUT - Έλεγχος εγκυρότητας
  const validateInput = useCallback((value: string): boolean => {
    const isValid = validateNumericInput(value, zoomValidationOptions);

    return isValid;
  }, []);

  // ✅ ZOOM IN με industry-standard 20% αύξηση
  const handleZoomInClick = useCallback(() => {
    const current = normalizeInput(inputValue || (currentZoom * 100).toString());
    const newValue = Math.min(Math.round(current * ZOOM_STEP_FACTOR), 99999);

    setInputValue(newValue.toString());
    onZoomIn();

  }, [inputValue, currentZoom, normalizeInput, onZoomIn, ZOOM_STEP_FACTOR]);

  // ✅ ZOOM OUT με industry-standard 20% μείωση
  const handleZoomOutClick = useCallback(() => {
    const current = normalizeInput(inputValue || (currentZoom * 100).toString());
    const newValue = Math.max(Math.round(current / ZOOM_STEP_FACTOR), 1);

    setInputValue(newValue.toString());
    onZoomOut();

  }, [inputValue, currentZoom, normalizeInput, onZoomOut, ZOOM_STEP_FACTOR]);

  // 🔺 INPUT FOCUS - Επιλογή όλων των ψηφίων
  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    setTimeout(() => {
      e.target.select();
    }, 0);

  }, []);

  // 🔺 INPUT CHANGE - Ενημέρωση κατά την πληκτρολόγηση
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

  }, []);

  // 🔺 APPLY ZOOM - Κοινή λογική εφαρμογής
  const applyZoom = useCallback((explicitValue?: string) => {
    const valueToUse = explicitValue !== undefined ? explicitValue : inputValue;
    
    setIsEditing(false);

    if (!validateInput(valueToUse)) {
      const currentPercentage = Math.round(currentZoom * 100);
      setInputValue(currentPercentage.toString());
      console.warn(`⚠️ ${t('zoomControls.invalidInput', { value: valueToUse, percentage: currentPercentage })}`);
      return;
    }
    
    const newZoom = normalizeInput(valueToUse);
    const newZoomDecimal = newZoom / 100;

    // Εφαρμογή μόνο αν διαφέρει από την τρέχουσα τιμή
    if (Math.abs(newZoomDecimal - currentZoom) > 0.001) {

      onSetZoom(newZoomDecimal);
    } else {

    }
    
    setInputValue(newZoom.toString());
  }, [inputValue, currentZoom, validateInput, normalizeInput, onSetZoom]);

  // 🔺 ENTER KEY - Εφαρμογή του zoom
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const currentValue = (e.target as HTMLInputElement).value;

      applyZoom(currentValue);
    }
  }, [applyZoom]);

  // 🔺 INPUT BLUR - Εφαρμογή κατά την απώλεια focus
  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const currentValue = e.target.value;

    applyZoom(currentValue);
  }, [applyZoom]);

  return (
    <TooltipProvider>
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS} ${colors.bg.backgroundSecondary} rounded ${PANEL_LAYOUT.SPACING.COMPACT}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleZoomOutClick}
              className={`${PANEL_LAYOUT.BUTTON.HEIGHT_SM} ${PANEL_LAYOUT.WIDTH.BUTTON_SM} ${PANEL_LAYOUT.SPACING.NONE} ${colors.text.tertiary} ${HOVER_TEXT_EFFECTS.WHITE} flex items-center justify-center rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
            >
              <Minus className={iconSizes.xs} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('zoomControls.zoomOut', { percentage: ZOOM_STEP_PERCENTAGE })}</TooltipContent>
        </Tooltip>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_X} ${PANEL_LAYOUT.PADDING.VERTICAL_NONE} ${colors.bg.secondary} ${getStatusBorder('muted')} rounded ${colors.text.inverted} ${PANEL_LAYOUT.TYPOGRAPHY.XS} text-center ${getFocusBorder('input')} focus:outline-none ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.SELECT.ALL}`}
          title={t('zoomControls.inputTitle')}
          placeholder="100"
        />

        <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>%</span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleZoomInClick}
              className={`${PANEL_LAYOUT.BUTTON.HEIGHT_SM} ${PANEL_LAYOUT.WIDTH.BUTTON_SM} ${PANEL_LAYOUT.SPACING.NONE} ${colors.text.tertiary} ${HOVER_TEXT_EFFECTS.WHITE} flex items-center justify-center rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
            >
              <Plus className={iconSizes.xs} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('zoomControls.zoomIn', { percentage: ZOOM_STEP_PERCENTAGE })}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
