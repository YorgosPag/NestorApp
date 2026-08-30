'use client';

/**
 * 🔴 ADR-833 §1.4 — **«τι να κάνω με αυτό το αρχείο;»**: η ερώτηση του «Ανοίγματος».
 * Self-subscribing portal, μηδέν props — ίδιο σχήμα με τους άλλους δεκατρείς διαλόγους
 * επιβεβαίωσης του subapp.
 *
 * ## Η μόνη διαφορά από τους αδελφούς: **τρεις** απαντήσεις
 * «Αντικατάσταση» (καταστροφική) · «Νέος πίνακας» (δίνει τα ίδια δεδομένα χωρίς απώλεια) ·
 * «Άκυρο». Το τρίτο κουμπί δεν είναι ευγένεια: χωρίς αυτό, ο χρήστης που θέλει τα δεδομένα
 * **και** τον παλιό του πίνακα θα έπρεπε να ακυρώσει, να φτιάξει μόνος του δεύτερο πίνακα και
 * να ξαναπατήσει «Άνοιγμα» — δηλαδή ο διάλογος θα τον έστελνε πίσω σε δουλειά που ήδη ξέρει.
 *
 * Η εστίαση μένει στο **«Άκυρο»**, όπως σε κάθε αδελφό: ο κανόνας ζει στο κοινό σώμα
 * ({@link TableWarningConfirmDialog}) και δεν ξαναγράφεται εδώ.
 *
 * ## Το `Esc` ζει σε δικό του σκαλί
 * `ESC_PRIORITY.BLOCKING_CONFIRM` (P1050) και όχι `MODAL_DIALOG` (P1000): εκεί κάθεται ήδη ο
 * inline editor του κελιού, που μπορεί να είναι **ζωντανός ταυτόχρονα** με αυτόν τον διάλογο.
 *
 * @see ../../bim/table/table-xlsx-open-confirm-store.ts — η χειραψία
 * @see ../table-xlsx/useTableXlsxImport.ts — ποιος ρωτά και τι κάνει με την απάντηση
 */

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TableWarningConfirmDialog } from './TableWarningConfirmDialog';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  getTableXlsxOpenState,
  resolveTableXlsxOpen,
  subscribeTableXlsxOpen,
} from '../../bim/table/table-xlsx-open-confirm-store';

export const TableXlsxOpenConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeTableXlsxOpen,
    getTableXlsxOpenState,
    getTableXlsxOpenState,
  );

  // `Esc` = Άκυρο, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). `canHandle` το κάνει
  // inert όταν κλειστό — υποχρεωτικό σε αυτό το σκαλί.
  useEscapeHandler({
    id: 'table-xlsx-open-confirm',
    priority: ESC_PRIORITY.BLOCKING_CONFIRM,
    canHandle: () => state.open,
    handle: () => {
      resolveTableXlsxOpen('cancel');
      return true;
    },
  });

  if (!state.open) return null;

  return (
    <TableWarningConfirmDialog
      title={t('tableXlsxOpen.title')}
      message={t('tableXlsxOpen.message', { fileName: state.fileName })}
      undoNote={t('tableXlsxOpen.undoNote')}
      confirmLabel={t('tableXlsxOpen.replaceButton')}
      alternativeLabel={t('tableXlsxOpen.newTableButton')}
      cancelLabel={t('tableXlsxOpen.cancel')}
      onConfirm={() => resolveTableXlsxOpen('replace')}
      onAlternative={() => resolveTableXlsxOpen('new-table')}
      onCancel={() => resolveTableXlsxOpen('cancel')}
    />
  );
};
