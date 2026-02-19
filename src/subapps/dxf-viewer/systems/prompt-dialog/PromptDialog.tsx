/**
 * @module systems/prompt-dialog/PromptDialog
 * @description Centralized numeric/text input dialog overlay for the DXF Viewer.
 *
 * Rendered once in the canvas tree. Subscribes to `PromptDialogStore` via
 * `usePromptDialog()` and shows a focused input overlay when `store.prompt()`
 * is called from any hook.
 *
 * Features:
 * - Enter to confirm, Escape to cancel
 * - Auto-focus + auto-select input on open
 * - Numeric validation (comma → dot conversion)
 * - Unit suffix display (mm, °, m)
 * - Error message from custom `validate` function
 * - Smooth fade-in / scale entrance animation
 * - Dark-theme compatible via centralized design tokens
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-20
 */

'use client';

import React, { useRef, useState, useEffect, useCallback, type KeyboardEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { usePromptDialog } from './usePromptDialog';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Centralized prompt dialog — render once at the top of the DXF viewer tree.
 *
 * Usage:
 * ```tsx
 * // In CanvasSection or DxfViewerContent:
 * <PromptDialog />
 * ```
 */
export const PromptDialog: React.FC = () => {
  const { snapshot, confirm, cancel } = usePromptDialog();
  const { t } = useTranslation('dxf-viewer');
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();

  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Animation state: 'closed' → 'entering' → 'open'
  const [animState, setAnimState] = useState<'closed' | 'entering' | 'open'>('closed');

  const { isOpen, options } = snapshot;

  // Animate in when dialog opens
  useEffect(() => {
    if (isOpen && options) {
      setValue(options.defaultValue ?? '');
      setError(null);
      // Start animation: mount with initial state, then transition
      setAnimState('entering');
      const raf = requestAnimationFrame(() => {
        // Trigger CSS transition by moving to 'open' state
        setAnimState('open');
        // Focus input after transition starts
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
      return () => cancelAnimationFrame(raf);
    }
    setAnimState('closed');
    return undefined;
  }, [isOpen, options]);

  // Normalize input: comma → dot for numeric fields
  const normalizeValue = useCallback((raw: string): string => {
    if (options?.inputType === 'number') {
      return raw.replace(',', '.');
    }
    return raw;
  }, [options?.inputType]);

  const handleConfirm = useCallback(() => {
    const normalized = normalizeValue(value);

    // Numeric validation
    if (options?.inputType === 'number') {
      const parsed = parseFloat(normalized);
      if (isNaN(parsed)) {
        setError(t('promptDialog.invalidNumber'));
        return;
      }
    }

    // Custom validation
    if (options?.validate) {
      const validationError = options.validate(normalized);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    confirm(normalized);
  }, [value, normalizeValue, options, confirm, t]);

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleConfirm, handleCancel]);

  const handleInputChange = useCallback((e: FormEvent<HTMLInputElement>) => {
    const newVal = (e.target as HTMLInputElement).value;
    setValue(newVal);
    // Clear error on edit
    if (error) setError(null);
  }, [error]);

  // Backdrop click → cancel
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }, [handleCancel]);

  if (!isOpen || !options || typeof window === 'undefined') return null;

  const confirmLabel = options.confirmText ?? t('promptDialog.confirm');
  const cancelLabel = options.cancelText ?? t('promptDialog.cancel');

  // Animation CSS: backdrop fades in, dialog scales + fades
  const isVisible = animState === 'open';

  const dialogContent = (
    <>
      {/* Backdrop — fade in */}
      <div
        className={`fixed inset-0 ${colors.bg.modalBackdrop} transition-opacity duration-200 ease-out`}
        style={{
          zIndex: 10000,
          opacity: isVisible ? 1 : 0,
        }}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Dialog container */}
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 10001 }}
        onClick={handleBackdropClick}
      >
        {/* Dialog box — scale + fade in */}
        <div
          className={`
            w-80 max-w-[90vw]
            ${colors.bg.accent}
            ${getStatusBorder('muted')}
            ${PANEL_LAYOUT.ROUNDED.LG}
            ${PANEL_LAYOUT.SHADOW['2XL']}
            transition-all duration-200 ease-out
          `}
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-8px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-dialog-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.STANDARD} ${colors.border.primary} border-b`}>
            <h3
              id="prompt-dialog-title"
              className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} text-sm`}
            >
              {options.title}
            </h3>
            <button
              type="button"
              onClick={handleCancel}
              className={`${colors.text.muted} hover:${colors.text.primary} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.ROUNDED.MD} ${PANEL_LAYOUT.SPACING.XS}`}
              aria-label={cancelLabel}
            >
              <X size={16} />
            </button>
          </header>

          {/* Body */}
          <div className={PANEL_LAYOUT.SPACING.LG}>
            <label
              htmlFor="prompt-dialog-input"
              className={`block text-xs ${colors.text.secondary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}
            >
              {options.label}
            </label>

            <div className="flex items-center">
              <input
                ref={inputRef}
                id="prompt-dialog-input"
                type="text"
                inputMode={options.inputType === 'number' ? 'decimal' : 'text'}
                value={value}
                onInput={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={options.placeholder ?? ''}
                autoComplete="off"
                className={`
                  flex-1 ${PANEL_LAYOUT.SPACING.COMPACT}
                  ${colors.bg.primary} ${colors.text.primary}
                  ${getStatusBorder(error ? 'error' : 'default')}
                  ${PANEL_LAYOUT.ROUNDED.MD}
                  text-sm outline-none
                  focus:ring-1 focus:ring-blue-500
                `}
              />
              {options.unit && (
                <span className={`ml-2 text-xs ${colors.text.muted} select-none`}>
                  {options.unit}
                </span>
              )}
            </div>

            {/* Error message */}
            {error && (
              <p className={`mt-1 text-xs ${colors.text.error}`}>
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <footer className={`flex justify-end ${PANEL_LAYOUT.SPACING.GAP_H_SM} ${PANEL_LAYOUT.SPACING.STANDARD} ${colors.border.primary} border-t`}>
            <button
              type="button"
              onClick={handleCancel}
              className={`
                ${PANEL_LAYOUT.SPACING.COMPACT} text-xs
                ${colors.text.secondary} ${colors.bg.hover}
                ${PANEL_LAYOUT.ROUNDED.MD} ${PANEL_LAYOUT.TRANSITION.COLORS}
                hover:${colors.text.primary}
              `}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`
                flex items-center ${PANEL_LAYOUT.GAP.XS}
                ${PANEL_LAYOUT.SPACING.COMPACT} text-xs
                text-white bg-blue-600 hover:bg-blue-700
                ${PANEL_LAYOUT.ROUNDED.MD} ${PANEL_LAYOUT.TRANSITION.COLORS}
              `}
            >
              <Check size={14} />
              {confirmLabel}
            </button>
          </footer>
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
};
