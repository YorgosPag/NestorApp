'use client';

/**
 * ADR-363 §5.6 — «Οι διαστάσεις δημιουργούν τοιχίο» confirm dialog (self-subscribing, zero props).
 *
 * Όταν ο χρήστης αλλάζει τις διαστάσεις μιας ορθογώνιας κολόνας ώστε η αναλογία
 * πλευρών να περνά το κατώφλι κολόνα→τοιχίο (EC2 §9.6.1 / EC8 §5.4.2.4, rounded
 * aspect > 4), προειδοποιούμε (Revit-style warn, opt-in — ΠΟΤΕ σιωπηλά):
 * μετατροπή σε τοιχίο (reclassify), κράτημα ως κολόνα, ή ακύρωση.
 *
 * Pattern mirror: `ColumnAdoptSizeDialog` (createPortal + EscapeCommandBus +
 * dxf-modal-* classes + i18n). Οι διαστάσεις renderάρονται locale-aware μέσω
 * `formatLengthForDisplay` (όχι hardcoded — N.11)· το aspect σε 1 δεκαδικό.
 *
 * @see ../../bim/columns/column-becomes-wall-confirm-store.ts — το handshake store
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { formatLengthForDisplay } from '../../config/display-length-format';
import {
  subscribeColumnBecomesWall,
  getColumnBecomesWallState,
  resolveColumnBecomesWall,
} from '../../bim/columns/column-becomes-wall-confirm-store';

export const ColumnBecomesWallDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeColumnBecomesWall,
    getColumnBecomesWallState,
    getColumnBecomesWallState,
  );

  // ESC = Άκυρο μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). Προτεραιότητα
  // MODAL_DIALOG ώστε να κερδίζει το ενεργό εργαλείο· `canHandle` το κάνει inert όταν κλειστό.
  useEscapeHandler({
    id: 'column-becomes-wall-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveColumnBecomesWall('cancel');
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  const long = formatLengthForDisplay(state.longSideMm, { withUnit: false });
  const short = formatLengthForDisplay(state.shortSideMm);
  const aspect = state.aspect.toFixed(1);

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card dxf-modal-card-warning">
        <h2 className="dxf-modal-title dxf-modal-title-warning">
          {t('columnBecomesWall.title')}
        </h2>
        <p className="dxf-modal-note-warning">
          {t('columnBecomesWall.warning', { long, short, aspect })}
        </p>
        {/* ADR-363 §5.6c — ορθογώνιο: μετατρέπεται σε τοιχίο· Γ/Τ/Π/Ι/σύνθετη: advisory (κρατά σχήμα). */}
        <p className="dxf-modal-body">
          {t(state.canReclassify ? 'columnBecomesWall.message' : 'columnBecomesWall.messageNonRect')}
        </p>
        <div className="dxf-modal-actions dxf-modal-actions-stack">
          {state.canReclassify && (
            <button
              type="button"
              autoFocus
              className="dxf-modal-button dxf-modal-button-warning"
              onClick={() => resolveColumnBecomesWall('convert')}
            >
              {t('columnBecomesWall.convertButton')}
            </button>
          )}
          <button
            type="button"
            autoFocus={!state.canReclassify}
            className={state.canReclassify ? 'dxf-modal-button' : 'dxf-modal-button dxf-modal-button-warning'}
            onClick={() => resolveColumnBecomesWall('keep')}
          >
            {t(state.canReclassify ? 'columnBecomesWall.keepButton' : 'columnBecomesWall.continueButton')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveColumnBecomesWall('cancel')}
          >
            {t('columnBecomesWall.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
