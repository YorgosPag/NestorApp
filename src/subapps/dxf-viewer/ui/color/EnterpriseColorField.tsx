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
import type { EnterpriseColorFieldProps, ColorMode, RGBColor, HSLColor } from './types';
import { parseColor, rgbToHex, formatRgb, formatHsl, parseHex, parseRgb, parseHsl, hslToRgb } from './utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
    <div className="flex items-center gap-2">
      <label className={`text-sm ${colors.text.secondary} w-12`}>{labels.hex || 'HEX'}</label>
      <input
        type="text"
        value={formattedValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        readOnly={readOnly}
        placeholder="#000000"
        className={`
          flex-1 px-3 py-2 ${colors.bg.secondary} ${quick.input}
          text-sm text-white font-mono
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
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
      <div className="grid grid-cols-4 gap-2">
        {/* Red */}
        <div>
          <label className="text-xs ${colors.text.muted}">{labels.red || 'R'}</label>
          <input
            type="number"
            min="0"
            max="255"
            value={Math.round(r)}
            onChange={(e) => handleComponentChange('r', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`w-full px-2 py-1 ${colors.bg.secondary} ${quick.input} text-sm text-white`}
          />
        </div>

        {/* Green */}
        <div>
          <label className="text-xs ${colors.text.muted}">{labels.green || 'G'}</label>
          <input
            type="number"
            min="0"
            max="255"
            value={Math.round(g)}
            onChange={(e) => handleComponentChange('g', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`w-full px-2 py-1 ${colors.bg.secondary} ${quick.input} text-sm text-white`}
          />
        </div>

        {/* Blue */}
        <div>
          <label className="text-xs ${colors.text.muted}">{labels.blue || 'B'}</label>
          <input
            type="number"
            min="0"
            max="255"
            value={Math.round(b)}
            onChange={(e) => handleComponentChange('b', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`w-full px-2 py-1 ${colors.bg.secondary} ${quick.input} text-sm text-white`}
          />
        </div>

        {/* Alpha */}
        {alpha && (
          <div>
            <label className="text-xs ${colors.text.muted}">{labels.alpha || 'A'}</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={(rgbAlpha ?? 1).toFixed(2)}
              onChange={(e) => handleComponentChange('a', parseFloat(e.target.value) || 0)}
              disabled={disabled}
              readOnly={readOnly}
              className={`w-full px-2 py-1 ${colors.bg.secondary} ${quick.input} text-sm text-white`}
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
      <div className="grid grid-cols-4 gap-2">
        {/* Hue */}
        <div>
          <label className="text-xs ${colors.text.muted}">{labels.hue || 'H'}</label>
          <input
            type="number"
            min="0"
            max="360"
            value={Math.round(h)}
            onChange={(e) => handleComponentChange('h', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`w-full px-2 py-1 ${colors.bg.secondary} ${quick.input} text-sm text-white`}
          />
        </div>

        {/* Saturation */}
        <div>
          <label className="text-xs ${colors.text.muted}">{labels.saturation || 'S'}</label>
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(s)}
            onChange={(e) => handleComponentChange('s', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`w-full px-2 py-1 ${colors.bg.secondary} ${quick.input} text-sm text-white`}
          />
        </div>

        {/* Lightness */}
        <div>
          <label className="text-xs ${colors.text.muted}">{labels.lightness || 'L'}</label>
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(l)}
            onChange={(e) => handleComponentChange('l', parseInt(e.target.value) || 0)}
            disabled={disabled}
            readOnly={readOnly}
            className={`w-full px-2 py-1 ${colors.bg.secondary} ${quick.input} text-sm text-white`}
          />
        </div>

        {/* Alpha */}
        {alpha && (
          <div>
            <label className="text-xs ${colors.text.muted}">{labels.alpha || 'A'}</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={(hslAlpha ?? 1).toFixed(2)}
              onChange={(e) => handleComponentChange('a', parseFloat(e.target.value) || 0)}
              disabled={disabled}
              readOnly={readOnly}
              className={`w-full px-2 py-1 ${colors.bg.secondary} ${quick.input} text-sm text-white`}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {renderField()}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
