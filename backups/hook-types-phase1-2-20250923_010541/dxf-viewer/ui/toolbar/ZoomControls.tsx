'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Minus } from "lucide-react";
import { normalizeNumericInput, validateNumericInput } from './shared/input-validation';

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
  const [inputValue, setInputValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🎯 ZOOM STEP CONSTANT - 10 μονάδες όπως ζητήθηκε
  const ZOOM_STEP = 10;

  // Update input value when currentZoom changes (only if not editing)
  useEffect(() => {
    if (!isEditing) {
      const percentage = Math.round(currentZoom * 100);
      setInputValue(percentage.toString());
    }
  }, [currentZoom, isEditing]);

  const zoomValidationOptions = { minValue: 1, maxValue: 99999, defaultValue: 100 };

  // 🎯 NORMALIZE INPUT - Δέχεται τελεία και κόμμα
  const normalizeInput = useCallback((value: string): number => {
    return normalizeNumericInput(value, zoomValidationOptions);
  }, []);

  // 🎯 VALIDATE INPUT - Έλεγχος εγκυρότητας
  const validateInput = useCallback((value: string): boolean => {
    const isValid = validateNumericInput(value, zoomValidationOptions);
    // console.log('🔍 Zoom validation:', { input: value, isValid });
    return isValid;
  }, []);

  // 🎯 ZOOM IN με 10 μονάδες αύξηση
  const handleZoomInClick = useCallback(() => {
    const current = normalizeInput(inputValue || (currentZoom * 100).toString());
    const newValue = Math.min(current + ZOOM_STEP, 99999);
    
    setInputValue(newValue.toString());
    onZoomIn();
    
    // console.log(`🔍 Zoom In: ${current}% → ${newValue}% (+${ZOOM_STEP})`);
  }, [inputValue, currentZoom, normalizeInput, onZoomIn]);

  // 🎯 ZOOM OUT με 10 μονάδες μείωση
  const handleZoomOutClick = useCallback(() => {
    const current = normalizeInput(inputValue || (currentZoom * 100).toString());
    const newValue = Math.max(current - ZOOM_STEP, 1);
    
    setInputValue(newValue.toString());
    onZoomOut();
    
    // console.log(`🔍 Zoom Out: ${current}% → ${newValue}% (-${ZOOM_STEP})`);
  }, [inputValue, currentZoom, normalizeInput, onZoomOut]);

  // 🎯 INPUT FOCUS - Επιλογή όλων των ψηφίων
  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    setTimeout(() => {
      e.target.select();
    }, 0);
    console.log('🎯 Zoom input focus - επιλογή όλου του κειμένου');
  }, []);

  // 🎯 INPUT CHANGE - Ενημέρωση κατά την πληκτρολόγηση
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    console.log('🎯 Zoom input change:', value);
  }, []);

  // 🎯 APPLY ZOOM - Κοινή λογική εφαρμογής
  const applyZoom = useCallback((explicitValue?: string) => {
    const valueToUse = explicitValue !== undefined ? explicitValue : inputValue;
    
    setIsEditing(false);
    
    console.log('🎯 Apply zoom called with:', { 
      explicitValue, 
      inputValue, 
      valueToUse 
    });
    
    if (!validateInput(valueToUse)) {
      const currentPercentage = Math.round(currentZoom * 100);
      setInputValue(currentPercentage.toString());
      console.warn(`⚠️ Άκυρη είσοδος zoom: "${valueToUse}". Επαναφορά σε ${currentPercentage}%`);
      return;
    }
    
    const newZoom = normalizeInput(valueToUse);
    const newZoomDecimal = newZoom / 100;
    
    console.log('🎯 Zoom values:', { 
      valueToUse, 
      newZoom, 
      currentZoom,
      newZoomDecimal
    });
    
    // Εφαρμογή μόνο αν διαφέρει από την τρέχουσα τιμή
    if (Math.abs(newZoomDecimal - currentZoom) > 0.001) {
      console.log('🎯 Calling onSetZoom with:', newZoomDecimal);
      onSetZoom(newZoomDecimal);
    } else {
      console.log('🎯 Zoom unchanged, skipping update');
    }
    
    setInputValue(newZoom.toString());
  }, [inputValue, currentZoom, validateInput, normalizeInput, onSetZoom]);

  // 🎯 ENTER KEY - Εφαρμογή του zoom
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const currentValue = (e.target as HTMLInputElement).value;
      console.log('🎯 Zoom Enter pressed with value:', currentValue);
      applyZoom(currentValue);
    }
  }, [applyZoom]);

  // 🎯 INPUT BLUR - Εφαρμογή κατά την απώλεια focus
  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const currentValue = e.target.value;
    console.log('🎯 Zoom input blur with value:', currentValue);
    applyZoom(currentValue);
  }, [applyZoom]);

  return (
    <div className="flex items-center gap-1 bg-gray-900 rounded px-2 py-1">
      <button
        onClick={handleZoomOutClick}
        className="h-6 w-6 p-0 text-gray-300 hover:text-white flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
        title={`Zoom Out (-${ZOOM_STEP}%) - Πληκτρολόγιο: -`}
      >
        <Minus className="w-3 h-3" />
      </button>
      
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        className="w-16 px-1 py-0 bg-gray-800 border border-gray-600 rounded text-white text-xs text-center focus:border-blue-500 focus:outline-none transition-colors select-all"
        title="Zoom percentage (1-99999%, δεκαδικά με . ή ,) - Press Enter or click away to apply"
        placeholder="100"
      />
      
      <span className="text-xs text-gray-400">%</span>
      
      <button
        onClick={handleZoomInClick}
        className="h-6 w-6 p-0 text-gray-300 hover:text-white flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
        title={`Zoom In (+${ZOOM_STEP}%) - Πληκτρολόγιο: +`}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};
