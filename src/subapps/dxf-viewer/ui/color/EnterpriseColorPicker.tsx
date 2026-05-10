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

import React, { useState, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS } from '../../config/color-config';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { EnterpriseColorArea } from './EnterpriseColorArea';
import { HueSlider, AlphaSlider, BrightnessSlider, SaturationSlider } from './EnterpriseColorSlider';
import { useContrast } from './hooks/useContrast';
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
  showContrast = true,
  contrastBackground = UI_COLORS.WHITE,
  onModeChange,
}: EnterpriseColorPickerProps) {
  const [currentMode, setCurrentMode] = useState<ColorMode>(modes[0] || 'hex');
  const { addColor } = useRecentColors();
  const { quick, getStatusBorder, radius, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('dxf-viewer-panels');
  // Deferred value: ContrastPanel and SwatchesPalette skip re-renders mid-drag
  const deferredValue = useDeferredValue(value);

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
      className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${PANEL_LAYOUT.SPACING.LG} ${colors.bg.primary} border ${getStatusBorder('muted')} ${quick.card} ${disabled ? `${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}` : ''} ${className}`}
    >
      {/* === COLOR AREA + HUE SLIDER === */}
      <div className={PANEL_LAYOUT.SPACING.GAP_MD}>
        <EnterpriseColorArea
          value={value}
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          disabled={disabled}
          size={192}
        />

        <div className={`flex items-end ${PANEL_LAYOUT.GAP.SM}`}>
          <HueSlider
            value={value}
            onChange={handleChange}
            onChangeEnd={handleChangeEnd}
            disabled={disabled}
            width={192}
            label={t('colorPicker.channels.hue')}
          />
          {/* Color preview swatch */}
          <div
            className={`${PANEL_LAYOUT.ICON.SWATCH} flex-shrink-0 ${PANEL_LAYOUT.ROUNDED.DEFAULT} border border-white/20`}
            style={{ backgroundColor: value }}
            role="img"
            aria-label={t('colorPicker.colorPreview')}
          />
        </div>

        <BrightnessSlider
          value={value}
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          disabled={disabled}
          width={192}
          label={t('colorPicker.channels.brightness')}
        />

        <SaturationSlider
          value={value}
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          disabled={disabled}
          width={192}
          label={t('colorPicker.channels.saturation')}
        />

        {alpha && (
          <AlphaSlider
            value={value}
            onChange={handleChange}
            onChangeEnd={handleChangeEnd}
            disabled={disabled}
            width={192}
            label={t('colorPicker.channels.alpha')}
          />
        )}
      </div>

      {/* === MODE TABS + COLOR FIELD === */}
      <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
        {/* Mode tabs */}
        {modes.length > 1 && (
          <div className={`flex ${PANEL_LAYOUT.GAP.XS} ${getDirectionalBorder('muted', 'bottom')}`}>
            {modes.map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                disabled={disabled || readOnly}
                className={`
                  ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TRANSITION.COLORS}
                  ${currentMode === mode
                    ? `${colors.text.info} ${getDirectionalBorder('info', 'bottom')}`
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
        value={deferredValue}
        onChange={(color) => {
          handleChange(color);
          handleChangeEnd(color);
        }}
        swatchSize={32}
        columns={6}
      />

      {/* === CONTRAST PANEL === */}
      {showContrast && (
        <ContrastPanel
          foreground={deferredValue}
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
  const { t } = useTranslation('dxf-viewer-panels');

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
        w-full ${PANEL_LAYOUT.BUTTON.PADDING_LG} rounded
        flex items-center justify-center ${PANEL_LAYOUT.GAP.SM}
        ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}
        ${PANEL_LAYOUT.TRANSITION.COLORS}
        ${isActive
          ? `${colors.bg.info} ${colors.text.primary}`
          : `${colors.bg.secondary} ${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.GRAY_DARKER}`
        }
        disabled:${PANEL_LAYOUT.OPACITY['50']} disabled:${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}
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
      {isActive ? t('colorPicker.pickingColor') : t('colorPicker.pickColor')}
    </button>
  );
}

// ===== CONTRAST PANEL =====

interface ContrastPanelProps {
  foreground: string;
  background: string;
}

interface ContrastRowProps {
  label: string;
  ratio: string;
  passAA: boolean;
  passAAA: boolean;
  textColor: string;
  bgColor: string;
}

function ContrastRow({ label, ratio, passAA, passAAA, textColor, bgColor }: ContrastRowProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('dxf-viewer-panels');
  return (
    <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
      <div
        className={`${PANEL_LAYOUT.ICON.SWATCH} flex-shrink-0 ${PANEL_LAYOUT.ROUNDED.SM} flex items-center justify-center ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        Aa
      </div>
      <span className={`flex-1 ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary}`}>{label}</span>
      <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_FAMILY.CODE} ${colors.text.primary}`}>{ratio}</span>
      <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${passAA ? 'text-green-500' : 'text-red-500'}`}>AA</span>
      <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${passAAA ? 'text-green-500' : 'text-red-500'}`}>AAA</span>
    </div>
  );
}

function ContrastPanel({ foreground }: ContrastPanelProps) {
  const colors = useSemanticColors();
  const { radius, getStatusBorder } = useBorderTokens();
  const { t } = useTranslation('dxf-viewer-panels');
  const vsBlack = useContrast('#000000', foreground);
  const vsWhite = useContrast('#ffffff', foreground);
  return (
    <div className={`${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${radius.md} border ${getStatusBorder('muted')}`}>
      <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
        {t('colorPicker.contrastChecker')}
      </h4>
      <div className={`${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <ContrastRow
          label={t('colorPicker.vsBlack')}
          ratio={vsBlack.ratioString}
          passAA={vsBlack.passAA}
          passAAA={vsBlack.passAAA}
          textColor="#000000"
          bgColor={foreground}
        />
        <ContrastRow
          label={t('colorPicker.vsWhite')}
          ratio={vsWhite.ratioString}
          passAA={vsWhite.passAA}
          passAAA={vsWhite.passAAA}
          textColor="#ffffff"
          bgColor={foreground}
        />
      </div>
    </div>
  );
}
