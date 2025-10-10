/**
 * 🔄 LEGACY REDIRECT - SharedColorPicker
 *
 * @deprecated This file is now a redirect to the centralized UnifiedColorPicker
 * @see ../../../color/UnifiedColorPicker.tsx for the centralized implementation
 *
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: All color picker functionality is now centralized
 * ✅ BACKWARD COMPATIBLE: Existing imports continue to work
 * ✅ ENTERPRISE: Uses the Enterprise Color System under the hood
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-10 (Centralization)
 */

// ============================================================================
// CENTRALIZED IMPORT
// ============================================================================

import {
  SharedColorPicker as CentralizedSharedColorPicker,
  type UnifiedColorPickerProps
} from '../../color';

// ============================================================================
// TYPE COMPATIBILITY
// ============================================================================

/**
 * Legacy props interface - maintained for backward compatibility
 */
export interface SharedColorPickerProps {
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

// ============================================================================
// CENTRALIZED EXPORT
// ============================================================================

/**
 * SharedColorPicker - Now powered by Enterprise Color System
 *
 * @deprecated Use UnifiedColorPicker directly for new code
 * @example
 * ```tsx
 * // Legacy usage (still works)
 * import { SharedColorPicker } from './shared/SharedColorPicker';
 *
 * // Preferred modern usage
 * import { UnifiedColorPicker } from '../../color';
 * <UnifiedColorPicker variant="inline" ... />
 * ```
 */
export const SharedColorPicker = CentralizedSharedColorPicker;

// Re-export everything else from the centralized system for convenience
export {
  UnifiedColorPicker,
  ColorPickerModal,
  SimpleColorPicker,
  type UnifiedColorPickerProps,
  type ColorPickerModalProps,
  type SimpleColorPickerProps,
} from '../../color';