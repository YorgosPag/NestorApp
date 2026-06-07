'use client';

/**
 * ADR-363 Φ3c / ADR-419 «Πολλαπλή δημιουργία» — ενημερωτικό παράθυρο επιβεβαίωσης.
 *
 * Δύο modes (subscribes στο column-perimeter-confirm-store — μηδέν props):
 *   - `intent-mixed` (ADR-419): η «Πολλαπλή δημιουργία κολωνών/τοιχίων» εντόπισε
 *     στοιχεία «άλλου τύπου». 3 κουμπιά (όλα / μόνο τα δικά μου / άκυρο) όταν
 *     υπάρχουν ≥1 «δικά μου»· 2 κουμπιά (όλα / άκυρο) όταν εντοπίστηκαν ΜΟΝΟ άλλου
 *     τύπου. Σέβεται την πρόθεση + μη αλλοίωση στατικών (Giorgio).
 *   - `is-column` (Φ3): «Τοιχίο από περίγραμμα» αλλά αναλογία ≤ 4 → κολόνα (EC2 §9.6.1).
 *
 * Renders via createPortal (pattern mirror: WallCascadeDeleteDialog).
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
    return createPortal(<IsColumnDialog state={state} t={t} />, document.body);
  }

  return createPortal(<IntentMixedDialog state={state} t={t} />, document.body);
};

type DialogT = ReturnType<typeof useTranslation>['t'];

interface DialogProps {
  state: ColumnPerimeterConfirmState;
  t: DialogT;
}

// ── ADR-419 intent-mixed ──────────────────────────────────────────────────────

const IntentMixedDialog: React.FC<DialogProps> = ({ state, t }) => {
  const { intent, primaryCount, secondaryCount } = state;
  // Plural-correct noun phrases (i18next _one/_other) ανά πρόθεση.
  const primaryText =
    intent === 'columns'
      ? t('perimeterColumnDiscrete.nColumns', { count: primaryCount })
      : t('perimeterColumnDiscrete.nWalls', { count: primaryCount });
  const secondaryText =
    intent === 'columns'
      ? t('perimeterColumnDiscrete.nWalls', { count: secondaryCount })
      : t('perimeterColumnDiscrete.nColumns', { count: secondaryCount });
  const onlyPrimaryLabel =
    intent === 'columns'
      ? t('perimeterColumnConfirm.onlyColumns')
      : t('perimeterColumnConfirm.onlyWalls');

  const hasPrimary = primaryCount > 0;

  return (
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('perimeterColumnConfirm.intentTitle')}</h2>
        <p className="dxf-modal-body">
          {hasPrimary
            ? t('perimeterColumnConfirm.intentMessage', { primary: primaryText, secondary: secondaryText })
            : t('perimeterColumnConfirm.intentMessageOnlySecondary', { secondary: secondaryText })}
        </p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-primary"
            onClick={() => resolveColumnPerimeterConfirm('create-all')}
          >
            {t('perimeterColumnConfirm.createAll')}
          </button>
          {hasPrimary && (
            <button
              type="button"
              className="dxf-modal-button"
              onClick={() => resolveColumnPerimeterConfirm('create-primary')}
            >
              {onlyPrimaryLabel}
            </button>
          )}
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
};

// ── Φ3 is-column (αναλογία ≤ 4 → κολόνα) ───────────────────────────────────────

const IsColumnDialog: React.FC<DialogProps> = ({ state, t }) => (
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
          onClick={() => resolveColumnPerimeterConfirm('create-all')}
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
