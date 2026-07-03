'use client';

/**
 * ADR-419 §gap-close — «Να κλείσω το κενό;» confirm dialog (open-loop βρόχος).
 *
 * Subscribes στο `gap-close-confirm-store` (μηδέν props). «Ναι» → η εφαρμογή
 * προσθέτει τη γραμμή που ενώνει τα δύο ανοιχτά άκρα (κλείνει τον βρόχο)·
 * «Όχι»/ESC → άκυρο. Render via createPortal (pattern mirror:
 * ColumnPerimeterConfirmDialog).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  subscribeGapCloseConfirm,
  getGapCloseConfirmState,
  resolveGapCloseConfirm,
} from '../../bim/walls/gap-close-confirm-store';

export const GapCloseConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeGapCloseConfirm,
    getGapCloseConfirmState,
    getGapCloseConfirmState,
  );

  // ESC = Άκυρο, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). MODAL_DIALOG
  // priority ώστε να μην απενεργοποιεί ταυτόχρονα το ενεργό εργαλείο.
  useEscapeHandler({
    id: 'region-gap-close-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveGapCloseConfirm('cancel');
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('regionPerimeter.gapClose.title')}</h2>
        <p className="dxf-modal-body">{t('regionPerimeter.gapClose.message')}</p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-primary"
            onClick={() => resolveGapCloseConfirm('close')}
          >
            {t('regionPerimeter.gapClose.confirm')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveGapCloseConfirm('cancel')}
          >
            {t('regionPerimeter.gapClose.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
