/**
 * 🏢 ENTERPRISE COLOR PICKER - Main Component
 *
 * @version 1.0.0
 * @description Complete color picker with Area, Sliders, Fields, Palettes
 *
 * Features:
 * - ColorArea (HSV 2D picker)
 * - Hue + Alpha sliders
 * - Mode switching (HEX/RGB/HSL)
 * - Brand + Recent palettes
 * - Contrast checker (optional)
 * - Eyedropper API (optional)
 * - Full accessibility
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

'use client';

import React, { useState, useCallback } from 'react';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS } from '../../config/color-config';
import { EnterpriseColorArea } from './EnterpriseColorArea';
import { HueSlider, AlphaSlider } from './EnterpriseColorSlider';
import { EnterpriseColorField } from './EnterpriseColorField';
import { SwatchesPalette } from './SwatchesPalette';
import { useRecentColors } from './RecentColorsStore';
import type { EnterpriseColorPickerProps, ColorMode } from './types';

/**
 * Enterprise Color Picker - Main Component
 *
 * @example
 * ```tsx
 * <EnterpriseColorPicker
 *   value="#ff0000"
 *   onChange={(color) => setColor(color)}
 *   alpha={true}
 *   modes={['hex', 'rgb', 'hsl']}
 *   palettes={['brand', 'dxf']}
 *   recent={true}
 * />
 * ```
 */
export function EnterpriseColorPicker({
  value,
  onChange,
  onChangeEnd,
  alpha = true,
  modes = ['hex', 'rgb', 'hsl'],
  palettes = ['brand', 'semantic', 'dxf'],
  recent = true,
  eyedropper = true,
  variant = 'inline',
  disabled = false,
  readOnly = false,
  labels = {},
  className = '',
  showContrast = false,
  contrastBackground = UI_COLORS.WHITE,
  onModeChange,
}: EnterpriseColorPickerProps) {
  const [currentMode, setCurrentMode] = useState<ColorMode>(modes[0] || 'hex');
  const { addColor } = useRecentColors();
  const { quick, getStatusBorder, radius, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // Handle color change
  const handleChange = useCallback(
    (newColor: string) => {
      onChange(newColor);
    },
    [onChange]
  );

  // Handle committed change (add to recent)
  const handleChangeEnd = useCallback(
    (newColor: string) => {
      addColor(newColor);
      onChangeEnd?.(newColor);
    },
    [addColor, onChangeEnd]
  );

  // Handle mode change
  const handleModeChange = useCallback(
    (mode: ColorMode) => {
      setCurrentMode(mode);
      onModeChange?.(mode);
    },
    [onModeChange]
  );

  // Eyedropper support check
  const supportsEyedropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const showEyedropper = eyedropper && supportsEyedropper;

  return (
    <div
      className={`space-y-4 p-4 ${colors.bg.primary} border ${getStatusBorder('muted')} ${quick.card} ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      {/* === COLOR AREA + HUE SLIDER === */}
      <div className="space-y-3">
        <EnterpriseColorArea
          value={value}
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          disabled={disabled}
          size={192}
        />

        <HueSlider
          value={value}
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          disabled={disabled}
          width={192}
        />

        {alpha && (
          <AlphaSlider
            value={value}
            onChange={handleChange}
            onChangeEnd={handleChangeEnd}
            disabled={disabled}
            width={192}
          />
        )}
      </div>

      {/* === MODE TABS + COLOR FIELD === */}
      <div className="space-y-2">
        {/* Mode tabs */}
        {modes.length > 1 && (
          <div className={`flex gap-1 ${getDirectionalBorder('muted', 'bottom')}`}>
            {modes.map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                disabled={disabled || readOnly}
                className={`
                  px-3 py-1 text-xs font-medium transition-colors
                  ${currentMode === mode
                    ? `text-blue-400 ${getDirectionalBorder('info', 'bottom')}`
                    : `${colors.text.muted} ${HOVER_TEXT_EFFECTS.GRAY_LIGHT}`
                  }
                `}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Color field */}
        <EnterpriseColorField
          value={value}
          onChange={handleChange}
          mode={currentMode}
          alpha={alpha}
          disabled={disabled}
          readOnly={readOnly}
          labels={labels}
        />
      </div>

      {/* === EYEDROPPER BUTTON === */}
      {showEyedropper && (
        <EyedropperButton
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          disabled={disabled}
        />
      )}

      {/* === SWATCHES PALETTE === */}
      <SwatchesPalette
        paletteIds={palettes}
        showRecent={recent}
        value={value}
        onChange={(color) => {
          handleChange(color);
          handleChangeEnd(color);
        }}
        swatchSize={32}
        columns={6}
      />

      {/* === CONTRAST PANEL === */}
      {showContrast && (
        <ContrastPanelPlaceholder
          foreground={value}
          background={contrastBackground}
        />
      )}
    </div>
  );
}

// ===== EYEDROPPER BUTTON =====

interface EyedropperButtonProps {
  onChange: (color: string) => void;
  onChangeEnd: (color: string) => void;
  disabled?: boolean;
}

function EyedropperButton({ onChange, onChangeEnd, disabled }: EyedropperButtonProps) {
  const [isActive, setIsActive] = useState(false);
  const colors = useSemanticColors();

  const handleClick = async () => {
    if (disabled || typeof window === 'undefined' || !('EyeDropper' in window)) {
      return;
    }

    try {
      setIsActive(true);
      // EyeDropper API - using proper type declaration
      const EyeDropper = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      if (!EyeDropper) throw new Error('EyeDropper not supported');
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();

      if (result?.sRGBHex) {
        onChange(result.sRGBHex);
        onChangeEnd(result.sRGBHex);
      }
    } catch (error) {
      // User cancelled or error occurred
      console.warn('[Eyedropper] Error:', error);
    } finally {
      setIsActive(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        w-full px-4 py-2 rounded
        flex items-center justify-center gap-2
        text-sm font-medium
        transition-colors
        ${isActive
          ? 'bg-blue-600 text-white'
          : `${colors.bg.secondary} ${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.GRAY_DARKER}`
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M13.5 5L11 2.5M11 2.5L8.5 5M11 2.5V8M3.5 11L1 13.5M1 13.5L3.5 16M1 13.5H6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {isActive ? 'Click to pick a color...' : 'Pick color from screen'}
    </button>
  );
}

// ===== CONTRAST PANEL PLACEHOLDER =====

interface ContrastPanelPlaceholderProps {
  foreground: string;
  background: string;
}

function ContrastPanelPlaceholder({ foreground, background }: ContrastPanelPlaceholderProps) {
  const colors = useSemanticColors();
  const { radius, getStatusBorder } = useBorderTokens();
  return (
    <div className={`p-3 ${colors.bg.secondary} ${radius.md} border ${getStatusBorder('muted')}`}>
      <h4 className={`text-sm font-medium ${colors.text.muted} mb-2`}>Contrast Checker</h4>
      <div className={`text-xs ${colors.text.muted}`}>
        <div>Foreground: {foreground}</div>
        <div>Background: {background}</div>
        <div className={`mt-2 ${colors.text.secondary}`}>
          Full WCAG contrast checker coming soon...
        </div>
      </div>
    </div>
  );
}
