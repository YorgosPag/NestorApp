'use client';

/**
 * ADR-763 — **ο διάλογος «Εισαγωγή συνάρτησης» (`fx`)**: η καλωδίωση. Self-subscribing portal,
 * μηδέν props — ίδιο σχήμα με τους υπόλοιπους διαλόγους του subapp.
 *
 * ## Τι κάνει το «OK», ακριβώς
 * Γράφει `ΟΝΟΜΑ(` + `)` στο **πρόχειρο του δρομέα** και βάζει τον κέρσορα ανάμεσα, μέσω του
 * `setTableCellCursorDraftAt` — του **ίδιου** γραφέα που χρησιμοποιεί η υπόδειξη κελιού
 * (ADR-754 §4). Καμία δεύτερη διαδρομή εγγραφής: το κελί δεν δεσμεύεται εδώ, ο χρήστης
 * συνεχίζει να γράφει τα ορίσματα και δεσμεύει με `Enter` όπως πάντα.
 *
 * ## 🔴 ΤΟ ΚΛΕΙΣΙΜΟ ΕΠΙΣΤΡΕΦΕΙ ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΕΥΓΕΝΕΙΑ
 * Ο διάλογος **παίρνει** την εστίαση (το πεδίο αναζήτησης έχει `autoFocus`). Όταν
 * ξεμοντάρει, η εστίαση πέφτει στο `document.body`: κανένα πεδίο της συνεδρίας δεν την έχει,
 * άρα ο δομικός φύλακας `isTextEntryTarget` απαντά `false` και οι **43** window listeners
 * ξυπνούν πάνω σε έναν χρήστη που νομίζει ότι γράφει τύπο — το επόμενο `Delete` θα έσβηνε
 * **οντότητα**, όχι χαρακτήρα.
 *
 * Η επιστροφή γίνεται με `restartTableCellCursorSession()`, δηλαδή τον **έναν** δρόμο
 * ανάκτησης του βήματος 9 (νέο React `key` ⇒ νέο `<textarea autoFocus>`) και **όχι** με ωμό
 * `focus()`: μια επανεστίαση μέσα στον κύκλο ξεμονταρίσματος παλεύει με τη μεταφορά εστίασης
 * που ο browser δεν έχει ολοκληρώσει.
 *
 * ## Γιατί το `Esc` κάθεται στο `BLOCKING_CONFIRM` με `allowWhenEditable`
 * Το σκαλί είναι το ίδιο με τους δύο διαλόγους επιβεβαίωσης του πίνακα, για τον ίδιο λόγο:
 * ο inline επεξεργαστής κελιού είναι **ζωντανός ταυτόχρονα** και κάθεται στο `MODAL_DIALOG`.
 * Το `allowWhenEditable` όμως είναι δικό μας και υποχρεωτικό: εκείνοι εστιάζουν **κουμπί**,
 * εδώ ο εστιασμένος είναι `<textarea>` — χωρίς τη σημαία, ο bus θα παραιτούνταν και το `Esc`
 * δεν θα έκλεινε ποτέ τον διάλογο.
 *
 * @module subapps/dxf-viewer/ui/dialogs/TableInsertFunctionDialog
 * @see bim/table/formula/catalog/formula-insert-text.ts — τι ακριβώς γράφεται
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md
 */

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { InsertFunctionForm } from './insert-function-form';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { FORMULA_CATALOG } from '../../bim/table/formula/catalog/formula-catalog';
import { queryFormulaCatalog } from '../../bim/table/formula/catalog/formula-catalog-search';
import { insertFunctionCall } from '../../bim/table/formula/catalog/formula-insert-text';
import {
  FORMULA_CATEGORY_FILTERS,
  formulaCatalogKey,
  type FormulaCategoryFilter,
} from '../../bim/table/formula/catalog/formula-catalog-taxonomy';
import {
  closeInsertFunctionDialog,
  getInsertFunctionDialogState,
  subscribeInsertFunctionDialog,
} from '../../state/insert-function-dialog-store';
import {
  getRecentFormulaFunctions,
  getRecentFormulaFunctionsServerSnapshot,
  rememberFormulaFunction,
  subscribeRecentFormulaFunctions,
} from '../../state/formula-mru-store';
import {
  getTableCellCursor,
  restartTableCellCursorSession,
  setTableCellCursorDraftAt,
} from '../../state/table-cell-cursor-store';

/** Η κατηγορία με την οποία ανοίγει ο διάλογος — η προεπιλογή του Excel. */
const DEFAULT_CATEGORY: FormulaCategoryFilter = 'recent';

export const TableInsertFunctionDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer');
  const state = useSyncExternalStore(
    subscribeInsertFunctionDialog,
    getInsertFunctionDialogState,
    getInsertFunctionDialogState,
  );
  const recent = useSyncExternalStore(
    subscribeRecentFormulaFunctions,
    getRecentFormulaFunctions,
    getRecentFormulaFunctionsServerSnapshot,
  );

  const [category, setCategory] = useState<FormulaCategoryFilter>(DEFAULT_CATEGORY);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  /**
   * Κάθε άνοιγμα ξεκινά **καθαρό**.
   *
   * Ένας διάλογος που θυμάται τον προηγούμενο όρο αναζήτησης θα άνοιγε δείχνοντας τα
   * αποτελέσματα μιας ερώτησης που ο χρήστης έκανε πριν από ώρες — και η «Πιο πρόσφατη
   * χρήση», που είναι ολόκληρος ο λόγος ύπαρξης της προεπιλογής, δεν θα φαινόταν ποτέ ξανά.
   * Η μνήμη που έχει νόημα εδώ είναι η MRU, και ζει σε δικό της store.
   */
  useEffect(() => {
    if (!state.open) return;
    setCategory(DEFAULT_CATEGORY);
    setQuery('');
    setSelected(null);
  }, [state.open]);

  /** Η μεταφρασμένη περιγραφή — `''` όταν δεν είναι τεκμηριωμένη (δες `documented`). */
  const describe = useCallback(
    (name: string): string => {
      const entry = FORMULA_CATALOG.find((item) => item.name === name);
      if (!entry?.documented) return '';
      return t(`table.insertFunction.help.${formulaCatalogKey(name)}`);
    },
    [t],
  );

  const entries = useMemo(
    () => queryFormulaCatalog({
      entries: FORMULA_CATALOG,
      category,
      query,
      recent,
      describe,
    }),
    [category, query, recent, describe],
  );

  /**
   * Η επιλογή πέφτει στην **πρώτη** εγγραφή όποτε η τρέχουσα φύγει από τη λίστα.
   *
   * Χωρίς αυτό, ένας όρος αναζήτησης που δεν περιέχει την επιλεγμένη θα άφηνε την υπογραφή και
   * την περιγραφή να δείχνουν μια συνάρτηση που **δεν φαίνεται πουθενά** στην οθόνη — και το
   * «OK» θα εισήγαγε εκείνη.
   */
  useEffect(() => {
    if (entries.length === 0) {
      setSelected(null);
      return;
    }
    setSelected((current) =>
      current !== null && entries.some((entry) => entry.name === current)
        ? current
        : entries[0].name,
    );
  }, [entries]);

  const finish = useCallback((): void => {
    closeInsertFunctionDialog();
    // Δες την κεφαλίδα: η ανάκτηση του πληκτρολογίου δεν είναι ευγένεια.
    restartTableCellCursorSession();
  }, []);

  const confirm = useCallback((): void => {
    if (selected === null) return;
    const cursor = getTableCellCursor();
    // Ο δρομέας μπορεί να έχει χαθεί όσο ήταν ανοιχτός ο διάλογος (π.χ. διαγράφηκε ο πίνακας
    // από άλλη διαδρομή). Τότε δεν υπάρχει πρόχειρο να γραφτεί και το μόνο σωστό είναι το
    // κλείσιμο — μια εγγραφή «στο πουθενά» θα σιωπούσε, που είναι χειρότερο από το να μη γίνει.
    if (cursor === null) {
      closeInsertFunctionDialog();
      return;
    }
    const inserted = insertFunctionCall({
      draft: cursor.mode === 'nav' ? '' : cursor.draft,
      caretIndex: state.caretIndex,
      functionName: selected,
    });
    setTableCellCursorDraftAt(inserted.draft, inserted.caretIndex);
    rememberFormulaFunction(selected);
    finish();
  }, [selected, state.caretIndex, finish]);

  useEscapeHandler({
    id: 'table-insert-function-dialog',
    priority: ESC_PRIORITY.BLOCKING_CONFIRM,
    canHandle: () => state.open,
    handle: () => {
      finish();
      return true;
    },
    // Ο εστιασμένος είναι `<textarea>` — δες την κεφαλίδα.
    allowWhenEditable: true,
  });

  if (!state.open || typeof document === 'undefined') return null;

  const signature = selected === null
    ? ''
    : `${selected}(${
      FORMULA_CATALOG.find((entry) => entry.name === selected)?.documented === true
        ? t(`table.insertFunction.args.${formulaCatalogKey(selected)}`)
        : t('table.insertFunction.unknownArgs')
    })`;

  const help = selected === null
    ? ''
    : (describe(selected) || t('table.insertFunction.undocumented'));

  return createPortal(
    <div className="dxf-modal-overlay">
      <InsertFunctionForm
        labels={{
          title: t('table.insertFunction.title'),
          searchLabel: t('table.insertFunction.searchLabel'),
          searchPlaceholder: t('table.insertFunction.searchPlaceholder'),
          go: t('table.insertFunction.go'),
          categoryLabel: t('table.insertFunction.categoryLabel'),
          listLabel: t('table.insertFunction.listLabel'),
          listAriaLabel: t('table.insertFunction.listAriaLabel'),
          ok: t('table.insertFunction.ok'),
          cancel: t('table.insertFunction.cancel'),
          close: t('table.insertFunction.close'),
          empty: t('table.insertFunction.empty'),
        }}
        categories={FORMULA_CATEGORY_FILTERS}
        categoryLabelOf={(item) => t(`table.insertFunction.category.${item}`)}
        category={category}
        onCategoryChange={setCategory}
        query={query}
        onQueryChange={setQuery}
        entries={entries}
        selected={selected}
        onSelect={setSelected}
        onConfirm={confirm}
        onCancel={finish}
        signature={signature}
        help={help}
      />
    </div>,
    document.body,
  );
};
