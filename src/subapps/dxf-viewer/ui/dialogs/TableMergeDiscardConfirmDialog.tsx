'use client';

/**
 * 🔴 ADR-755 — **«θα κρατηθεί μόνο η επάνω αριστερή τιμή»**: η ερώτηση πριν η συγχώνευση πετάξει
 * περιεχόμενο. Self-subscribing portal, μηδέν props — ίδιο σχήμα με τους άλλους δεκατρείς
 * διαλόγους επιβεβαίωσης του subapp.
 *
 * ## Γιατί η ερώτηση υπάρχει καθόλου
 * Η συγχώνευση είναι η **μόνη** εντολή μορφοποίησης του πίνακα που καταστρέφει δεδομένα. Τα
 * περιγράμματα και οι διαγώνιοι γράφουν σε **κάθε** κελί της περιοχής ακριβώς για να μη χαθεί
 * τίποτα όταν λυθεί μια συγχώνευση (ADR-750 Α16)· εδώ το περιεχόμενο των καλυμμένων κελιών
 * **πετιέται**, γιατί ένα κείμενο κρυμμένο κάτω από συγχώνευση δεν βγαίνει σε καμία εξαγωγή και
 * δεν το βρίσκει καμία αναζήτηση — είναι δεδομένο-φάντασμα.
 *
 * ## 🔴 Η ΕΣΤΙΑΣΗ ΠΑΕΙ ΣΤΟ «ΑΚΥΡΟ», ΟΧΙ ΣΤΗ ΣΥΓΧΩΝΕΥΣΗ
 * Η ίδια απόφαση με τον `TableRangeOverwriteConfirmDialog`, για τον ίδιο μετρημένο λόγο: ο
 * διάλογος γεννιέται μέσα σε **φύλλο υπολογισμού**, όπου το `Enter` είναι το συχνότερο πλήκτρο
 * που πατά ο χρήστης. Ένα αντανακλαστικό `Enter` πάνω σε εστιασμένη «Συγχώνευση» θα ήταν
 * ακριβώς η σιωπηλή απώλεια που ο διάλογος υπάρχει για να αποτρέψει.
 *
 * ## Το `Esc` ζει σε δικό του σκαλί
 * `ESC_PRIORITY.BLOCKING_CONFIRM` (P1050) και όχι `MODAL_DIALOG` (P1000): εκεί κάθεται ήδη ο
 * inline editor του κελιού, που είναι **ζωντανός ταυτόχρονα** με αυτόν τον διάλογο.
 *
 * @see ../../bim/table/table-merge-discard-confirm-store.ts — η χειραψία
 * @see ../table-cell-editor/use-table-merge-actions.ts — ποιος ρωτά και τι κάνει με την απάντηση
 * @see docs/centralized-systems/reference/adrs/ADR-755-table-cell-merge.md
 */

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TableWarningConfirmDialog } from './TableWarningConfirmDialog';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  getTableMergeDiscardState,
  resolveTableMergeDiscard,
  subscribeTableMergeDiscard,
} from '../../bim/table/table-merge-discard-confirm-store';

export const TableMergeDiscardConfirmDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeTableMergeDiscard,
    getTableMergeDiscardState,
    getTableMergeDiscardState,
  );

  // `Esc` = Άκυρο, μέσω του κεντρικού EscapeCommandBus (ADR-364 SSoT). `canHandle` το κάνει
  // inert όταν κλειστό — υποχρεωτικό σε αυτό το σκαλί (δες την κεφαλίδα).
  useEscapeHandler({
    id: 'table-merge-discard-confirm',
    priority: ESC_PRIORITY.BLOCKING_CONFIRM,
    canHandle: () => state.open,
    handle: () => {
      resolveTableMergeDiscard('cancel');
      return true;
    },
  });

  if (!state.open) return null;

  return (
    <TableWarningConfirmDialog
      title={t('tableMergeDiscard.title')}
      message={t('tableMergeDiscard.message', { count: state.cells })}
      undoNote={t('tableMergeDiscard.undoNote')}
      confirmLabel={t('tableMergeDiscard.mergeButton')}
      cancelLabel={t('tableMergeDiscard.cancel')}
      onConfirm={() => resolveTableMergeDiscard('merge')}
      onCancel={() => resolveTableMergeDiscard('cancel')}
    />
  );
};
