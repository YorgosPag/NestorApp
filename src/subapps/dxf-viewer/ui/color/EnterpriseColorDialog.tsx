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

import React, { useRef, useCallback, useState, useEffect, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
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
// 🏢 ENTERPRISE: Centralized z-index values
import { MODAL_Z_INDEX } from '../../config/modal-config';

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
  const { t } = useTranslation('dxf-viewer-panels');
  // Local color state: updates immediately for responsive UI
  const [localColor, setLocalColor] = useState(value);
  const [originalValue, setOriginalValue] = React.useState(value);
  // RAF throttle: limits external onChange to 1 call per animation frame
  const rafRef = useRef<number | null>(null);
  const pendingColorRef = useRef<string>(value);
  const { quick, getStatusBorder, getDirectionalBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();

  // ✅ ENTERPRISE: Draggable functionality
  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable({ x: 0, y: 0 });

  // Sync local state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalColor(value);
      setOriginalValue(value);
      resetPosition();
    }
  }, [isOpen, resetPosition]); // value intentionally excluded: only sync on open

  // Cleanup pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
          className={`fixed ${PANEL_LAYOUT.INSET['0']} flex items-center justify-center cursor-default pointer-events-none`}
          style={{ zIndex: MODAL_Z_INDEX.COLOR_DIALOG_CONTAINER }}
        >
          {/* Backdrop - ✅ FIX: No click handlers, just visual overlay */}
          <div
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${colors.bg.modalBackdrop} pointer-events-none`}
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
                zIndex: MODAL_Z_INDEX.COLOR_DIALOG,
              }}
              className={`relative pointer-events-auto isolate ${colors.bg.accent} ${getStatusBorder('default')} ${quick.card} ${PANEL_LAYOUT.SHADOW['2XL']} ${PANEL_LAYOUT.LAYOUT_DIMENSIONS.MODAL_MAX_HEIGHT} ${PANEL_LAYOUT.OVERFLOW.Y_AUTO} ${PANEL_LAYOUT.LAYOUT_DIMENSIONS.PANEL_MAX_WIDTH_LG} ${PANEL_LAYOUT.SELECT.NONE}`}
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
              <div className={`${PANEL_LAYOUT.SPACING.NONE} cursor-default pointer-events-auto`}>
                <EnterpriseColorPicker
                  {...pickerProps}
                  value={localColor}
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
                    {t('colorPicker.cancel')}
                  </button>
                  <button
                    onClick={handleApply}
                    className={`flex-1 ${PANEL_LAYOUT.BUTTON.PADDING_LG} ${colors.bg.primary} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} ${colors.text.primary} rounded ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.CURSOR.POINTER}`}
                  >
                    {t('colorPicker.apply')}
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
