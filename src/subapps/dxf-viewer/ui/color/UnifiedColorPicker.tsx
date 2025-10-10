/**
 * 🎯 UNIFIED COLOR PICKER - Κεντρικοποιημένη Λύση
 *
 * @version 1.0.0
 * @description Κεντρικός color picker που αντικαθιστά όλα τα legacy διπλότυπα
 *
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Μία πηγή αλήθειας για όλα τα color picking needs
 * ✅ ENTERPRISE: Βασισμένο στο EnterpriseColorPicker με accessibility
 * ✅ FLEXIBLE: Υποστηρίζει όλα τα legacy patterns (inline, modal, simple)
 * ✅ BACKWARD COMPATIBLE: Drop-in replacement για όλα τα υπάρχοντα components
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-10
 */

import React, { useState, useCallback, useMemo } from 'react';
import { EnterpriseColorPicker } from './EnterpriseColorPicker';
import { EnterpriseColorDialog, ColorDialogTrigger } from './EnterpriseColorDialog';
import { EnterpriseColorField } from './EnterpriseColorField';
import type { ColorValue, PickerVariant } from './types';

// ============================================================================
// UNIFIED PROPS INTERFACE
// ============================================================================

/**
 * Unified props που καλύπτουν όλα τα legacy color picker patterns
 */
export interface UnifiedColorPickerProps {
  // ===== CORE PROPS =====
  /** Current color value (hex, rgb, hsl) */
  value: string;
  /** Callback when color changes */
  onChange: (color: string) => void;
  /** Optional label for the color picker */
  label?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;

  // ===== LAYOUT VARIANTS =====
  /**
   * Picker variant determines the UI pattern:
   * - 'inline': Simple color input with optional preview (replaces SharedColorPicker)
   * - 'modal': Color button that opens full picker in modal (replaces ColorPickerModal)
   * - 'popover': Color button that opens picker in popover
   * - 'full': Full picker displayed inline (replaces direct EnterpriseColorPicker)
   */
  variant?: 'inline' | 'modal' | 'popover' | 'full';

  // ===== INLINE VARIANT OPTIONS (για SharedColorPicker replacement) =====
  /** Show color preview square */
  showPreview?: boolean;
  /** Size of preview square */
  previewSize?: 'small' | 'medium' | 'large';
  /** Show hex text input */
  showTextInput?: boolean;
  /** Layout direction */
  layout?: 'horizontal' | 'vertical' | 'inline';
  /** Size of color input */
  colorInputSize?: 'small' | 'medium' | 'large';

  // ===== MODAL VARIANT OPTIONS (για ColorPickerModal replacement) =====
  /** Modal title */
  title?: string;
  /** Custom trigger button text */
  triggerText?: string;
  /** Show modal footer with apply/cancel */
  showModalFooter?: boolean;
  /** Callback when modal closes */
  onModalClose?: () => void;

  // ===== FULL PICKER OPTIONS =====
  /** Picker modes to show */
  modes?: Array<'hex' | 'rgb' | 'hsl'>;
  /** Show palette sections */
  showPalettes?: boolean;
  /** Show recent colors */
  showRecent?: boolean;
  /** Picker size */
  size?: 'compact' | 'standard' | 'large';
}

// ============================================================================
// INLINE VARIANT (SharedColorPicker replacement)
// ============================================================================

function InlineColorPicker({
  value,
  onChange,
  label,
  disabled = false,
  className = '',
  showPreview = true,
  previewSize = 'medium',
  showTextInput = false,
  layout = 'horizontal',
  colorInputSize = 'medium'
}: UnifiedColorPickerProps) {
  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  // Size classes
  const previewSizeClasses = useMemo(() => {
    switch (previewSize) {
      case 'small': return 'w-6 h-6';
      case 'medium': return 'w-10 h-8';
      case 'large': return 'w-12 h-12';
      default: return 'w-10 h-8';
    }
  }, [previewSize]);

  const colorInputSizeClasses = useMemo(() => {
    switch (colorInputSize) {
      case 'small': return 'w-8 h-6';
      case 'medium': return 'w-16 h-8';
      case 'large': return 'w-20 h-10';
      default: return 'w-16 h-8';
    }
  }, [colorInputSize]);

  const layoutClasses = useMemo(() => {
    switch (layout) {
      case 'horizontal': return 'flex items-center space-x-3';
      case 'vertical': return 'flex flex-col space-y-2';
      case 'inline': return 'flex items-center space-x-2';
      default: return 'flex items-center space-x-3';
    }
  }, [layout]);

  const content = (
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
          placeholder="#ffffff"
          className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        />
      )}
    </div>
  );

  if (label) {
    return (
      <div className={`space-y-2 ${className}`}>
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
        {content}
      </div>
    );
  }

  return <div className={className}>{content}</div>;
}

// ============================================================================
// MODAL VARIANT (ColorPickerModal replacement)
// ============================================================================

function ModalColorPicker({
  value,
  onChange,
  title = 'Επιλογή Χρώματος',
  triggerText,
  showModalFooter = true,
  onModalClose,
  disabled = false,
  modes = ['hex', 'rgb', 'hsl'],
  showPalettes = true,
  showRecent = true,
  size = 'standard'
}: UnifiedColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onModalClose?.();
  }, [onModalClose]);

  const trigger = (
    <ColorDialogTrigger
      value={value}
      disabled={disabled}
      className="inline-flex items-center space-x-2"
    >
      <div
        className="w-6 h-6 rounded border border-gray-600"
        style={{ backgroundColor: value }}
      />
      {triggerText && (
        <span className="text-sm text-gray-200">{triggerText}</span>
      )}
    </ColorDialogTrigger>
  );

  return (
    <EnterpriseColorDialog
      trigger={trigger}
      title={title}
      value={value}
      onChange={onChange}
      onClose={handleClose}
      showFooter={showModalFooter}
      modes={modes}
      showPalettes={showPalettes}
      showRecent={showRecent}
      size={size}
    />
  );
}

// ============================================================================
// FULL VARIANT (Direct EnterpriseColorPicker)
// ============================================================================

function FullColorPicker({
  value,
  onChange,
  modes = ['hex', 'rgb', 'hsl'],
  showPalettes = true,
  showRecent = true,
  size = 'standard'
}: UnifiedColorPickerProps) {
  return (
    <EnterpriseColorPicker
      value={value}
      onChange={onChange}
      modes={modes}
      showPalettes={showPalettes}
      showRecent={showRecent}
      size={size}
    />
  );
}

// ============================================================================
// MAIN UNIFIED COMPONENT
// ============================================================================

/**
 * Unified Color Picker - Κεντρικοποιημένη λύση για όλα τα color picking needs
 *
 * @example
 * ```tsx
 * // Inline picker (replaces SharedColorPicker)
 * <UnifiedColorPicker
 *   variant="inline"
 *   value={color}
 *   onChange={setColor}
 *   label="Line Color"
 *   showPreview={true}
 *   showTextInput={true}
 * />
 *
 * // Modal picker (replaces ColorPickerModal)
 * <UnifiedColorPicker
 *   variant="modal"
 *   value={color}
 *   onChange={setColor}
 *   title="🎨 Επιλογή Χρώματος"
 *   triggerText="Change Color"
 * />
 *
 * // Full picker (replaces direct EnterpriseColorPicker)
 * <UnifiedColorPicker
 *   variant="full"
 *   value={color}
 *   onChange={setColor}
 *   showPalettes={true}
 *   showRecent={true}
 * />
 * ```
 */
export function UnifiedColorPicker(props: UnifiedColorPickerProps) {
  const { variant = 'inline' } = props;

  switch (variant) {
    case 'inline':
      return <InlineColorPicker {...props} />;

    case 'modal':
    case 'popover': // For now, popover behaves like modal
      return <ModalColorPicker {...props} />;

    case 'full':
      return <FullColorPicker {...props} />;

    default:
      return <InlineColorPicker {...props} />;
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Drop-in replacement για SharedColorPicker
 */
export function SharedColorPicker(props: Omit<UnifiedColorPickerProps, 'variant'>) {
  return <UnifiedColorPicker {...props} variant="inline" />;
}

/**
 * Drop-in replacement για ColorPickerModal
 */
export interface ColorPickerModalProps {
  title?: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
  initialColor?: string;
}

export function ColorPickerModal({
  title,
  onColorSelect,
  onClose,
  initialColor = '#ff0000'
}: ColorPickerModalProps) {
  const [tempColor, setTempColor] = useState(initialColor);

  const handleChange = useCallback((color: string) => {
    setTempColor(color);
    onColorSelect(color);
  }, [onColorSelect]);

  return (
    <UnifiedColorPicker
      variant="modal"
      value={tempColor}
      onChange={handleChange}
      title={title}
      onModalClose={onClose}
    />
  );
}

/**
 * Simple inline color picker function (για CursorSettingsPanel replacement)
 */
export interface SimpleColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function SimpleColorPicker({ label, value, onChange, disabled = false }: SimpleColorPickerProps) {
  return (
    <UnifiedColorPicker
      variant="inline"
      value={value}
      onChange={onChange}
      label={label}
      disabled={disabled}
      showPreview={true}
      layout="horizontal"
    />
  );
}