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

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '@react-aria/dialog';
import { useOverlay, usePreventScroll } from '@react-aria/overlays';
import { FocusScope } from '@react-aria/focus';
import { EnterpriseColorPicker } from './EnterpriseColorPicker';
import type { EnterpriseColorDialogProps } from './types';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';

// ✅ ENTERPRISE: Custom hook για draggable functionality
function useDraggable(initialPosition = { x: 0, y: 0 }) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  // ✅ FIX: Store initial position in ref to avoid recreating resetPosition
  const initialPositionRef = useRef(initialPosition);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from header area (check if target or parent has data-drag-handle)
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle]')) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // ✅ FIX: Stable resetPosition function using useCallback
  const resetPosition = useCallback(() => {
    setPosition(initialPositionRef.current);
  }, []);

  return { position, isDragging, handleMouseDown, resetPosition };
}

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
  // ✅ FIX: Store original value for Cancel functionality
  const [originalValue, setOriginalValue] = React.useState(value);
  const { quick, getStatusBorder, getDirectionalBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();

  // ✅ ENTERPRISE: Draggable functionality
  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable({ x: 0, y: 0 });

  // ✅ FIX: Store original value when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setOriginalValue(value);
      resetPosition(); // Reset position when reopening
    }
  }, [isOpen, resetPosition]); // ✅ FIX: Remove value from deps to avoid loop

  // ✅ ENTERPRISE: Stop propagation και prevent default για να μην περνάνε τα events στον canvas
  const handleContainerEvents = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  // ✅ ENTERPRISE: Handle events that should NOT prevent default (like color selection)
  const handleDialogEvents = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    // Don't prevent default - allow clicks inside dialog
  }, []);

  // ✅ FIX: Handle live color change (updates preview immediately)
  const handleColorChange = useCallback((newColor: string) => {
    onChange(newColor); // Update immediately for live preview
  }, [onChange]);

  // Handle apply (just close, color is already applied)
  const handleApply = useCallback(() => {
    onChangeEnd?.(value);
    onClose();
  }, [value, onChangeEnd, onClose]);

  // Handle cancel - restore original color
  const handleCancel = useCallback(() => {
    onChange(originalValue); // Restore original color
    onClose();
  }, [originalValue, onChange, onClose]);

  // Overlay props (backdrop + escape)
  // ✅ FIX: isDismissable: false - το dialog κλείνει ΜΟΝΟ με το X button ή Cancel
  const { overlayProps } = useOverlay(
    {
      isOpen,
      onClose: handleCancel,
      isDismissable: false, // ✅ FIX: Δεν κλείνει με κλικ εκτός
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
  // ✅ FIX: Use maximum z-index (2147483647) to be above canvas crosshair overlays
  return typeof window !== 'undefined'
    ? createPortal(
        <div
          className={`fixed ${PANEL_LAYOUT.INSET['0']} flex items-center justify-center`}
          style={{
            zIndex: 2147483646, // Just below max to allow stacking
            cursor: 'default',
            pointerEvents: 'none' // ✅ FIX: Container doesn't capture events, only dialog does
          }}
        >
          {/* Backdrop - ✅ FIX: No click handlers, just visual overlay */}
          <div
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${colors.bg.modalBackdrop}`}
            style={{ pointerEvents: 'none' }}
          />

          {/* Dialog - ✅ ENTERPRISE: Draggable + Cursor fix + Max z-index */}
          <FocusScope contain restoreFocus autoFocus>
            <div
              {...overlayProps}
              {...dialogProps}
              ref={overlayRef}
              onMouseDown={(e) => {
                handleMouseDown(e);
                handleDialogEvents(e);
              }}
              onClick={handleDialogEvents}
              onPointerDown={handleDialogEvents}
              onMouseMove={handleDialogEvents}
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                cursor: isDragging ? 'grabbing' : 'default',
                zIndex: 2147483647, // Maximum z-index - above everything
                pointerEvents: 'auto',
                isolation: 'isolate' // Create new stacking context
              }}
              className={`relative ${colors.bg.accent} ${getStatusBorder('default')} ${quick.card} ${PANEL_LAYOUT.SHADOW['2XL']} ${PANEL_LAYOUT.LAYOUT_DIMENSIONS.MODAL_MAX_HEIGHT} ${PANEL_LAYOUT.OVERFLOW.Y_AUTO} ${PANEL_LAYOUT.LAYOUT_DIMENSIONS.PANEL_MAX_WIDTH_LG} ${PANEL_LAYOUT.SELECT.NONE}`}
            >
              {/* Header - ✅ ENTERPRISE: Draggable handle */}
              <div
                data-drag-handle
                className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.LG} ${getDirectionalBorder('muted', 'bottom')} ${PANEL_LAYOUT.CURSOR.GRAB} active:${PANEL_LAYOUT.CURSOR.GRABBING}`}
              >
                <h2
                  {...titleProps}
                  className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
                >
                  {title}
                </h2>
                <button
                  onClick={handleCancel}
                  className={`${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.CURSOR.POINTER}`}
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

              {/* Content - ✅ FIX: Ensure pointer events work */}
              <div className={PANEL_LAYOUT.SPACING.NONE} style={{ cursor: 'default', pointerEvents: 'auto' }}>
                <EnterpriseColorPicker
                  {...pickerProps}
                  value={value}
                  onChange={handleColorChange}
                  className="border-0"
                />
              </div>

              {/* Footer */}
              {showFooter && (
                <div className={`flex ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.SPACING.LG} ${getDirectionalBorder('muted', 'top')}`}>
                  <button
                    onClick={handleCancel}
                    className={`flex-1 ${PANEL_LAYOUT.BUTTON.PADDING_LG} ${colors.bg.secondary} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${colors.text.inverted} rounded ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.CURSOR.POINTER}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    className={`flex-1 ${PANEL_LAYOUT.BUTTON.PADDING_LG} ${colors.bg.primary} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} ${colors.text.primary} rounded ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.CURSOR.POINTER}`}
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
  children,
  onDialogClose,
  ...dialogProps
}: Omit<EnterpriseColorDialogProps, 'isOpen' | 'onClose'> & {
  label?: string;
  children?: React.ReactNode;
  onDialogClose?: () => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { quick, getStatusBorder, radius } = useBorderTokens();
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
          flex items-center ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.BUTTON.PADDING_LG} ${colors.bg.secondary} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER}
          ${colors.text.inverted} ${quick.button} ${getStatusBorder('default')} ${PANEL_LAYOUT.TRANSITION.COLORS}
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
