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
import {
  subscribeColumnPerimeterConfirm,
  getColumnPerimeterConfirmState,
  resolveColumnPerimeterConfirm,
} from '../../bim/columns/column-perimeter-confirm-store';

export const ColumnPerimeterConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeColumnPerimeterConfirm,
    getColumnPerimeterConfirmState,
    getColumnPerimeterConfirmState,
  );

  if (!state.open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('perimeterColumnConfirm.title')}</h2>
        <p className="dxf-modal-body">
          {t('perimeterColumnConfirm.message', { walls: state.walls, columns: state.columns })}
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
