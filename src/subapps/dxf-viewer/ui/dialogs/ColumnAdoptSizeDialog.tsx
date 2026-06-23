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
  // EC2 §9.6.1 — αναλογία > 4 → «τοιχίο», αλλιώς «κολόνα» (η εφαρμογή ταξινομεί στατικά τίμια).
  const isWall = state.isShearWall;
  const element = isWall
    ? t('columnAdoptSize.elementWall')
    : t('columnAdoptSize.elementColumn');
  // §3.17 — 3 καταστάσεις: block (μη κατασκευάσιμο → κόκκινο, ΧΩΡΙΣ δημιουργία) / warning (τοιχίο ενώ
  // διάλεξες κολόνα → αμβέρ) / ok (μπλε). Το block ΕΥΘΥΓΡΑΜΜΙΖΕΤΑΙ με τον validator (ΕΝΑ SSoT κατώφλι).
  const blocked = state.tier === 'block';
  const variant = blocked ? 'danger' : isWall ? 'warning' : null;
  const cardClass = variant ? `dxf-modal-card dxf-modal-card-${variant}` : 'dxf-modal-card';
  const titleClass = variant ? `dxf-modal-title dxf-modal-title-${variant}` : 'dxf-modal-title';

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className={cardClass}>
        <h2 className={titleClass}>
          {blocked ? t('columnAdoptSize.blockTitle') : t('columnAdoptSize.title')}
        </h2>
        {blocked ? (
          <p className="dxf-modal-note-danger">{t('columnAdoptSize.blockNote', { size: adoptSize })}</p>
        ) : (
          <>
            {isWall && (
              <p className="dxf-modal-note-warning">{t('columnAdoptSize.wallWarning')}</p>
            )}
            <p className="dxf-modal-body">
              {t('columnAdoptSize.message', { adopt: adoptSize, default: defaultSize, element })}
            </p>
          </>
        )}
        <div className="dxf-modal-actions dxf-modal-actions-stack">
          {/* Block → ΧΩΡΙΣ κουμπί δημιουργίας (δεν επιτρέπεται μη κατασκευάσιμη διατομή). */}
          {!blocked && (
            <button
              type="button"
              autoFocus
              className={
                isWall
                  ? 'dxf-modal-button dxf-modal-button-warning'
                  : 'dxf-modal-button dxf-modal-button-primary'
              }
              onClick={() => resolveColumnAdoptSize('adopt')}
            >
              {t('columnAdoptSize.adoptButton', { size: adoptSize, element })}
            </button>
          )}
          <button
            type="button"
            autoFocus={blocked}
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
