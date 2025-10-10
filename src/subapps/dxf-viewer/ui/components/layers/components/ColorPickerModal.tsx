/**
 * 🔄 LEGACY REDIRECT - ColorPickerModal
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

'use client';

import React from 'react';
import { ColorPickerModal as CentralizedColorPickerModal } from '../../../color';

/**
 * Legacy props interface - maintained for backward compatibility
 */
export interface ColorPickerModalProps {
  title: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
  /** Initial color value */
  initialColor?: string;
}

/**
 * ColorPickerModal - Now powered by Enterprise Color System
 *
 * @deprecated Use UnifiedColorPicker with variant="modal" for new code
 * @example
 * ```tsx
 * // Legacy usage (still works)
 * import { ColorPickerModal } from './components/ColorPickerModal';
 *
 * // Preferred modern usage
 * import { UnifiedColorPicker } from '../../../color';
 * <UnifiedColorPicker variant="modal" ... />
 * ```
 */
export const ColorPickerModal = CentralizedColorPickerModal;