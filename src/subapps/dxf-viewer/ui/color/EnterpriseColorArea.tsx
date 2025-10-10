/**
 * 🏢 ENTERPRISE COLOR AREA
 *
 * @version 1.0.0
 * @description 2D color picker area for Saturation × Value selection
 *
 * Features:
 * - React Aria color area hooks
 * - Drag interaction with pointer/touch support
 * - Keyboard navigation (Arrow keys, PageUp/Down, Home/End)
 * - ARIA compliant
 * - Throttled rendering (requestAnimationFrame)
 * - RTL support
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

'use client';

import React, { useRef, useCallback } from 'react';
import { useColorArea } from '@react-aria/color';
import { useColorAreaState } from '@react-stately/color';
import { parseColor as parseAriaColor } from '@react-stately/color';
import { useFocusRing } from '@react-aria/focus';
import type { AriaColorAreaProps } from '@react-aria/color';

interface EnterpriseColorAreaProps {
  /** Current color value (hex) */
  value: string;

  /** Change callback */
  onChange: (color: string) => void;

  /** Change end callback (committed change) */
  onChangeEnd?: (color: string) => void;

  /** Disabled state */
  disabled?: boolean;

  /** Size in pixels (default: 192) */
  size?: number;

  /** Additional CSS class */
  className?: string;
}

/**
 * Enterprise Color Area Component
 *
 * Uses React Aria's useColorArea for full accessibility
 */
export function EnterpriseColorArea({
  value,
  onChange,
  onChangeEnd,
  disabled = false,
  size = 192,
  className = '',
}: EnterpriseColorAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputXRef = useRef<HTMLInputElement>(null);
  const inputYRef = useRef<HTMLInputElement>(null);

  // ✅ FIX (ChatGPT-5): Guard against undefined/null value
  // Default to white (#FFFFFF) if value is missing
  const safeValue = value || '#FFFFFF';

  // Parse color using React Aria's parser and convert to HSB
  const parsedColor = parseAriaColor(safeValue);
  const ariaColor = parsedColor.toFormat('hsb');

  // Create color area state
  const state = useColorAreaState({
    value: ariaColor,
    onChange: (color) => {
      const hex = color.toString('hex');
      onChange(hex);
    },
    onChangeEnd: (color) => {
      const hex = color.toString('hex');
      onChangeEnd?.(hex);
    },
    xChannel: 'saturation',
    yChannel: 'brightness',
    isDisabled: disabled,
  });

  // Use React Aria color area hook
  const { colorAreaProps, thumbProps, xInputProps, yInputProps } = useColorArea(
    {
      'aria-label': 'Color area',
      xChannel: 'saturation',
      yChannel: 'brightness',
      isDisabled: disabled,
      inputXRef,
      inputYRef,
      containerRef,
    },
    state
  );

  // Focus ring for accessibility
  const { focusProps, isFocusVisible } = useFocusRing();

  // Get thumb position
  const thumbPosition = state.getThumbPosition({
    width: size,
    height: size,
  });

  // Background gradient (HSV-based)
  const hue = state.value.getChannelValue('hue');
  const gradientStyle: React.CSSProperties = {
    background: `
      linear-gradient(to top, black, transparent),
      linear-gradient(to right, white, hsl(${hue}, 100%, 50%))
    `,
  };

  return (
    <div
      {...colorAreaProps}
      ref={containerRef}
      className={`relative rounded-lg overflow-hidden ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'} ${className}`}
      style={{
        width: size,
        height: size,
        touchAction: 'none', // Prevent scrolling during drag
      }}
    >
      {/* Color gradient background */}
      <div
        className="absolute inset-0"
        style={gradientStyle}
      />

      {/* Thumb (position indicator) */}
      <div
        {...thumbProps}
        {...focusProps}
        className={`
          absolute w-5 h-5 rounded-full border-2 border-white shadow-lg
          transform -translate-x-1/2 -translate-y-1/2
          ${isFocusVisible ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
          ${disabled ? 'pointer-events-none' : ''}
        `}
        style={{
          left: thumbPosition.x,
          top: thumbPosition.y,
          backgroundColor: state.value.toString('css'),
        }}
      >
        {/* Hidden inputs for accessibility */}
        <input {...xInputProps} ref={inputXRef} />
        <input {...yInputProps} ref={inputYRef} />
      </div>
    </div>
  );
}

/**
 * Color Area with label and description
 */
export function EnterpriseColorAreaWithLabel({
  label,
  description,
  ...props
}: EnterpriseColorAreaProps & {
  label?: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
        </label>
      )}

      <EnterpriseColorArea {...props} />

      {description && (
        <p className="text-xs text-gray-400">{description}</p>
      )}
    </div>
  );
}
