'use client';

/**
 * ADR-363 §5.6c — «Σχέσεις διατομής εκτός εύρους» confirm dialog (self-subscribing, zero props).
 *
 * Γενικό dialog για ΟΛΟΥΣ τους τύπους κολόνας (Γ/Τ/Π/Ι/πολύγωνο/σύνθετη/τοιχίο): όταν η αλλαγή
 * διαστάσεων εισάγει νέα/-ες παραβίαση/-εις «σχέσης» (γεωμετρική εκφύλιση / λυγηρότητα / ποσοστό
 * οπλισμού), προειδοποιούμε (SOFT — ΠΟΤΕ block· big-player passive-warn): συνέχεια ή ακύρωση.
 *
 * **FULL SSoT:** τα specific μηνύματα ΔΕΝ ξαναγράφονται — κάνουμε render απευθείας τα i18n keys των
 * violations (`column.validation.hardErrors.*` / `codeViolations.*`) που ήδη υπάρχουν μεταφρασμένα.
 * Μόνο το «chrome» (τίτλος/εισαγωγή/κουμπιά) είναι νέα keys (`sectionRelationship.*`).
 *
 * Pattern mirror: `ShearWallExtentDialog` (createPortal + EscapeCommandBus + dxf-modal-* + i18n).
 *
 * @see ../../bim/columns/section-relationship-confirm-store.ts — το handshake store
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6c
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  subscribeSectionRelationship,
  getSectionRelationshipState,
  resolveSectionRelationship,
} from '../../bim/columns/section-relationship-confirm-store';

export const SectionRelationshipDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeSectionRelationship,
    getSectionRelationshipState,
    getSectionRelationshipState,
  );

  // ESC = Άκυρο μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). `canHandle` → inert όταν κλειστό.
  useEscapeHandler({
    id: 'section-relationship-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveSectionRelationship('cancel');
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card dxf-modal-card-warning">
        <h2 className="dxf-modal-title dxf-modal-title-warning">
          {t('sectionRelationship.title')}
        </h2>
        {state.violationKeys.map((key) => (
          <p key={key} className="dxf-modal-note-warning">
            {`⚠️ ${t(key)}`}
          </p>
        ))}
        <p className="dxf-modal-body">{t('sectionRelationship.message')}</p>
        <div className="dxf-modal-actions dxf-modal-actions-stack">
          <button
            type="button"
            autoFocus
            className="dxf-modal-button dxf-modal-button-warning"
            onClick={() => resolveSectionRelationship('proceed')}
          >
            {t('sectionRelationship.proceedButton')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => resolveSectionRelationship('cancel')}
          >
            {t('sectionRelationship.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
