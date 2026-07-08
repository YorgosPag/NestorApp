'use client';

/**
 * 🏢 ENTERPRISE COLOR DIALOG SHELL — SSoT floating κέλυφος για ΚΑΘΕ color picker.
 *
 * @description Το κοινό floating modal κέλυφος (portal + draggable + focus-trap +
 *   backdrop + header/X) που μοιράζονται:
 *   - `EnterpriseColorDialog` (Ρυθμίσεις DXF — hex picker + Apply/Cancel footer)
 *   - `ColorPickerPopover` (Contextual Tab «Επεξεργαστής Κειμένου» — True/ACI/ByLayer tabs)
 *
 *   Πριν την εξαγωγή, το text picker χρησιμοποιούσε Radix `Popover` (αγκιστρωμένο →
 *   κοβόταν από τη βάση της οθόνης). Τώρα και τα δύο ανοίγουν στο ΙΔΙΟ floating,
 *   draggable, μαζεμένο κέλυφος — μία και μοναδική πηγή αλήθειας (ADR-344 / ADR-001 / N.12).
 *
 * Το shell είναι αμιγώς παρουσιαστικό/interaction: ΔΕΝ γνωρίζει τίποτα για colour
 * state (hex/DxfColor). Οι callers δίνουν `children` (περιεχόμενο) + προαιρετικό
 * `footer` και χειρίζονται μόνοι τους το colour state.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2026-07-08
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useDialog } from '@react-aria/dialog';
import { useOverlay, usePreventScroll } from '@react-aria/overlays';
import { FocusScope } from '@react-aria/focus';
// 🏢 SSoT: centralized draggable hook (same one FloatingPanel uses) — ADR-001/N.12
import { useDraggable } from '@/hooks/useDraggable';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: Centralized z-index values
import { MODAL_Z_INDEX } from '../../config/modal-config';

/**
 * Τελευταία θέση που έσυρε ο χρήστης οποιοδήποτε color dialog — κοινή (module-level)
 * ώστε ΚΑΘΕ picker (ρυθμίσεις Ή κείμενο) να ανοίγει εκεί που το άφησες, όχι ξανά στο
 * κέντρο (persist ανά app-session). In-memory by design· δεν επιβιώνει reload.
 */
let lastDialogPosition: { x: number; y: number } | null = null;

export interface ColorDialogShellProps {
  /** Dialog open state */
  readonly isOpen: boolean;
  /** Close callback (X button + Escape) */
  readonly onClose: () => void;
  /** Dialog title (header) */
  readonly title?: string;
  /**
   * Dim/blur the backdrop behind the dialog (default: true).
   * Set `false` για canvas color pickers ώστε το σχέδιο να μένει πλήρως ορατό
   * κατά την επιλογή χρώματος — live WYSIWYG σύγκριση.
   */
  readonly dimBackdrop?: boolean;
  /** Container max-width utility class (caller-computed ανά orientation/περιεχόμενο). */
  readonly maxWidthClass?: string;
  /** Το περιεχόμενο του dialog (picker / tabs). */
  readonly children: React.ReactNode;
  /**
   * Εμφάνιση του κοινού footer «Ακύρωση / Εφαρμογή» (default: false).
   * SSoT footer — ίδιο markup + i18n keys (`dxf-viewer-panels:colorPicker.*`) για
   * ΚΑΘΕ color picker (ρυθμίσεις + κείμενο). Απαιτεί `onCancel` + `onApply`.
   */
  readonly showFooter?: boolean;
  /** Handler του κουμπιού «Ακύρωση» (και του X/Escape μέσω `onClose`). */
  readonly onCancel?: () => void;
  /** Handler του κουμπιού «Εφαρμογή». */
  readonly onApply?: () => void;
}

/**
 * SSoT floating shell — portal, draggable header, focus trap, ARIA dialog, backdrop.
 */
export function ColorDialogShell({
  isOpen,
  onClose,
  title = 'Color Picker',
  dimBackdrop = true,
  maxWidthClass = '',
  children,
  showFooter = false,
  onCancel,
  onApply,
}: ColorDialogShellProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('dxf-viewer-panels');
  const { quick, getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // ✅ ENTERPRISE: Draggable — centralized SSoT hook (same one FloatingPanel uses).
  // Offset-based: το dialog είναι flex-centered και το `position` είναι translate offset,
  // οπότε τα bounds μένουν unconstrained (το header ξεκινά κεντραρισμένο). ADR-001 / N.12.
  const { position, isDragging, handleMouseDown, setPosition } = useDraggable(isOpen, {
    initialPosition: { x: 0, y: 0 },
    autoCenter: false,
    minPosition: { x: -100000, y: -100000 },
    maxPosition: { x: 100000, y: 100000 },
  });

  // Recenter (ή τελευταία θέση) όταν ανοίγει το dialog.
  // ⚠️ deps = [isOpen] ONLY: `setPosition` του useDraggable είναι fresh function κάθε
  // render (μη-memoized)· η συμπερίληψή του θα προκαλούσε infinite loop.
  useEffect(() => {
    if (isOpen) {
      setPosition(lastDialogPosition ?? { x: 0, y: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when dialog opens
  }, [isOpen]);

  // Θυμήσου τη θέση όσο το dialog είναι ανοιχτό → η επόμενη εμφάνιση οποιουδήποτε
  // color picker (ρυθμίσεις Ή κείμενο) ανοίγει εκεί.
  useEffect(() => {
    if (isOpen) lastDialogPosition = position;
  }, [isOpen, position]);

  // ✅ ENTERPRISE: stopPropagation ώστε τα events να μην περνάνε στον canvas.
  const handleDialogEvents = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    // Don't prevent default — allow clicks inside dialog (color selection).
  }, []);

  // Overlay props (backdrop + escape). isDismissable: false → κλείνει ΜΟΝΟ με X/Escape.
  const { overlayProps } = useOverlay(
    {
      isOpen,
      onClose,
      isDismissable: false,
      shouldCloseOnBlur: false,
    },
    overlayRef,
  );

  // Dialog props (ARIA)
  const { dialogProps, titleProps } = useDialog({}, overlayRef);

  // Prevent scrolling while the modal is open
  usePreventScroll({ isDisabled: !isOpen });

  if (!isOpen) return null;

  // Render via portal — max z-index ώστε να είναι πάνω από canvas crosshair overlays.
  return typeof window !== 'undefined'
    ? createPortal(
        <div
          className={`fixed ${PANEL_LAYOUT.INSET['0']} flex items-center justify-center cursor-default pointer-events-none`}
          style={{ zIndex: MODAL_Z_INDEX.COLOR_DIALOG_CONTAINER }}
        >
          {/* Backdrop — visual dim only (no click handlers). Skipped όταν
              `dimBackdrop === false` (canvas color pickers) για live σύγκριση. */}
          {dimBackdrop && (
            <div
              className={`absolute ${PANEL_LAYOUT.INSET['0']} ${colors.bg.modalBackdrop} pointer-events-none`}
            />
          )}

          {/* Dialog — ✅ ENTERPRISE: Draggable + Cursor fix + Max z-index */}
          <FocusScope contain restoreFocus autoFocus>
            <div
              {...overlayProps}
              {...dialogProps}
              ref={overlayRef}
              onMouseDown={handleDialogEvents}
              onClick={handleDialogEvents}
              onPointerDown={handleDialogEvents}
              onMouseMove={handleDialogEvents}
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                cursor: isDragging ? 'grabbing' : 'default',
                zIndex: MODAL_Z_INDEX.COLOR_DIALOG,
              }}
              className={`relative pointer-events-auto isolate ${colors.bg.accent} ${getStatusBorder('default')} ${quick.card} ${PANEL_LAYOUT.SHADOW['2XL']} ${PANEL_LAYOUT.LAYOUT_DIMENSIONS.MODAL_MAX_HEIGHT} ${PANEL_LAYOUT.OVERFLOW.Y_AUTO} ${maxWidthClass} ${PANEL_LAYOUT.SELECT.NONE}`}
            >
              {/* Header — ✅ ENTERPRISE: Draggable handle (centralized useDraggable
                  matches `[data-drag-handle="true"]`) */}
              <div
                data-drag-handle="true"
                onMouseDown={handleMouseDown}
                className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.LG} ${getDirectionalBorder('muted', 'bottom')} ${PANEL_LAYOUT.CURSOR.GRAB} active:${PANEL_LAYOUT.CURSOR.GRABBING}`}
              >
                <h2
                  {...titleProps}
                  className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
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

              {/* Content — ✅ FIX: Ensure pointer events work */}
              <div className={`${PANEL_LAYOUT.SPACING.NONE} cursor-default pointer-events-auto`}>
                {children}
              </div>

              {/* Footer — SSoT «Ακύρωση / Εφαρμογή» (κοινό για ρυθμίσεις + κείμενο) */}
              {showFooter && (
                <div className={`flex ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.SPACING.LG} ${getDirectionalBorder('muted', 'top')}`}>
                  <button
                    onClick={onCancel}
                    className={`flex-1 ${PANEL_LAYOUT.BUTTON.PADDING_LG} ${colors.bg.secondary} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${colors.text.inverted} rounded ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.CURSOR.POINTER}`}
                  >
                    {t('colorPicker.cancel')}
                  </button>
                  <button
                    onClick={onApply}
                    className={`flex-1 ${PANEL_LAYOUT.BUTTON.PADDING_LG} ${colors.bg.primary} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} ${colors.text.primary} rounded ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.CURSOR.POINTER}`}
                  >
                    {t('colorPicker.apply')}
                  </button>
                </div>
              )}
            </div>
          </FocusScope>
        </div>,
        document.body,
      )
    : null;
}
