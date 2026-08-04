'use client';

/**
 * 🔴 ADR-739 §36 ΦΑΣΗ 4 — **«υπάρχουν ήδη δεδομένα εδώ»**: η ερώτηση πριν η μεταφορά περιοχής
 * σβήσει περιεχόμενο. Self-subscribing portal, μηδέν props — ίδιο σχήμα με τους άλλους δώδεκα
 * διαλόγους επιβεβαίωσης του subapp (`HatchOverlapConfirmDialog` κ.λπ.).
 *
 * ## 🔴 ΓΙΑΤΙ Η ΕΣΤΙΑΣΗ ΠΑΕΙ ΣΤΟ **ΑΚΥΡΟ** ΚΑΙ ΟΧΙ ΣΤΗΝ ΑΝΤΙΚΑΤΑΣΤΑΣΗ
 * Το Excel εστιάζει το `OK` — και αυτή είναι η μία θέση όπου το parity **δεν** ακολουθείται, με
 * μετρήσιμο λόγο: εδώ ο διάλογος γεννιέται μέσα σε **φύλλο υπολογισμού**, όπου το `Enter` είναι
 * το συχνότερο πλήκτρο που πατά ο χρήστης (κάθε καταχώριση κελιού τελειώνει με αυτό). Ένα
 * αντανακλαστικό `Enter` πάνω σε εστιασμένη «Αντικατάσταση» θα ήταν **ακριβώς** η σιωπηλή
 * καταστροφή που αυτή η φάση υπάρχει για να αποτρέψει — δηλαδή ο διάλογος θα ρωτούσε τυπικά και
 * θα απαντούσε μόνος του. Η οδηγία της Nielsen Norman για καταστροφικές ενέργειες λέει το ίδιο:
 * *«the default focus should land on the safe or non-destructive option»*.
 *
 * Το κόστος είναι ένα `Tab` για όποιον όντως θέλει αντικατάσταση· το κέρδος είναι ότι καμία
 * απώλεια δεδομένων δεν συμβαίνει από **μη-ενέργεια**.
 *
 * ## Το `Esc` ζει σε δικό του σκαλί
 * `ESC_PRIORITY.BLOCKING_CONFIRM` (P1050) και όχι `MODAL_DIALOG` (P1000): εκεί κάθεται ήδη ο
 * inline editor του κελιού, που είναι **ζωντανός ταυτόχρονα** με αυτόν τον διάλογο. Δες το
 * σκεπτικό στη σταθερά — η ισοπαλία θα κρινόταν από σειρά εγγραφής, δηλαδή από σύμπτωση.
 *
 * @see ../../bim/table/table-range-overwrite-confirm-store.ts — η χειραψία
 * @see ../table-cell-editor/table-range-transfer-drop.ts — ποιος ρωτά και τι κάνει με την απάντηση
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36.22
 */

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TableWarningConfirmDialog } from './TableWarningConfirmDialog';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  getTableRangeOverwriteState,
  resolveTableRangeOverwrite,
  subscribeTableRangeOverwrite,
} from '../../bim/table/table-range-overwrite-confirm-store';

export const TableRangeOverwriteConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeTableRangeOverwrite,
    getTableRangeOverwriteState,
    getTableRangeOverwriteState,
  );

  // `Esc` = Άκυρο, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). `canHandle` το κάνει
  // inert όταν κλειστό — υποχρεωτικό σε αυτό το σκαλί (δες την κεφαλίδα).
  useEscapeHandler({
    id: 'table-range-overwrite-confirm',
    priority: ESC_PRIORITY.BLOCKING_CONFIRM,
    canHandle: () => state.open,
    handle: () => {
      resolveTableRangeOverwrite('cancel');
      return true;
    },
  });

  if (!state.open) return null;

  return (
    <TableWarningConfirmDialog
      title={t('tableRangeOverwrite.title')}
      message={t('tableRangeOverwrite.message', { count: state.cells })}
      undoNote={t('tableRangeOverwrite.undoNote')}
      confirmLabel={t('tableRangeOverwrite.replaceButton')}
      cancelLabel={t('tableRangeOverwrite.cancel')}
      onConfirm={() => resolveTableRangeOverwrite('replace')}
      onCancel={() => resolveTableRangeOverwrite('cancel')}
    />
  );
};
