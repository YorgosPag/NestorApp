'use client';

/**
 * ADR-529 — «Προαγωγή γωνιακής κολόνας σε Γ (boundary element)» confirm dialog.
 *
 * Όταν ένα δοκάρι πλαισιώνεται στη μη-αναπτυσσόμενη (στενή) παρειά γωνιακής κολόνας μίας κατεύθυνσης
 * (EC8 ανεπαρκής κόμβος), το σύστημα προτείνει προαγωγή σε Γ ώστε η κολόνα να αποκτήσει σκέλος προς το
 * δοκάρι (boundary element). Self-subscribing (μηδέν props) — pattern mirror του `ColumnBatchFillConfirmDialog`.
 *
 * @see ../../bim/columns/column-promote-confirm-store.ts
 * @see docs/centralized-systems/reference/adrs/ADR-529-beam-promotes-corner-column-to-boundary-element.md
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  subscribeColumnPromoteConfirm,
  getColumnPromoteConfirmState,
  resolveColumnPromoteConfirm,
} from '../../bim/columns/column-promote-confirm-store';

export const ColumnPromoteConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeColumnPromoteConfirm,
    getColumnPromoteConfirmState,
    getColumnPromoteConfirmState,
  );

  // ESC = Όχι, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). `canHandle` το κάνει inert όταν κλειστό.
  useEscapeHandler({
    id: 'column-promote-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveColumnPromoteConfirm('cancel');
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  const message = t('columnPromoteL.message', { count: state.columnCount });

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('columnPromoteL.title')}</h2>
        <p className="dxf-modal-body">{message}</p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-primary"
            onClick={() => resolveColumnPromoteConfirm('promote')}
          >
            {t('columnPromoteL.promote')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveColumnPromoteConfirm('cancel')}
          >
            {t('columnPromoteL.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
