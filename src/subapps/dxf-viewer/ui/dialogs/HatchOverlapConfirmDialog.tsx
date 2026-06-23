'use client';

/**
 * ADR-507 Φ3 — confirm dialog «η περιοχή έχει ήδη γραμμοσκίαση» (self-subscribing, zero props).
 *
 * Όταν ο χρήστης κάνει pick-point μέσα σε ήδη-γραμμοσκιασμένη περιοχή, ρωτάμε αν θα
 * προστεθεί δεύτερη (επιλογή Giorgio: warn + allow, σαν AutoCAD). Pattern mirror του
 * `ColumnAdoptSizeDialog` (createPortal + EscapeCommandBus + dxf-modal-* classes + i18n).
 *
 * @see ../../bim/hatch/hatch-overlap-confirm-store.ts — το handshake store
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  subscribeHatchOverlap,
  getHatchOverlapState,
  resolveHatchOverlap,
} from '../../bim/hatch/hatch-overlap-confirm-store';

export const HatchOverlapConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeHatchOverlap,
    getHatchOverlapState,
    getHatchOverlapState,
  );

  // ESC = Άκυρο, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). `canHandle` το κάνει
  // inert όταν κλειστό· προτεραιότητα MODAL_DIALOG ώστε να κερδίζει το ενεργό εργαλείο.
  useEscapeHandler({
    id: 'hatch-overlap-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveHatchOverlap('cancel');
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card dxf-modal-card-warning">
        <h2 className="dxf-modal-title dxf-modal-title-warning">{t('hatchOverlap.title')}</h2>
        <p className="dxf-modal-note-warning">{t('hatchOverlap.message')}</p>
        <div className="dxf-modal-actions dxf-modal-actions-stack">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-warning"
            onClick={() => resolveHatchOverlap('create')}
          >
            {t('hatchOverlap.createButton')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveHatchOverlap('cancel')}
          >
            {t('hatchOverlap.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
