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
 * Και **παραδίδει στη Φάση 2** (`TableFunctionArgumentsDialog`): αυτός ο διάλογος απαντά στο
 * «ποια συνάρτηση;», ο επόμενος στο «με τι ορίσματα;». Τι **δεν** κάνει το «OK» — και γιατί
 * η παράλειψη είναι σκόπιμη και στα δύο σημεία — είναι γραμμένο πάνω από το `confirm`.
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
 * ## 🔵 ΓΙΑΤΙ ΑΙΩΡΟΥΜΕΝΟΣ ΚΑΙ ΟΧΙ MODAL (ADR-763 §18)
 * Ο διάλογος μιλά για το **κελί που βρίσκεται από πίσω του**: ο χρήστης θέλει να δει το εύρος
 * που θα γίνει όρισμα ενώ διαλέγει τη συνάρτηση. Ένα κεντραρισμένο overlay με σκίαση κάνει
 * ακριβώς το αντίθετο — σκεπάζει το αντικείμενο της συζήτησης και δεν μετακινείται. Άρα δεν
 * είναι dialog με τη στενή έννοια· είναι **παλέτα** (δες τη σύγκριση στο `FloatingPanel`).
 *
 * Η γεωμετρία **δεν** υλοποιείται εδώ: έρχεται από το SSoT `useFloatingPanelGeometry`
 * (ADR-723), το ίδιο που κινεί τις 17 παλέτες. Δωρεάν μαζί της έρχονται ο κανόνας ορίων
 * ADR-030 (η κάρτα δεν μπορεί δομικά να χαθεί εκτός οθόνης), η διάσωση σε `resize` παραθύρου,
 * και η **μνήμη θέσης** ανά χρήστη. Δεν χρησιμοποιείται το `<FloatingPanel>` component: θα
 * έφερνε `<Card>` + Tailwind επικεφαλίδα, δηλαδή θα διέλυε το 1:1 με το Excel που είναι
 * ολόκληρη η προδιαγραφή του §9. Καταναλώνεται το **hook** — η κατάσταση, όχι η απόδοση.
 *
 * ⚠️ Το `elementRef` του hook αγνοείται σκόπιμα: κανένας από τους δύο μηχανισμούς (`useDraggable`
 * / `useResizable`) δεν το διαβάζει, και ο τύπος του (`RefObject<HTMLDivElement>`) δεν δένεται
 * σε `<section>`. Δέσιμο θα απαιτούσε ή `div` περιτύλιγμα (N.4) ή χαλάρωση τύπου (N.2).
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
import {
  useFloatingPanelGeometry,
  type FloatingPanelDimensions,
  type FloatingPanelId,
  type FloatingPanelPosition,
} from '@/components/ui/floating';
import { InsertFunctionForm } from './insert-function-form';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { FORMULA_CATALOG } from '../../bim/table/formula/catalog/formula-catalog';
import { queryFormulaCatalog } from '../../bim/table/formula/catalog/formula-catalog-search';
import { insertFunctionCall } from '../../bim/table/formula/catalog/formula-insert-text';
import { formulaCallFrameFromInsert } from '../../bim/table/formula/catalog/formula-call-text';
import { openFunctionArgumentsDialog } from '../../state/function-arguments-dialog-store';
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
  subscribeRecentFormulaFunctions,
} from '../../state/formula-mru-store';
import {
  formatSignature,
  resolveFormulaSignature,
} from '../../bim/table/formula/catalog/formula-signature';
import { drawingFormulaGrammar } from '../../bim/table/formula/table-formula-grammar';
import {
  getTableCellCursor,
  restartTableCellCursorSession,
  setTableCellCursorDraftAt,
} from '../../state/table-cell-cursor-store';

/** Η κατηγορία με την οποία ανοίγει ο διάλογος — η προεπιλογή του Excel. */
const DEFAULT_CATEGORY: FormulaCategoryFilter = 'recent';

/**
 * Ταυτότητα μόνιμης θέσης. Σύμβαση `<subapp>.<panel>` — **σταθερή για πάντα**: αλλαγή της
 * ισοδυναμεί με «ξέχασε πού την είχε βάλει κάθε χρήστης».
 */
const INSERT_FN_PANEL_ID: FloatingPanelId = 'dxf.insert-function';

/**
 * Το ονομαστικό μέγεθος της κάρτας. Δεν **επιβάλλεται** (το `resizable` μένει κλειστό και το
 * ύψος το δίνει το περιεχόμενο) — τροφοδοτεί μόνο τον κανόνα ορίων: χωρίς αυτό, ο κανόνας
 * «μένουν 40px να πιαστεί» θα κρινόταν με το προεπιλεγμένο 320×400 του SSoT και η κάρτα θα
 * μπορούσε να βγει 140px παραπάνω αριστερά απ' όσο επιτρέπεται.
 *
 * ⚠️ Οι τιμές αντικατοπτρίζουν το `.dxf-insert-fn-card` (πλάτος 460px) και το άθροισμα των
 * σταθερών υψών των τμημάτων του. Αν αλλάξει το CSS, αλλάζει και εδώ.
 */
const INSERT_FN_CARD_SIZE: FloatingPanelDimensions = { width: 460, height: 430 };

/** Έσχατο καταφύγιο: ισχύει μόνο πριν μετρηθεί το παράθυρο (SSR / πρώτο frame). */
const INSERT_FN_FALLBACK_POSITION: FloatingPanelPosition = { x: 120, y: 90 };

/**
 * Πού ανοίγει την **πρώτη** φορά: κεντραρισμένη, δηλαδή ακριβώς εκεί που την τοποθετούσε το
 * overlay που αντικαταστάθηκε. Είναι *αρχική τοποθέτηση*, όχι κανόνας — μόλις ο χρήστης τη
 * μετακινήσει, η αποθηκευμένη θέση υπερισχύει (δες `useFloatingPanelGeometry`).
 *
 * Ορίζεται σε επίπεδο module ώστε η αναφορά να είναι σταθερή: το SSoT την κρατά σε πίνακα
 * εξαρτήσεων effect, και ένα νέο literal σε κάθε render θα το ξανάναβε αδιάκοπα.
 */
function centeredInsertFunctionPosition(): FloatingPanelPosition {
  return {
    x: Math.max(0, Math.round((window.innerWidth - INSERT_FN_CARD_SIZE.width) / 2)),
    y: Math.max(0, Math.round((window.innerHeight - INSERT_FN_CARD_SIZE.height) / 2)),
  };
}

/** Σταθερή αναφορά, για τον λόγο που εξηγεί το {@link centeredInsertFunctionPosition}. */
const INSERT_FN_DRAGGABLE_OPTIONS = {
  getClientPosition: centeredInsertFunctionPosition,
};

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

  // Δες την κεφαλίδα: η θέση είναι δανεισμένη από το SSoT των παλετών, όχι υλοποιημένη εδώ.
  // Καλείται άνευ όρων — τα hooks δεν επιτρέπεται να εξαρτηθούν από το `state.open`, και το
  // SSoT είναι ήδη ήσυχο όταν δεν συμβαίνει χειρονομία.
  const { position, isDragging, handleMouseDown } = useFloatingPanelGeometry({
    isVisible: state.open,
    defaultPosition: INSERT_FN_FALLBACK_POSITION,
    defaultSize: INSERT_FN_CARD_SIZE,
    persistenceKey: INSERT_FN_PANEL_ID,
    draggableOptions: INSERT_FN_DRAGGABLE_OPTIONS,
  });

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

  /**
   * 🔴 **Η Φάση 2 φορτώνεται ΤΩΡΑ, όχι όταν χρειαστεί** — και δεν είναι βελτιστοποίηση ταχύτητας.
   *
   * Ο επόμενος διάλογος είναι `React.lazy`, και ανοίγει από το **κλείσιμο αυτού εδώ**. Αν το
   * chunk του δεν έχει φτάσει, ανάμεσα στα δύο μονταρίσματα παρεμβάλλεται ένα `Suspense`: η
   * εστίαση πέφτει στο `document.body`, ο δομικός φύλακας `isTextEntryTarget` απαντά `false`,
   * και οι **43** window listeners ξυπνούν πάνω σε έναν χρήστη που κοιτά διάλογο — ένα `Delete`
   * εκείνη τη στιγμή σβήνει **οντότητα** (§10). Ο χρήστης περνά δευτερόλεπτα ψάχνοντας συνάρτηση
   * σε αυτόν τον διάλογο· είναι όσος χρόνος χρειάζεται, και είναι ήδη δικός μας.
   *
   * Το `import()` είναι ιδεμποτές (το module registry κάνει cache) και το `void` δηλώνει ρητά
   * ότι κανείς δεν περιμένει το αποτέλεσμα: αν η φόρτωση αποτύχει, το `Suspense` του mount θα
   * ξαναπροσπαθήσει όπως θα έκανε ούτως ή άλλως.
   */
  useEffect(() => {
    if (!state.open) return;
    void import('./TableFunctionArgumentsDialog');
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

  /**
   * Το «OK» **παραδίδει στη Φάση 2** — δεν τελειώνει την εντολή.
   *
   * ## 🔴 Δύο πράγματα που ΔΕΝ γίνονται εδώ, και κανένα δεν είναι παράλειψη
   * 1. **Καμία επανεκκίνηση συνεδρίας.** Το `finish()` ξαναστήνει το `<textarea autoFocus>`
   *    του κελιού· καλεσμένο εδώ, θα **έκλεβε** την εστίαση από το πρώτο κουτί ορίσματος μέσα
   *    στο ίδιο καρέ, και ο χρήστης θα πληκτρολογούσε στο κελί ενώ κοιτά τον διάλογο. Το
   *    πληκτρολόγιο επιστρέφει όταν κλείσει ο **τελευταίος** διάλογος της αλυσίδας.
   * 2. **Κανένα `rememberFormulaFunction`.** Η «Πιο πρόσφατη χρήση» απαντά στο «τι
   *    χρησιμοποιεί αυτός ο χρήστης» — μια εισαγωγή που θα ακυρωθεί στο επόμενο βήμα δεν
   *    χρησιμοποιήθηκε ποτέ. Γράφεται στο «OK» της Φάσης 2.
   *
   * Το σημείο επαναφοράς μαζεύεται **εδώ**, γιατί είναι η τελευταία στιγμή που το «πριν»
   * υπάρχει: αμέσως μετά, το κελί περιέχει `=ΟΝΟΜΑ()`.
   */
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
    const navigating = cursor.mode === 'nav';
    const inserted = insertFunctionCall({
      draft: navigating ? '' : cursor.draft,
      caretIndex: state.caretIndex,
      functionName: selected,
    });
    setTableCellCursorDraftAt(inserted.draft, inserted.caretIndex);
    closeInsertFunctionDialog();
    openFunctionArgumentsDialog({
      functionName: selected,
      frame: formulaCallFrameFromInsert(inserted),
      restore: navigating
        ? { kind: 'navigation' }
        : { kind: 'draft', draft: cursor.draft, caretIndex: state.caretIndex ?? cursor.draft.length },
    });
  }, [selected, state.caretIndex]);

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

  // 🔴 ADR-763 §13 — η υπογραφή **συντίθεται**, δεν τυπώνεται αυτούσια από τη μετάφραση.
  // Η αποθηκευμένη συμβολοσειρά χωρίζει τα ονόματα με `;` ως **μορφή αποθήκευσης**· ο
  // διαχωριστής που βλέπει ο χρήστης τον ορίζει η γραμματική του σχεδίου (ADR-761) και είναι
  // `;` **ή** `,` ανάλογα με το locale. Τυπωμένη αυτούσια, η γραμμή αυτή ήταν **δεύτερη
  // αυθεντία διαχωριστή**: σήμερα οι δύο συμπίπτουν, και την ημέρα που θα αποκλίνουν ο
  // διάλογος θα **έδειχνε** `SUM(αριθμός1;…)` ενώ ο τύπος θα **απαιτούσε** κόμμα — λάθος
  // οδηγία μέσα στο ίδιο παράθυρο που τη διδάσκει.
  const signature = selected === null ? '' : formatSignature(
    resolveFormulaSignature({
      name: selected,
      argumentNames: FORMULA_CATALOG.find((entry) => entry.name === selected)?.documented === true
        ? t(`table.insertFunction.args.${formulaCatalogKey(selected)}`)
        : '',
      genericName: t('table.functionArguments.genericArgument'),
    }),
    drawingFormulaGrammar().argumentSeparator,
  );

  const help = selected === null
    ? ''
    : (describe(selected) || t('table.insertFunction.undocumented'));

  // Καμία `.dxf-modal-overlay`: η σκίαση **είναι** η modality. Η κάρτα μπαίνει απευθείας στο
  // portal και τοποθετείται μόνη της (δες την κεφαλίδα).
  return createPortal(
    <InsertFunctionForm
      frame={{ position, isDragging, onDragStart: handleMouseDown }}
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
    />,
    document.body,
  );
};
