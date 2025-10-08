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
import type { AriaColorSliderProps } from '@react-aria/color';

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

  // Parse color and convert to appropriate format
  const parsedColor = parseAriaColor(value);

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
  });

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
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {showLabel && (
        <div className="flex justify-between text-sm">
          <label {...labelProps} className="text-gray-300">
            {label || getDefaultLabel(channel)}
          </label>
          <output {...outputProps} className="text-gray-400 font-mono">
            {formatValue(channel, state.value.getChannelValue(channel))}
          </output>
        </div>
      )}

      {/* Track */}
      <div
        {...trackProps}
        ref={trackRef}
        className={`relative h-6 rounded ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          width,
          touchAction: 'none',
          ...trackStyle,
        }}
      >
        {/* Checkered background for alpha */}
        {channel === 'alpha' && (
          <div
            className="absolute inset-0 rounded"
            style={{
              backgroundImage: `
                linear-gradient(45deg, #ccc 25%, transparent 25%),
                linear-gradient(-45deg, #ccc 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #ccc 75%),
                linear-gradient(-45deg, transparent 75%, #ccc 75%)
              `,
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
            absolute w-5 h-5 top-1/2 rounded-full border-2 border-white shadow-lg
            transform -translate-x-1/2 -translate-y-1/2
            ${isFocusVisible ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
            ${disabled ? 'pointer-events-none' : ''}
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
        background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
      };

    case 'alpha':
      // Gradient from transparent to current color
      return {
        background: `linear-gradient(to right, transparent, ${currentColor})`,
      };

    case 'saturation':
      // From gray to saturated color
      return {
        background: `linear-gradient(to right, #808080, ${currentColor})`,
      };

    case 'brightness':
    case 'lightness':
      // From black to color to white
      return {
        background: `linear-gradient(to right, #000000, ${currentColor}, #ffffff)`,
      };

    case 'red':
      return {
        background: 'linear-gradient(to right, #000000, #ff0000)',
      };

    case 'green':
      return {
        background: 'linear-gradient(to right, #000000, #00ff00)',
      };

    case 'blue':
      return {
        background: 'linear-gradient(to right, #000000, #0000ff)',
      };

    default:
      return {
        background: '#808080',
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
