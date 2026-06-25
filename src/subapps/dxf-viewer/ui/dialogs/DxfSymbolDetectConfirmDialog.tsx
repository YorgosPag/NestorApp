'use client';

/**
 * ADR-533 — «Ανίχνευση συμβόλου κουφώματος σε τοίχο» confirm dialog.
 *
 * Αφού τοποθετηθεί τοίχος πάνω σε κάτοψη DXF, το σύστημα αναγνωρίζει τα
 * σχεδιασμένα σύμβολα (πόρτα = τόξο+φύλλο, παράθυρο = παράλληλες γραμμές) και
 * προτείνει **ένα-ένα** τη δημιουργία BIM ανοίγματος. Self-subscribing (μηδέν
 * props) — pattern mirror του `ColumnBatchFillConfirmDialog`.
 *
 * @see ../../bim/walls/dxf-symbol-detect-confirm-store.ts
 * @see docs/centralized-systems/reference/adrs/ADR-533-dxf-symbol-to-opening-detector.md
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  subscribeDxfSymbolDetectConfirm,
  getDxfSymbolDetectConfirmState,
  resolveDxfSymbolDetectConfirm,
} from '../../bim/walls/dxf-symbol-detect-confirm-store';

export const DxfSymbolDetectConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeDxfSymbolDetectConfirm,
    getDxfSymbolDetectConfirmState,
    getDxfSymbolDetectConfirmState,
  );

  // ESC = Παράλειψη, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT).
  useEscapeHandler({
    id: 'dxf-symbol-detect-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveDxfSymbolDetectConfirm('skip');
      return true;
    },
  });

  if (!state.open || !state.opening || typeof document === 'undefined') return null;

  const { opening, index, total, widthMm } = state;
  const widthLabel = (widthMm / 1000).toFixed(2);
  const message =
    opening.kind === 'door'
      ? t('dxfSymbolDetect.messageDoor', {
          width: widthLabel,
          hinge: t(opening.handing === 'right' ? 'dxfSymbolDetect.hingeRight' : 'dxfSymbolDetect.hingeLeft'),
          dir: t(opening.openDirection === 'outward' ? 'dxfSymbolDetect.dirOut' : 'dxfSymbolDetect.dirIn'),
        })
      : t('dxfSymbolDetect.messageWindow', { width: widthLabel });

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('dxfSymbolDetect.title', { index, total })}</h2>
        <p className="dxf-modal-body">{message}</p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-primary"
            onClick={() => resolveDxfSymbolDetectConfirm('add')}
          >
            {t('dxfSymbolDetect.add')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveDxfSymbolDetectConfirm('skip')}
          >
            {t('dxfSymbolDetect.skip')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
