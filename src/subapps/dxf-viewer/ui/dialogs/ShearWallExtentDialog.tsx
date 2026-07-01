'use client';

/**
 * ADR-363 §5.6b — «Ασυνήθιστες διαστάσεις τοιχίου» confirm dialog (self-subscribing, zero props).
 *
 * Όταν οι διαστάσεις ενός τοιχίου ξεπερνούν advisory όριο πάχους (> 1.5m → μαζικό σκυρόδεμα) ή
 * μήκους (> 30m → απαιτείται αρμός, EC2 §7.3), προειδοποιούμε (SOFT — ΠΟΤΕ block· οι Ευρωκώδικες
 * δεν ορίζουν μέγιστο): συνέχεια ή ακύρωση. Δείχνει ΜΟΝΟ τις γραμμές που πράγματι ξεπερνούν.
 *
 * Pattern mirror: `ColumnBecomesWallDialog` (createPortal + EscapeCommandBus + dxf-modal-* +
 * i18n). Διαστάσεις locale-aware μέσω `formatLengthForDisplay` (όχι hardcoded — N.11).
 *
 * @see ../../bim/columns/shear-wall-extent-confirm-store.ts — το handshake store
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6b
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { formatLengthForDisplay } from '../../config/display-length-format';
import {
  subscribeShearWallExtent,
  getShearWallExtentState,
  resolveShearWallExtent,
} from '../../bim/columns/shear-wall-extent-confirm-store';

export const ShearWallExtentDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeShearWallExtent,
    getShearWallExtentState,
    getShearWallExtentState,
  );

  // ESC = Άκυρο μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). `canHandle` → inert όταν κλειστό.
  useEscapeHandler({
    id: 'shear-wall-extent-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveShearWallExtent('cancel');
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  const thickness = formatLengthForDisplay(state.thicknessMm);
  const length = formatLengthForDisplay(state.lengthMm);

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card dxf-modal-card-warning">
        <h2 className="dxf-modal-title dxf-modal-title-warning">
          {t('shearWallExtent.title')}
        </h2>
        {state.thickTooLarge && (
          <p className="dxf-modal-note-warning">
            {t('shearWallExtent.warningThickness', { thickness })}
          </p>
        )}
        {state.lengthTooLarge && (
          <p className="dxf-modal-note-warning">
            {t('shearWallExtent.warningLength', { length })}
          </p>
        )}
        <p className="dxf-modal-body">{t('shearWallExtent.message')}</p>
        <div className="dxf-modal-actions dxf-modal-actions-stack">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-warning"
            onClick={() => resolveShearWallExtent('proceed')}
          >
            {t('shearWallExtent.proceedButton')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveShearWallExtent('cancel')}
          >
            {t('shearWallExtent.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
