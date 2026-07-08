/**
 * 🏢 ENTERPRISE COLOR DIALOG
 *
 * @version 2.0.0
 * @description Modal dialog wrapper για hex color picker (Ρυθμίσεις DXF).
 *   Το floating κέλυφος (portal + draggable + focus-trap + backdrop + header/X)
 *   ζει πλέον στο SSoT `ColorDialogShell` — κοινό με τον text-editor picker
 *   (`ColorPickerPopover`). Εδώ μένει μόνο η hex-specific λογική: local color
 *   state, RAF throttle, Apply/Cancel footer. Public API αμετάβλητο.
 *
 * Features:
 * - React Aria overlay hooks (via ColorDialogShell)
 * - Focus trap / Escape to close / Draggable header (via ColorDialogShell)
 * - RAF-throttled live onChange + Apply/Cancel commit
 * - ARIA compliant
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { EnterpriseColorPicker } from './EnterpriseColorPicker';
import { ColorDialogShell } from './ColorDialogShell';
import type { EnterpriseColorDialogProps } from './types';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';

/**
 * Enterprise Color Dialog Component
 *
 * @example
 * ```tsx
 * <EnterpriseColorDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   value={color}
 *   onChange={setColor}
 *   title="Choose a color"
 *   showFooter={true}
 * />
 * ```
 */
export function EnterpriseColorDialog({
  isOpen,
  onClose,
  title = 'Color Picker',
  showFooter = true,
  // Χωρίς σκοτεινό πέπλο (backdrop) by default — ο Giorgio θέλει το σχέδιο πλήρως
  // ορατό κατά την επιλογή χρώματος (live WYSIWYG σύγκριση), όπως ήδη κάνουν οι
  // ribbon/text pickers. Callers μπορούν να ζητήσουν `dimBackdrop` ρητά αν χρειαστεί.
  dimBackdrop = false,
  value,
  onChange,
  onChangeEnd,
  ...pickerProps
}: EnterpriseColorDialogProps) {
  // Local color state: updates immediately for responsive UI
  const [localColor, setLocalColor] = useState(value);
  const [originalValue, setOriginalValue] = useState(value);
  // RAF throttle: limits external onChange to 1 call per animation frame
  const rafRef = useRef<number | null>(null);
  const pendingColorRef = useRef<string>(value);

  // Color dialogs default to the horizontal (two-column) layout — wider, no
  // scroll. Callers can still force vertical via `orientation="vertical"`.
  const effectiveOrientation = pickerProps.orientation ?? 'horizontal';
  const dialogMaxWidth =
    effectiveOrientation === 'horizontal'
      ? PANEL_LAYOUT.LAYOUT_DIMENSIONS.PANEL_MAX_WIDTH_XL
      : PANEL_LAYOUT.LAYOUT_DIMENSIONS.PANEL_MAX_WIDTH_LG;

  // Sync local state when the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setLocalColor(value);
      setOriginalValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when dialog opens
  }, [isOpen]);

  // Cleanup pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Local state updates immediately; external onChange throttled to 1 per RAF frame
  const handleColorChange = useCallback((newColor: string) => {
    setLocalColor(newColor);
    pendingColorRef.current = newColor;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      onChange(pendingColorRef.current);
      rafRef.current = null;
    });
  }, [onChange]);

  // Handle apply
  const handleApply = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onChange(localColor);
    onChangeEnd?.(localColor);
    onClose();
  }, [localColor, onChange, onChangeEnd, onClose]);

  // Handle cancel - restore original color
  const handleCancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onChange(originalValue);
    onClose();
  }, [originalValue, onChange, onClose]);

  return (
    <ColorDialogShell
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      dimBackdrop={dimBackdrop}
      maxWidthClass={dialogMaxWidth}
      showFooter={showFooter}
      onCancel={handleCancel}
      onApply={handleApply}
    >
      <EnterpriseColorPicker
        {...pickerProps}
        orientation={effectiveOrientation}
        value={localColor}
        onChange={handleColorChange}
        className="border-0"
      />
    </ColorDialogShell>
  );
}

/**
 * Trigger button for color dialog
 */
export function ColorDialogTrigger({
  value,
  onChange,
  disabled = false,
  label = 'Choose Color',
  children,
  onDialogClose,
  ...dialogProps
}: Omit<EnterpriseColorDialogProps, 'isOpen' | 'onClose'> & {
  label?: string;
  children?: React.ReactNode;
  onDialogClose?: () => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { quick, getStatusBorder, radius, radiusClass } = useBorderTokens();
  const colors = useSemanticColors();
  // 🔧 FIX: Hook must be called at top-level, not inside JSX
  const dynamicBgClass = useDynamicBackgroundClass(value);
  const handleClose = useCallback(() => {
    setIsOpen(false);
    onDialogClose?.();
  }, [onDialogClose]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={`
          flex items-center ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER}
          ${colors.text.inverted} ${quick.button} ${radiusClass.sm} ${getStatusBorder('default')} ${PANEL_LAYOUT.TRANSITION.COLORS}
          disabled:${PANEL_LAYOUT.OPACITY['50']} disabled:${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}
        `}
      >
        {children ?? (
          <>
            <div
              className={`${PANEL_LAYOUT.ICON.SWATCH} ${radius.md} ${getStatusBorder('default')} ${dynamicBgClass}`}
            />
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.secondary}`}>{label}</span>
          </>
        )}
      </button>

      <EnterpriseColorDialog
        {...dialogProps}
        isOpen={isOpen}
        onClose={handleClose}
        value={value}
        onChange={onChange}
      />
    </>
  );
}
