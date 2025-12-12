/**
 * 🏢 ENTERPRISE COLOR DIALOG
 *
 * @version 1.0.0
 * @description Modal dialog wrapper for color picker with focus trap
 *
 * Features:
 * - React Aria overlay hooks
 * - Focus trap
 * - Escape to close
 * - Backdrop click to close
 * - ARIA compliant
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

'use client';

import React, { useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '@react-aria/dialog';
import { useOverlay, usePreventScroll } from '@react-aria/overlays';
import { FocusScope } from '@react-aria/focus';
import { EnterpriseColorPicker } from './EnterpriseColorPicker';
import type { EnterpriseColorDialogProps } from './types';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

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
  value,
  onChange,
  onChangeEnd,
  ...pickerProps
}: EnterpriseColorDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [tempValue, setTempValue] = React.useState(value);

  // Update temp value when external value changes
  React.useEffect(() => {
    if (isOpen) {
      setTempValue(value);
    }
  }, [value, isOpen]);

  // Handle apply
  const handleApply = useCallback(() => {
    onChange(tempValue);
    onChangeEnd?.(tempValue);
    onClose();
  }, [tempValue, onChange, onChangeEnd, onClose]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setTempValue(value); // Reset to original
    onClose();
  }, [value, onClose]);

  // Overlay props (backdrop + escape)
  const { overlayProps, underlayProps } = useOverlay(
    {
      isOpen,
      onClose: handleCancel,
      isDismissable: true,
      shouldCloseOnBlur: false,
    },
    overlayRef
  );

  // Dialog props (ARIA)
  const { dialogProps, titleProps } = useDialog({}, overlayRef);

  // Prevent scrolling when modal is open
  usePreventScroll({ isDisabled: !isOpen });

  if (!isOpen) return null;

  // Render via portal
  return typeof window !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          {/* Backdrop */}
          <div
            {...underlayProps}
            className="absolute inset-0 bg-black bg-opacity-50"
          />

          {/* Dialog */}
          <FocusScope contain restoreFocus autoFocus>
            <div
              {...overlayProps}
              {...dialogProps}
              ref={overlayRef}
              className="relative z-[9999] bg-gray-900 border-2 border-gray-600 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto"
              style={{
                maxWidth: '400px',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2
                  {...titleProps}
                  className="text-lg font-medium text-white"
                >
                  {title}
                </h2>
                <button
                  onClick={handleCancel}
                  className={`text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HOVER} transition-colors`}
                  aria-label="Close"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M15 5L5 15M5 5L15 15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-0">
                <EnterpriseColorPicker
                  {...pickerProps}
                  value={tempValue}
                  onChange={setTempValue}
                  className="border-0"
                />
              </div>

              {/* Footer */}
              {showFooter && (
                <div className="flex gap-2 p-4 border-t border-gray-700">
                  <button
                    onClick={handleCancel}
                    className={`flex-1 px-4 py-2 bg-gray-800 ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} text-white rounded transition-colors`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    className={`flex-1 px-4 py-2 bg-blue-600 ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} text-white rounded transition-colors`}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </FocusScope>
        </div>,
        document.body
      )
    : null;
}

/**
 * Trigger button for color dialog
 */
export function ColorDialogTrigger({
  value,
  onChange,
  disabled = false,
  label = 'Choose Color',
  ...dialogProps
}: Omit<EnterpriseColorDialogProps, 'isOpen' | 'onClose'> & {
  label?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={`
          flex items-center gap-3 px-4 py-2 bg-gray-800 ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER}
          border border-gray-600 rounded transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        <div
          className="w-6 h-6 rounded border-2 border-gray-600"
          style={{ backgroundColor: value }}
        />
        <span className="text-sm text-gray-300">{label}</span>
      </button>

      <EnterpriseColorDialog
        {...dialogProps}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        value={value}
        onChange={onChange}
      />
    </>
  );
}
