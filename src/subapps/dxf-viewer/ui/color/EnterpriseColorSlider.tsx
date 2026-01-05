/**
 * 🏢 ENTERPRISE COLOR SLIDER
 *
 * @version 1.0.0
 * @description Slider for Hue, Alpha, and individual color channels
 *
 * Features:
 * - React Aria slider hooks
 * - Hue gradient (0-360°)
 * - Alpha gradient with checkered background
 * - Keyboard support (Arrow keys, PageUp/Down, Home/End)
 * - ARIA compliant
 * - RTL support
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

'use client';

import React, { useRef } from 'react';
import { useColorSlider } from '@react-aria/color';
import { useColorSliderState } from '@react-stately/color';
import { parseColor as parseAriaColor } from '@react-stately/color';
import { useFocusRing } from '@react-aria/focus';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS, UI_GRADIENTS } from '../../config/color-config';
import type { AriaColorSliderProps } from '@react-aria/color';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';

type SliderChannel = 'hue' | 'saturation' | 'brightness' | 'lightness' | 'red' | 'green' | 'blue' | 'alpha';

interface EnterpriseColorSliderProps {
  /** Color channel to control */
  channel: SliderChannel;

  /** Current color value (hex) */
  value: string;

  /** Change callback */
  onChange: (color: string) => void;

  /** Change end callback (committed change) */
  onChangeEnd?: (color: string) => void;

  /** Disabled state */
  disabled?: boolean;

  /** Show label */
  showLabel?: boolean;

  /** Custom label */
  label?: string;

  /** Width in pixels (default: 192) */
  width?: number;

  /** Additional CSS class */
  className?: string;
}

/**
 * Enterprise Color Slider Component
 */
export function EnterpriseColorSlider({
  channel,
  value,
  onChange,
  onChangeEnd,
  disabled = false,
  showLabel = true,
  label,
  width = 192,
  className = '',
}: EnterpriseColorSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = useSemanticColors();

  // ✅ FIX (ChatGPT-5): Guard against undefined/null value
  // Default to white if value is missing
  const safeValue = value || UI_COLORS.WHITE;

  // Parse color and convert to appropriate format
  const parsedColor = parseAriaColor(safeValue);

  // Convert to HSB if using HSB channels (hue/saturation/brightness)
  // Keep RGB if using RGB channels (red/green/blue)
  // Convert to HSL if using HSL channels (lightness)
  const ariaColor =
    channel === 'hue' || channel === 'saturation' || channel === 'brightness'
      ? parsedColor.toFormat('hsb')
      : channel === 'lightness'
      ? parsedColor.toFormat('hsl')
      : parsedColor; // RGB or alpha

  // Create slider state
  const state = useColorSliderState({
    value: ariaColor,
    channel,
    onChange: (color) => {
      const hex = color.toString('hex');
      onChange(hex);
    },
    onChangeEnd: (color) => {
      const hex = color.toString('hex');
      onChangeEnd?.(hex);
    },
    isDisabled: disabled,
  } as ColorSliderStateOptions);

  // Use React Aria slider hook
  const { trackProps, thumbProps, inputProps, labelProps, outputProps } = useColorSlider(
    {
      channel,
      'aria-label': label || getDefaultLabel(channel),
      isDisabled: disabled,
      trackRef,
      inputRef,
    },
    state
  );

  // Focus ring
  const { focusProps, isFocusVisible } = useFocusRing();

  // Get track gradient
  const trackStyle = getTrackGradient(channel, ariaColor.toString('hex'));

  // Thumb position
  const thumbPosition = state.getThumbPercent() * 100;

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${className}`}>
      {/* Label */}
      {showLabel && (
        <div className={`flex justify-between ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
          <label {...labelProps} className={colors.text.secondary}>
            {label || getDefaultLabel(channel)}
          </label>
          <output {...outputProps} className={`${colors.text.muted} font-mono`}>
            {formatValue(channel, state.value.getChannelValue(channel))}
          </output>
        </div>
      )}

      {/* Track */}
      <div
        {...trackProps}
        ref={trackRef}
        className={`relative h-6 rounded touch-none ${disabled ? `${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}` : PANEL_LAYOUT.CURSOR.POINTER}`}
        style={{
          width,
          ...trackStyle,
        }}
      >
        {/* Checkered background for alpha */}
        {channel === 'alpha' && (
          <div
            className="absolute inset-0 rounded"
            style={{
              backgroundImage: UI_GRADIENTS.ALPHA_CHECKERBOARD,
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            }}
          />
        )}

        {/* Thumb */}
        <div
          {...thumbProps}
          {...focusProps}
          className={`
            absolute w-5 h-5 ${PANEL_LAYOUT.POSITION.TOP_HALF} rounded-full border border-white shadow-lg
            transform -translate-x-1/2 -translate-y-1/2
            ${isFocusVisible ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
            ${disabled ? PANEL_LAYOUT.POINTER_EVENTS.NONE : ''}
          `}
          style={{
            left: `${thumbPosition}%`,
            backgroundColor: getThumbColor(channel, ariaColor.toString('hex')),
          }}
        >
          {/* Hidden input for accessibility */}
          <input {...inputProps} ref={inputRef} />
        </div>
      </div>
    </div>
  );
}

// ===== HELPER FUNCTIONS =====

/**
 * Get default label for channel
 */
function getDefaultLabel(channel: SliderChannel): string {
  const labels: Record<SliderChannel, string> = {
    hue: 'Hue',
    saturation: 'Saturation',
    brightness: 'Brightness',
    lightness: 'Lightness',
    red: 'Red',
    green: 'Green',
    blue: 'Blue',
    alpha: 'Alpha',
  };
  return labels[channel];
}

/**
 * Format channel value for display
 */
function formatValue(channel: SliderChannel, value: number): string {
  switch (channel) {
    case 'hue':
      return `${Math.round(value)}°`;
    case 'saturation':
    case 'brightness':
    case 'lightness':
      return `${Math.round(value)}%`;
    case 'red':
    case 'green':
    case 'blue':
      return Math.round(value).toString();
    case 'alpha':
      return `${Math.round(value * 100)}%`;
    default:
      return value.toString();
  }
}

/**
 * Get track gradient style
 */
function getTrackGradient(channel: SliderChannel, currentColor: string): React.CSSProperties {
  switch (channel) {
    case 'hue':
      return {
        background: UI_GRADIENTS.HUE_SPECTRUM,
      };

    case 'alpha':
      // Gradient from transparent to current color
      return {
        background: UI_GRADIENTS.ALPHA_FADE(currentColor),
      };

    case 'saturation':
      // From gray to saturated color
      return {
        background: UI_GRADIENTS.SATURATION_FADE(currentColor),
      };

    case 'brightness':
    case 'lightness':
      // From black to color to white
      return {
        background: UI_GRADIENTS.BRIGHTNESS_FADE(currentColor),
      };

    case 'red':
      return {
        background: UI_GRADIENTS.RED_CHANNEL,
      };

    case 'green':
      return {
        background: UI_GRADIENTS.GREEN_CHANNEL,
      };

    case 'blue':
      return {
        background: UI_GRADIENTS.BLUE_CHANNEL,
      };

    default:
      return {
        background: UI_COLORS.MEDIUM_GRAY,
      };
  }
}

/**
 * Get thumb color
 */
function getThumbColor(channel: SliderChannel, currentColor: string): string {
  if (channel === 'hue') {
    // Show current hue
    return currentColor;
  }
  if (channel === 'alpha') {
    // Show current color with alpha
    return currentColor;
  }
  // For other channels, show current color
  return currentColor;
}

// ===== PRESET SLIDER COMPONENTS =====

/**
 * Hue slider (shortcut)
 */
export function HueSlider(props: Omit<EnterpriseColorSliderProps, 'channel'>) {
  return <EnterpriseColorSlider {...props} channel="hue" />;
}

/**
 * Alpha slider (shortcut)
 */
export function AlphaSlider(props: Omit<EnterpriseColorSliderProps, 'channel'>) {
  return <EnterpriseColorSlider {...props} channel="alpha" />;
}

/**
 * Saturation slider (shortcut)
 */
export function SaturationSlider(props: Omit<EnterpriseColorSliderProps, 'channel'>) {
  return <EnterpriseColorSlider {...props} channel="saturation" />;
}

/**
 * Brightness slider (shortcut)
 */
export function BrightnessSlider(props: Omit<EnterpriseColorSliderProps, 'channel'>) {
  return <EnterpriseColorSlider {...props} channel="brightness" />;
}
