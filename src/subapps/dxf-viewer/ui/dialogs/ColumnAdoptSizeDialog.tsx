'use client';

/**
 * ADR-398 §3.17 — «Υιοθέτηση μεγέθους ορθογωνίου» confirm dialog (self-subscribing, zero props).
 *
 * Το 1ο κλικ του εργαλείου «Κολόνα» μέσα σε ορθογώνιο DXF ρωτά (opt-in, ADR-487 §8.4 «ΠΟΤΕ σιωπηλά»):
 * να δημιουργηθεί κολόνα στο μέγεθος + κέντρο + γωνία του ορθογωνίου, ή να κρατηθεί η default διατομή;
 *
 * Pattern mirror: `ColumnPerimeterConfirmDialog` (createPortal + EscapeCommandBus + dxf-modal-* classes +
 * i18n). Οι διαστάσεις renderάρονται locale-aware μέσω `formatLengthForDisplay` (όχι hardcoded — N.11).
 *
 * @see ../../bim/columns/column-adopt-size-confirm-store.ts — το handshake store
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.17
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { formatLengthForDisplay } from '../../config/display-length-format';
import {
  subscribeColumnAdoptSize,
  getColumnAdoptSizeState,
  resolveColumnAdoptSize,
} from '../../bim/columns/column-adopt-size-confirm-store';

/** «W × H unit» locale-aware (μονάδα μία φορά, στο τέλος). */
function formatSize(widthMm: number, depthMm: number): string {
  return `${formatLengthForDisplay(widthMm, { withUnit: false })} × ${formatLengthForDisplay(depthMm)}`;
}

export const ColumnAdoptSizeDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeColumnAdoptSize,
    getColumnAdoptSizeState,
    getColumnAdoptSizeState,
  );

  // ESC = Άκυρο, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). Προτεραιότητα MODAL_DIALOG ώστε
  // να κερδίζει το ενεργό εργαλείο (DRAW_TOOL)· `canHandle` το κάνει inert όταν κλειστό.
  useEscapeHandler({
    id: 'column-adopt-size-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveColumnAdoptSize('cancel');
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  const adoptSize = formatSize(state.widthMm, state.depthMm);
  const defaultSize = formatSize(state.defaultWidthMm, state.defaultDepthMm);

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('columnAdoptSize.title')}</h2>
        <p className="dxf-modal-body">
          {t('columnAdoptSize.message', { adopt: adoptSize, default: defaultSize })}
        </p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-primary"
            onClick={() => resolveColumnAdoptSize('adopt')}
          >
            {t('columnAdoptSize.adoptButton', { size: adoptSize })}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveColumnAdoptSize('default')}
          >
            {t('columnAdoptSize.defaultButton', { size: defaultSize })}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveColumnAdoptSize('cancel')}
          >
            {t('columnAdoptSize.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
