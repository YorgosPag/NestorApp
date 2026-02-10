/**
 * 🏢 ENTERPRISE COLOR FIELD
 *
 * @version 1.0.0
 * @description Input field for color values with mode switching (HEX/RGB/HSL)
 *
 * Features:
 * - Multiple input modes (HEX, RGB, HSL)
 * - Live validation
 * - Keyboard support (Arrow keys, Tab)
 * - ARIA compliant
 * - Error states
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { EnterpriseColorFieldProps, RGBColor, HSLColor } from './types';
import { parseColor, rgbToHex, formatRgb, formatHsl, hslToRgb } from './utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE ADR-082: Centralized number formatting (replaces .toFixed())
import { getFormatter } from '../../formatting';

/**
 * Enterprise Color Field Component
 *
 * @example
 * ```tsx
 * <EnterpriseColorField
 *   value="#ff0000"
 *   onChange={(color) => console.log(color)}
 *   mode="hex"
 *   alpha={true}
 * />
 * ```
 */
export function EnterpriseColorField({
  value,
  onChange,
  mode,
  alpha = false,
  disabled = false,
  readOnly = false,
  labels = {},
  className = '',
}: EnterpriseColorFieldProps) {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [inputValue, setInputValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  // Parse current color
  const colorValue = useMemo(() => {
    const result = parseColor(value);
    return result.valid ? result.color : null;
  }, [value]);

  // Format value based on mode
  const formattedValue = useMemo(() => {
    if (!colorValue) return inputValue;

    switch (mode) {
      case 'hex':
        return rgbToHex(colorValue.rgb, { alpha });
      case 'rgb':
        return formatRgb(colorValue.rgb, alpha);
      case 'hsl':
        return formatHsl(colorValue.hsl, alpha);
      default:
        return inputValue;
    }
  }, [colorValue, mode, alpha, inputValue]);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      // Validate and parse
      const result = parseColor(newValue);

      if (result.valid && result.color) {
        const hex = rgbToHex(result.color.rgb, { alpha });
        onChange(hex);
        setError(null);
      } else {
        setError(result.error || 'Invalid color');
      }
    },
    [onChange, alpha]
  );

  // Handle blur (commit value)
  const handleBlur = useCallback(() => {
    if (error) {
      // Reset to valid value
      setInputValue(formattedValue);
      setError(null);
    }
  }, [error, formattedValue]);

  // Render individual component based on mode
  const renderField = () => {
    switch (mode) {
      case 'hex':
        return renderHexField();
      case 'rgb':
        return renderRgbFields();
      case 'hsl':
        return renderHslFields();
      default:
        return null;
    }
  };

  // === HEX MODE ===
  const renderHexField = () => (
    <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
      <label className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${colors.text.secondary} ${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY}`}>{labels.hex || 'HEX'}</label>
      <input
        type="text"
        value={formattedValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={UI_COLORS.BLACK}
        className={`
          flex-1 ${PANEL_LAYOUT.INPUT.PADDING} ${colors.bg.secondary} ${quick.input}
          ${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}
          ${PANEL_LAYOUT.INPUT.FOCUS} focus:ring-2 ${colors.ring.info}
          disabled:${PANEL_LAYOUT.OPACITY['50']} disabled:${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}
          ${error ? getStatusBorder('error').replace('border ', '') : ''}
        `}
      />
    </div>
  );

  // === RGB MODE ===
  const renderRgbFields = () => {
    if (!colorValue) return null;

    const { r, g, b, a: rgbAlpha } = colorValue.rgb;

    const handleComponentChange = (component: 'r' | 'g' | 'b' | 'a', newValue: number) => {
      const updated: RGBColor = { ...colorValue.rgb, [component]: newValue };
      const hex = rgbToHex(updated, { alpha });
      onChange(hex);
    };

    return (
      <div className={`grid ${PANEL_LAYOUT.GRID.COLS_4} ${PANEL_LAYOUT.GAP.SM}`}>
        {/* Red */}
        <div>
          <label className={`${PANEL_LAYOUT.ALERT.TEXT_SIZE} ${colors.text.muted}`}>{labels.red || 'R'}</label>
          <input
            type="number"
            min="0"
            max="255"
            value={Math.round(r)}
            onChange={(e) => handleComponentChange('r', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.secondary} ${quick.input} ${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${colors.text.primary}`}
          />
        </div>

        {/* Green */}
        <div>
          <label className={`${PANEL_LAYOUT.ALERT.TEXT_SIZE} ${colors.text.muted}`}>{labels.green || 'G'}</label>
          <input
            type="number"
            min="0"
            max="255"
            value={Math.round(g)}
            onChange={(e) => handleComponentChange('g', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.secondary} ${quick.input} ${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${colors.text.primary}`}
          />
        </div>

        {/* Blue */}
        <div>
          <label className={`${PANEL_LAYOUT.ALERT.TEXT_SIZE} ${colors.text.muted}`}>{labels.blue || 'B'}</label>
          <input
            type="number"
            min="0"
            max="255"
            value={Math.round(b)}
            onChange={(e) => handleComponentChange('b', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.secondary} ${quick.input} ${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${colors.text.primary}`}
          />
        </div>

        {/* Alpha */}
        {/* 🏢 ENTERPRISE ADR-082: Uses FormatterRegistry for locale-aware alpha formatting */}
        {alpha && (
          <div>
            <label className={`${PANEL_LAYOUT.ALERT.TEXT_SIZE} ${colors.text.muted}`}>{labels.alpha || 'A'}</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={getFormatter().formatLinear(rgbAlpha ?? 1, { precision: 2 })}
              onChange={(e) => handleComponentChange('a', parseFloat(e.target.value) || 0)}
              disabled={disabled}
              readOnly={readOnly}
              className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.secondary} ${quick.input} ${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${colors.text.primary}`}
            />
          </div>
        )}
      </div>
    );
  };

  // === HSL MODE ===
  const renderHslFields = () => {
    if (!colorValue) return null;

    const { h, s, l, a: hslAlpha } = colorValue.hsl;

    const handleComponentChange = (component: 'h' | 's' | 'l' | 'a', newValue: number) => {
      const updated: HSLColor = { ...colorValue.hsl, [component]: newValue };
      // ✅ ENTERPRISE: Convert HSL to RGB using proper utility function
      const rgb = hslToRgb(updated);
      const hex = rgbToHex(rgb, { alpha });
      onChange(hex);
    };

    return (
      <div className={`grid ${PANEL_LAYOUT.GRID.COLS_4} ${PANEL_LAYOUT.GAP.SM}`}>
        {/* Hue */}
        <div>
          <label className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{labels.hue || 'H'}</label>
          <input
            type="number"
            min="0"
            max="360"
            value={Math.round(h)}
            onChange={(e) => handleComponentChange('h', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.secondary} ${quick.input} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}
          />
        </div>

        {/* Saturation */}
        <div>
          <label className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{labels.saturation || 'S'}</label>
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(s)}
            onChange={(e) => handleComponentChange('s', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.secondary} ${quick.input} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}
          />
        </div>

        {/* Lightness */}
        <div>
          <label className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{labels.lightness || 'L'}</label>
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(l)}
            onChange={(e) => handleComponentChange('l', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.secondary} ${quick.input} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}
          />
        </div>

        {/* Alpha */}
        {/* 🏢 ENTERPRISE ADR-082: Uses FormatterRegistry for locale-aware alpha formatting */}
        {alpha && (
          <div>
            <label className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{labels.alpha || 'A'}</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={getFormatter().formatLinear(hslAlpha ?? 1, { precision: 2 })}
              onChange={(e) => handleComponentChange('a', parseFloat(e.target.value) || 0)}
              disabled={disabled}
              readOnly={readOnly}
              className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.secondary} ${quick.input} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${className}`}>
      {renderField()}
      {error && <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.error}`}>{error}</div>}
    </div>
  );
}
