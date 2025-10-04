/**
 * SHARED COLOR PICKER COMPONENT
 * Unified component για όλα τα color picker patterns
 * ΒΗΜΑ 8 του FloatingPanelContainer refactoring
 */

import React from 'react';

/**
 * Props for the SharedColorPicker component
 */
interface SharedColorPickerProps {
  /** Current color value in hex format (e.g., '#ff0000') */
  value: string;
  /** Callback fired when color changes */
  onChange: (color: string) => void;
  /** Optional label text displayed above the color picker */
  label?: string;
  /** Whether the color picker is disabled */
  disabled?: boolean;
  /** Additional CSS classes to apply to the container */
  className?: string;

  // Layout options
  /** Whether to show the color preview square */
  showPreview?: boolean;
  /** Size of the color preview square */
  previewSize?: 'small' | 'medium' | 'large';
  /** Whether to show the text input for hex values */
  showTextInput?: boolean;
  /** Placeholder text for the hex input field */
  textInputPlaceholder?: string;

  // Layout style
  /** Overall layout direction and spacing */
  layout?: 'horizontal' | 'vertical' | 'inline';

  // Size options
  /** Size of the color input element */
  colorInputSize?: 'small' | 'medium' | 'large';
}

/**
 * Unified Color Picker Component
 *
 * Flexible color picker component that replaces duplicate color selection patterns
 * throughout the DXF viewer. Supports multiple layouts, sizes, and input modes.
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <SharedColorPicker value="#ff0000" onChange={setColor} />
 *
 * // With preview and text input
 * <SharedColorPicker
 *   value={color}
 *   onChange={setColor}
 *   label="Line Color"
 *   showPreview={true}
 *   showTextInput={true}
 *   layout="horizontal"
 * />
 * ```
 *
 * Features:
 * - Multiple layout options (horizontal, vertical, inline)
 * - Configurable size options for preview and input
 * - Optional text input for hex values
 * - Color preview square
 * - Disabled state support
 *
 * Performance optimizations:
 * - React.memo prevents unnecessary re-renders
 * - useMemo for expensive class calculations
 * - useCallback for event handlers
 *
 * @since ΒΗΜΑ 8 του FloatingPanelContainer refactoring
 */
export const SharedColorPicker = React.memo<SharedColorPickerProps>(function SharedColorPicker({
  value,
  onChange,
  label,
  disabled = false,
  className = '',
  showPreview = true,
  previewSize = 'medium',
  showTextInput = false,
  textInputPlaceholder = '#ffffff',
  layout = 'horizontal',
  colorInputSize = 'medium'
}) {

  const handleColorChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleTextChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  // Preview size classes - memoized για performance
  const previewSizeClasses = React.useMemo(() => {
    switch (previewSize) {
      case 'small': return 'w-6 h-6';
      case 'medium': return 'w-10 h-8';
      case 'large': return 'w-12 h-12';
      default: return 'w-10 h-8';
    }
  }, [previewSize]);

  // Color input size classes - memoized για performance
  const colorInputSizeClasses = React.useMemo(() => {
    switch (colorInputSize) {
      case 'small': return 'w-8 h-6';
      case 'medium': return 'w-16 h-8';
      case 'large': return 'w-20 h-10';
      default: return 'w-16 h-8';
    }
  }, [colorInputSize]);

  // Layout classes - memoized για performance
  const layoutClasses = React.useMemo(() => {
    switch (layout) {
      case 'horizontal': return 'flex items-center space-x-3';
      case 'vertical': return 'flex flex-col space-y-2';
      case 'inline': return 'flex items-center space-x-2';
      default: return 'flex items-center space-x-3';
    }
  }, [layout]);

  const renderContent = React.useMemo(() => (
    <div className={layoutClasses}>
      {/* Color Preview */}
      {showPreview && (
        <div
          className={`${previewSizeClasses} rounded border border-gray-600`}
          style={{ backgroundColor: value }}
        />
      )}

      {/* Color Input */}
      <input
        type="color"
        value={value}
        onChange={handleColorChange}
        disabled={disabled}
        className={`${colorInputSizeClasses} bg-gray-700 border border-gray-600 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      />

      {/* Text Input */}
      {showTextInput && (
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder={textInputPlaceholder}
          className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        />
      )}
    </div>
  ), [layoutClasses, showPreview, previewSizeClasses, value, handleColorChange, disabled, colorInputSizeClasses, showTextInput, handleTextChange, textInputPlaceholder]);

  if (label) {
    return (
      <div className={`space-y-2 ${className}`}>
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
        {renderContent}
      </div>
    );
  }

  return (
    <div className={className}>
      {renderContent}
    </div>
  );
});