'use client';

/**
 * ADR-524 — «Πολλαπλή πλήρωση όμοιων πλαισίων» confirm dialog.
 *
 * Αφού τοποθετηθεί κολόνα/τοιχίο σε ένα πλαίσιο συγκεκριμένου χρώματος, το σύστημα
 * βρίσκει τα υπόλοιπα όμοια (ίδιου χρώματος) αγέμιστα πλαίσια και ρωτά αν θα
 * τοποθετηθούν κι εκεί. Self-subscribing (μηδέν props) — pattern mirror του
 * `ColumnPerimeterConfirmDialog`.
 *
 * @see ../../bim/columns/column-batch-fill-confirm-store.ts
 * @see docs/centralized-systems/reference/adrs/ADR-524-column-batch-fill-same-color-frames.md
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  subscribeColumnBatchFillConfirm,
  getColumnBatchFillConfirmState,
  resolveColumnBatchFillConfirm,
} from '../../bim/columns/column-batch-fill-confirm-store';

export const ColumnBatchFillConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeColumnBatchFillConfirm,
    getColumnBatchFillConfirmState,
    getColumnBatchFillConfirmState,
  );

  // ESC = Όχι, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). Προτεραιότητα
  // MODAL_DIALOG ώστε να κερδίζει το ενεργό εργαλείο· `canHandle` το κάνει inert όταν κλειστό.
  useEscapeHandler({
    id: 'column-batch-fill-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveColumnBatchFillConfirm('cancel');
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  const { columnCount, wallCount } = state;
  const total = columnCount + wallCount;
  // Πληθυντικός-σωστές φράσεις (επανάχρηση των ίδιων plural keys με το «από περίγραμμα»).
  const columnsText = t('perimeterColumnDiscrete.nColumns', { count: columnCount });
  const wallsText = t('perimeterColumnDiscrete.nWalls', { count: wallCount });
  const message =
    columnCount > 0 && wallCount > 0
      ? t('columnBatchFill.messageMixed', { total, columns: columnsText, walls: wallsText })
      : wallCount > 0
        ? t('columnBatchFill.messageWalls', { total, walls: wallsText })
        : t('columnBatchFill.messageColumns', { total, columns: columnsText });

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('columnBatchFill.title')}</h2>
        <p className="dxf-modal-body">{message}</p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-primary"
            onClick={() => resolveColumnBatchFillConfirm('fill-all')}
          >
            {t('columnBatchFill.fillAll')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveColumnBatchFillConfirm('cancel')}
          >
            {t('columnBatchFill.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
