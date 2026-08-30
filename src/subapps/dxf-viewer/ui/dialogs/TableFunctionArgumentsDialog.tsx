'use client';

/**
 * ADR-763 §16 — **ο διάλογος «Ορίσματα συνάρτησης» (Φάση 2)**: η καλωδίωση. Self-subscribing
 * portal, μηδέν props — ίδιο σχήμα με τη Φάση 1 και με τους υπόλοιπους διαλόγους του subapp.
 *
 * ## 🔴 ΤΙ ΔΕΝ ΚΑΝΕΙ ΤΟ ΚΛΕΙΣΙΜΟ ΤΗΣ ΦΑΣΗΣ 1
 * Η Φάση 1 κλείνει **χωρίς** `restartTableCellCursorSession()` όταν παραδίδει σε αυτόν τον
 * διάλογο. Η επανεκκίνηση φτιάχνει νέο `<textarea autoFocus>` για το κελί — δηλαδή θα
 * **έκλεβε** την εστίαση από το πρώτο κουτί ορίσματος μέσα στο ίδιο καρέ, και ο χρήστης θα
 * πληκτρολογούσε στο κελί ενώ κοιτά τον διάλογο. Η τύχη του πληκτρολογίου κρίνεται **μία**
 * φορά, όταν κλείσει ο **τελευταίος** διάλογος της αλυσίδας — εδώ.
 *
 * ## 🔴 ΚΑΙ ΤΑ ΔΥΟ ΚΟΥΜΠΙΑ ΤΟ ΚΡΙΝΟΥΝ, ΑΛΛΑ ΑΝΤΙΘΕΤΑ (Φ2.4.1)
 * | κουμπί | τι σημαίνει | τι κάνει |
 * |---|---|---|
 * | **OK** | «ο τύπος είναι έτοιμος» = `Enter` | **δεσμεύει** και βγαίνει σε πλοήγηση |
 * | **Άκυρο / `Esc` / `✕`** | «πάρ' το πίσω» | επαναφέρει **και** ξαναπιάνει το πληκτρολόγιο |
 *
 * Μέχρι τη Φ2.4.1 έκαναν **και τα δύο** `restartTableCellCursorSession()`, οπότε το «OK»
 * άφηνε το κελί σε **γραφή** και ο χρήστης έπρεπε να πατήσει *και* `Enter`. Το Excel βγαίνει.
 *
 * ## 🔴 ΤΟ MRU ΓΡΑΦΕΤΑΙ ΕΔΩ, ΟΧΙ ΣΤΗ ΦΑΣΗ 1
 * Η «Πιο πρόσφατη χρήση» απαντά στο «ποιες συναρτήσεις **χρησιμοποιεί** αυτός ο χρήστης».
 * Γραμμένη στο «OK» της Φάσης 1, θα κατέγραφε και κάθε εισαγωγή που ο χρήστης **ακύρωσε** στο
 * επόμενο βήμα — δηλαδή η λίστα των δέκα θα γέμιζε με συναρτήσεις που δεν μπήκαν ποτέ σε
 * κελί, και θα έσπρωχνε έξω εκείνες που μπήκαν.
 *
 * ## Το «Άκυρο» δεν είναι «σβήσε ό,τι πρόσθεσα»
 * Είναι **επαναφορά σε γνωστό σημείο** — δες `cancelFunctionArgumentsDialog`. Ο υπολογισμός
 * της αντίστροφης πράξης θα ήταν δεύτερη υλοποίηση της ευθείας, που πρέπει να μένει
 * συγχρονισμένη μαζί της για πάντα.
 *
 * @module subapps/dxf-viewer/ui/dialogs/TableFunctionArgumentsDialog
 * @see state/function-arguments-dialog-store.ts — η κατάσταση και ο ένας γραφέας
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §16
 */

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  useFloatingPanelGeometry,
  type FloatingPanelDimensions,
  type FloatingPanelId,
  type FloatingPanelPosition,
} from '@/components/ui/floating';
import { FunctionArgumentsForm } from './function-arguments-form';
import type { FunctionArgumentRow } from './function-argument-rows';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { formulaCatalogKey } from '../../bim/table/formula/catalog/formula-catalog-taxonomy';
import { formulaHelpUrl } from '../../bim/table/formula/catalog/formula-help-url';
import {
  argumentHelpIndex,
  resolveFormulaSignature,
  signatureRows,
} from '../../bim/table/formula/catalog/formula-signature';
import { FORMULA_CATALOG } from '../../bim/table/formula/catalog/formula-catalog';
import { filledArgumentCount } from '../../bim/table/formula/catalog/formula-call-text';
import { functionArgumentsPreview } from '../../bim/table/formula/catalog/formula-argument-preview';
import { drawingFormulaGrammar } from '../../bim/table/formula/table-formula-grammar';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { resolveTableById } from '../table-cell-editor/table-entity-lookup';
import {
  cancelFunctionArgumentsDialog,
  closeFunctionArgumentsDialog,
  collapsedFunctionArgumentIndex,
  getFunctionArgumentsDialogState,
  setActiveFunctionArgument,
  setFunctionArgumentValue,
  subscribeFunctionArgumentsDialog,
  toggleFunctionArgumentCollapse,
} from '../../state/function-arguments-dialog-store';
import { rememberFormulaFunction } from '../../state/formula-mru-store';
import {
  getTableCellCursor,
  requestTableCellCursorCommit,
} from '../../state/table-cell-cursor-store';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { TableModel } from '../../types/table';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

/** Ταυτότητα μόνιμης θέσης — σύμβαση `<subapp>.<panel>`, σταθερή για πάντα. */
const FN_ARGS_PANEL_ID: FloatingPanelId = 'dxf.function-arguments';

/**
 * Το ονομαστικό μέγεθος της κάρτας, για τον κανόνα ορίων ADR-030. Αντικατοπτρίζει το
 * `.dxf-fn-args-card` — αν αλλάξει το CSS, αλλάζει και εδώ.
 */
const FN_ARGS_CARD_SIZE: FloatingPanelDimensions = { width: 560, height: 400 };

const FN_ARGS_FALLBACK_POSITION: FloatingPanelPosition = { x: 140, y: 110 };

/**
 * Πού ανοίγει την πρώτη φορά: κεντραρισμένη οριζόντια, **χαμηλά** κατακόρυφα.
 *
 * Δεν είναι το κέντρο, και η διαφορά έχει λόγο: αυτός ο διάλογος υπάρχει για να **δείχνει ο
 * χρήστης κελιά** πίσω του. Κεντραρισμένος, σκεπάζει ακριβώς τη ζώνη όπου βρίσκεται συνήθως ο
 * πίνακας του σχεδίου — δηλαδή θα ζητούσε μετακίνηση πριν την πρώτη χρήση, κάθε φορά.
 */
function initialArgumentsPosition(): FloatingPanelPosition {
  return {
    x: Math.max(0, Math.round((window.innerWidth - FN_ARGS_CARD_SIZE.width) / 2)),
    y: Math.max(0, Math.round(window.innerHeight * 0.55)),
  };
}

/** Σταθερή αναφορά — το SSoT την κρατά σε πίνακα εξαρτήσεων effect. */
const FN_ARGS_DRAGGABLE_OPTIONS = { getClientPosition: initialArgumentsPosition };

export interface TableFunctionArgumentsDialogProps {
  /**
   * 🔴 ADR-763 Φ2.3 — **η μόνη prop, και υπάρχει για τη ζωντανή αποτίμηση.**
   *
   * Ο διάλογος έμεινε «self-subscribing portal, μηδέν props» όσο έδειχνε **κείμενα**. Το
   * `= 20` δίπλα σε κάθε όρισμα όμως απαιτεί το **μοντέλο** του πίνακα, δηλαδή τη σκηνή — και
   * η σκηνή δεν είναι store: ζει στον `LevelManager`. Ίδιο σχήμα με τους υπόλοιπους hosts του
   * `DxfViewerDialogs` (`ColumnDetailHost`, `MatchPropertiesDialogHost`, …).
   *
   * ⚠️ Διαβάζεται **τη στιγμή της απόδοσης** μέσω του ΕΝΟΣ `resolveTableById`, ποτέ
   * αποθηκευμένο: το `getLevelScene` ανανεώνεται ασύγχρονα και μια κρατημένη οντότητα
   * μπαγιατεύει χωρίς κανένα ορατό σημάδι (δες την κεφαλίδα του `table-entity-lookup`).
   */
  readonly levelManager: LevelManagerLike;
}

export const TableFunctionArgumentsDialog: React.FC<TableFunctionArgumentsDialogProps> = ({
  levelManager,
}) => {
  const { t } = useTranslation('dxf-viewer');
  const state = useSyncExternalStore(
    subscribeFunctionArgumentsDialog,
    getFunctionArgumentsDialogState,
    getFunctionArgumentsDialogState,
  );

  const { position, isDragging, handleMouseDown } = useFloatingPanelGeometry({
    isVisible: state.open,
    defaultPosition: FN_ARGS_FALLBACK_POSITION,
    defaultSize: FN_ARGS_CARD_SIZE,
    persistenceKey: FN_ARGS_PANEL_ID,
    draggableOptions: FN_ARGS_DRAGGABLE_OPTIONS,
  });

  const signature = useMemo(
    () => resolveFormulaSignature({
      name: state.functionName,
      argumentNames: argumentNamesFor(t, state.functionName),
      genericName: t('table.functionArguments.genericArgument'),
    }),
    [t, state.functionName],
  );

  // Οι σειρές είναι **παράγωγο** του «πόσα κουτιά είναι σε χρήση» — καμία κατάσταση «πόσες
  // έδειξα». Δες `signatureRows`: η ιδεμποτία είναι ο λόγος που το άνοιγμα, η αλλαγή
  // συνάρτησης και η αναίρεση δεν χρειάστηκαν ούτε μία γραμμή μηδενισμού.
  const specs = useMemo(
    () => signatureRows(signature, filledArgumentCount(state.values)),
    [signature, state.values],
  );

  /**
   * 🔴 Φ2.3 — η αποτίμηση ξαναγίνεται σε **κάθε** απόδοση, δηλαδή σε κάθε πληκτρολόγηση και σε
   * κάθε κλικ υπόδειξης. Δεν απομνημονεύεται με κλειδί το μοντέλο, και είναι απόφαση: το κόστος
   * είναι O(μήκος τύπου) πάνω σε ήδη απομνημονευμένο (WeakMap) μοντέλο, ενώ ένα memo θα
   * χρειαζόταν **ερώτημα ακύρωσης** — και η μία φορά που θα αστοχούσε, ο χρήστης θα έβλεπε το
   * αποτέλεσμα ενός τύπου που δεν γράφει πια.
   */
  const preview = useMemo(
    () => functionArgumentsPreview({
      model: resolveCursorTableModel(levelManager),
      functionName: state.functionName,
      frame: state.frame,
      values: state.values,
      separator: drawingFormulaGrammar().argumentSeparator,
    }),
    [levelManager, state.functionName, state.frame, state.values],
  );

  const rows = useMemo<readonly FunctionArgumentRow[]>(
    () => specs.map((spec, index) => ({
      name: spec.name,
      required: spec.requirement === 'required',
      kindLabel: t(`table.functionArguments.kind.${spec.kind}`),
      value: state.values[index] ?? '',
      preview: preview.perArgument[index],
    })),
    [specs, state.values, preview, t],
  );

  const confirm = useCallback((): void => {
    // Δες την κεφαλίδα: το MRU γράφεται **εδώ**, όχι στη Φάση 1 — μια εισαγωγή που ακυρώθηκε
    // δεν χρησιμοποιήθηκε ποτέ. Το όνομα διαβάζεται τη στιγμή της κλήσης και όχι από το
    // render snapshot: το κλείσιμο ακολουθεί αμέσως, και δύο αναγνώσεις της ίδιας ταυτότητας
    // σε δύο χρόνους είναι το σχήμα που έχει ήδη δαγκώσει αλλού στο subapp.
    rememberFormulaFunction(getFunctionArgumentsDialogState().functionName);
    closeFunctionArgumentsDialog();
    // 🔴 ADR-763 Φ2.4.1 — **ΤΟ «OK» ΕΙΝΑΙ `Enter`, ΟΧΙ ΕΠΑΝΑΦΟΡΑ ΕΣΤΙΑΣΗΣ.**
    //
    // Εδώ έγραφε `restartTableCellCursorSession()` με αιτιολογία «η ανάκτηση του πληκτρολογίου
    // γίνεται μία φορά, στο τέλος της αλυσίδας». Η αιτιολογία ήταν σωστή για το «Άκυρο» και
    // **λάθος** για το «OK»: εκείνο ξαναστήνει το `<textarea autoFocus>`, δηλαδή το κελί έμενε
    // **σε γραφή** και ο χρήστης έπρεπε να πατήσει *και* `Enter` (αναφορά Giorgio 06/08 —
    // «κλείνει το παράθυρο αλλά το D3 παραμένει σε edit mode· η Excel βγαίνει»).
    //
    // Τα δύο μοιάζουν και είναι **αντίθετα**: το `restart` ξαναπιάνει το πληκτρολόγιο, το
    // «OK» το **παραδίδει**. Η δέσμευση δεν γίνεται εδώ — χτίζει εντολή αναίρεσης πάνω στη
    // ζωντανή σκηνή, και ιδιοκτήτης της είναι ο **ένας** δεσμευτής που εξυπηρετεί ήδη το
    // `Enter`. Εδώ δηλώνεται μόνο η **πρόθεση**.
    requestTableCellCursorCommit();
  }, []);

  /**
   * ⚠️ Καμία επανεκκίνηση συνεδρίας εδώ, και **δεν** είναι παράλειψη: το
   * `cancelFunctionArgumentsDialog` κάνει ήδη τη σωστή ανάκτηση για **κάθε** κλάδο επαναφοράς
   * (§15) — η πλοήγηση την παίρνει δωρεάν από το `cancelTableCellCursorSession`, η γραφή ρητά.
   * Ένα δεύτερο `restart` εδώ θα ήταν επιπλέον commit πάνω στο πρώτο, δηλαδή δεύτερο render
   * για μηδέν αλλαγή, στην πιο συχνή διαδρομή του διαλόγου.
   */
  const cancel = useCallback((): void => {
    cancelFunctionArgumentsDialog();
  }, []);

  useEscapeHandler({
    id: 'table-function-arguments-dialog',
    priority: ESC_PRIORITY.BLOCKING_CONFIRM,
    canHandle: () => state.open,
    handle: () => {
      cancel();
      return true;
    },
    // Ο εστιασμένος είναι κουτί ορίσματος — ίδιος λόγος με τη Φάση 1.
    allowWhenEditable: true,
  });

  if (!state.open || typeof document === 'undefined') return null;

  const helpKey = argumentHelpIndex(signature, state.activeIndex);
  const activeSpec = specs[state.activeIndex];

  return createPortal(
    <FunctionArgumentsForm
      frame={{ position, isDragging, onDragStart: handleMouseDown }}
      labels={{
        title: t('table.functionArguments.title'),
        close: t('table.insertFunction.close'),
        ok: t('table.insertFunction.ok'),
        cancel: t('table.insertFunction.cancel'),
        result: t('table.functionArguments.result'),
        helpLink: t('table.functionArguments.helpLink'),
        noArguments: t('table.functionArguments.noArguments'),
        toggle: {
          collapse: t('table.functionArguments.collapseAriaLabel'),
          expand: t('table.functionArguments.expandAriaLabel'),
        },
      }}
      functionName={state.functionName}
      rows={rows}
      activeIndex={state.activeIndex}
      collapsedIndex={collapsedFunctionArgumentIndex(state)}
      onValueChange={setFunctionArgumentValue}
      onFocus={setActiveFunctionArgument}
      onToggleCollapse={toggleFunctionArgumentCollapse}
      description={describeFunction(t, state.functionName)}
      activeArgumentName={activeSpec?.name ?? ''}
      activeArgumentHelp={helpKey === null
        ? ''
        : t(`table.functionArguments.argHelp.${formulaCatalogKey(state.functionName)}.${helpKey}`)}
      callPreview={preview.call}
      resultPreview={preview.result}
      helpHref={formulaHelpUrl(state.functionName)}
      onConfirm={confirm}
      onCancel={cancel}
      canConfirm={requiredArgumentsFilled(specs, state.values)}
    />,
    document.body,
  );
};

/**
 * Το μοντέλο του πίνακα που επεξεργάζεται ο δρομέας, **τη στιγμή της κλήσης** — `null` όταν
 * δεν υπάρχει δρομέας ή ο πίνακας χάθηκε από τη σκηνή.
 *
 * Δύο ΕΝΑ βήματα, κανένα δικό μας: το `resolveTableById` (ο ένας εντοπισμός) και το
 * `resolveTableModel` (η μία απομνημονευμένη αποσειριοποίηση, WeakMap). Μια δεύτερη διαδρομή
 * εδώ θα σήμαινε ότι ο διάλογος αποτιμά πάνω σε **άλλο** μοντέλο από αυτό που ζωγραφίζεται.
 */
function resolveCursorTableModel(levelManager: LevelManagerLike): TableModel | null {
  const cursor = getTableCellCursor();
  if (cursor === null) return null;
  const entity = resolveTableById(levelManager, cursor.entityId);
  return entity ? resolveTableModel(activeTableModel(entity)) : null;
}

/** Η αποθηκευμένη μεταφρασμένη υπογραφή, ή `''` για τις μη τεκμηριωμένες. */
function argumentNamesFor(t: (key: string) => string, name: string): string {
  if (name === '') return '';
  const entry = FORMULA_CATALOG.find((item) => item.name === name);
  if (entry?.documented !== true) return '';
  return t(`table.insertFunction.args.${formulaCatalogKey(name)}`);
}

/** Τι κάνει η συνάρτηση — ίδιος φρουρός `documented` με τη Φάση 1. */
function describeFunction(t: (key: string) => string, name: string): string {
  if (name === '') return '';
  const entry = FORMULA_CATALOG.find((item) => item.name === name);
  if (entry?.documented !== true) return '';
  return t(`table.insertFunction.help.${formulaCatalogKey(name)}`);
}

/**
 * Το «OK» φρουρεί **μόνο** ό,τι ξέρουμε με βεβαιότητα ότι είναι υποχρεωτικό.
 *
 * Το `unspecified` περνά χωρίς έλεγχο, και αυτό είναι η ίδια δέσμευση με το `named: false`:
 * ένας φρουρός πάνω σε πληροφορία που δεν έχουμε θα μπλόκαρε τον χρήστη από το να γράψει
 * **σωστό** τύπο, με μήνυμα που θα ήταν εικασία.
 */
function requiredArgumentsFilled(
  specs: readonly { readonly requirement: string }[],
  values: readonly string[],
): boolean {
  return specs.every(
    (spec, index) => spec.requirement !== 'required' || (values[index] ?? '') !== '',
  );
}
