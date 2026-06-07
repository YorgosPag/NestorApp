'use client';

/**
 * ADR-363 Φ3c «Κολώνα από περίγραμμα» — ενημερωτικό παράθυρο επιβεβαίωσης.
 *
 * Εμφανίζεται όταν το box-select εντοπίσει ≥1 περίγραμμα που στατικά είναι ΤΟΙΧΙΟ
 * (αναλογία πλευρών ≥ 4 ή μη-ορθογωνικό). Αναφέρει την ΑΥΤΟΜΑΤΗ ταξινόμηση («N
 * τοιχία + M κολώνες») — ΔΕΝ αναγκάζει ισοπέδωση (Giorgio: μη αλλοίωση στατικών).
 * Renders via createPortal (pattern mirror: WallCascadeDeleteDialog). Subscribes
 * στο column-perimeter-confirm-store — μηδέν props.
 *
 * Δύο ενέργειες:
 *   - 'create' → δημιουργία όλων (τοιχία + κολώνες) με τους σωστούς τύπους.
 *   - 'cancel' → όλα ή τίποτα: κανένα στοιχείο δεν δημιουργείται.
 *
 * Το κουμπί δημιουργίας έχει autoFocus (η ασφαλής/αναμενόμενη ενέργεια εδώ είναι
 * μη καταστροφική — η δημιουργία είναι αναιρέσιμη).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  subscribeColumnPerimeterConfirm,
  getColumnPerimeterConfirmState,
  resolveColumnPerimeterConfirm,
  type ColumnPerimeterConfirmState,
} from '../../bim/columns/column-perimeter-confirm-store';

export const ColumnPerimeterConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeColumnPerimeterConfirm,
    getColumnPerimeterConfirmState,
    getColumnPerimeterConfirmState,
  );

  // ESC = Άκυρο, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT — όχι inline
  // keydown listener). Προτεραιότητα MODAL_DIALOG (1000) ώστε να κερδίζει το global
  // command bus· το `return true` διεκδικεί το ESC, άρα το ενεργό εργαλείο (DRAW_TOOL
  // 500) ΔΕΝ απενεργοποιείται ταυτόχρονα. `canHandle` το κάνει inert όταν κλειστό.
  useEscapeHandler({
    id: 'column-perimeter-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveColumnPerimeterConfirm('cancel');
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  if (state.mode === 'is-column') {
    return createPortal(
      <IsColumnDialog state={state} t={t} />,
      document.body,
    );
  }

  // has-walls mode: plural-correct noun phrases (i18next _one/_other)
  const wallsText = t('perimeterColumnDiscrete.nWalls', { count: state.walls });
  const columnsText = t('perimeterColumnDiscrete.nColumns', { count: state.columns });

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('perimeterColumnConfirm.title')}</h2>
        <p className="dxf-modal-body">
          {t('perimeterColumnConfirm.message', { walls: wallsText, columns: columnsText })}
        </p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-primary"
            onClick={() => resolveColumnPerimeterConfirm('create')}
          >
            {t('perimeterColumnConfirm.create')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveColumnPerimeterConfirm('cancel')}
          >
            {t('perimeterColumnConfirm.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

interface IsColumnDialogProps {
  state: ColumnPerimeterConfirmState;
  t: ReturnType<typeof useTranslation>['t'];
}

const IsColumnDialog: React.FC<IsColumnDialogProps> = ({ state, t }) => (
  <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
    <div className="dxf-modal-card">
      <h2 className="dxf-modal-title">{t('perimeterColumnConfirm.isColumnTitle')}</h2>
      <p className="dxf-modal-body">
        {t('perimeterColumnConfirm.isColumnMessage', { aspect: state.aspect.toFixed(1) })}
      </p>
      <div className="dxf-modal-actions">
        <button
          type="button"
          autoFocus
          className="dxf-modal-button dxf-modal-button-primary"
          onClick={() => resolveColumnPerimeterConfirm('create')}
        >
          {t('perimeterColumnConfirm.createAsColumn')}
        </button>
        <button
          type="button"
          className="dxf-modal-button"
          onClick={() => resolveColumnPerimeterConfirm('cancel')}
        >
          {t('perimeterColumnConfirm.cancel')}
        </button>
      </div>
    </div>
  </div>
);
