'use client';

/**
 * 🔴 ADR-739 §52 — **ο bridge των δύο contextual καρτελών πίνακα** ↔ `table-format-port`.
 *
 * ## 🔴 ΑΔΕΙΟΣ ΑΠΟ ΚΑΤΑΣΤΑΣΗ — ΚΑΘΕ ΑΝΑΓΝΩΣΗ ΡΩΤΑ ΤΗ ΘΥΡΑ
 * Δεν κρατά τίποτα: ούτε στόχο, ούτε στιγμιότυπο, ούτε αντίγραφο του πίνακα. Η μοναδική
 * συνδρομή είναι ο **αριθμός έκδοσης** της θύρας, δηλαδή ένα `number` που αλλάζει μόνο όταν
 * αλλάζει ο στόχος ή το μοντέλο (ποτέ ανά χαρακτήρα — δες `use-table-format-actions`).
 *
 * Ένα αντίγραφο κατάστασης εδώ θα ήταν δεύτερη αλήθεια δίπλα στο μοντέλο, που παλιώνει σε
 * κάθε `Ctrl+Z` — ακριβώς αυτό που τεκμηριώνει το `table-cell-cursor-store` για το κείμενο.
 *
 * ## Πώς φτάνει η αλλαγή στα widgets
 * Η έκδοση μπαίνει στο `useSyncExternalStore`, άρα αλλάζει η **ταυτότητα** του επιστρεφόμενου
 * bridge ⇒ ο `useRibbonCommands` ξαναχτίζει τους readers ⇒ το `RibbonFieldStore` ειδοποιεί ⇒
 * κάθε per-key leaf ξαναρωτά και η cache υπογραφής κόβει όσα δεν κουνήθηκαν. Καμία νέα
 * υποδομή: είναι ο **ίδιος** δρόμος με κάθε άλλον bridge (ADR-547 Stage 4).
 *
 * ## 🔴 `null` ΣΗΜΑΙΝΕΙ «ΜΕΙΚΤΟ», ΟΧΙ «ΑΓΝΩΣΤΟ»
 * Το `RibbonToggleState` είναι ήδη `boolean | null` με `null = mixed/indeterminate` — καμία
 * νέα σημασιολογία δεν εφευρίσκεται εδώ. Μεικτή επιλογή (μερικά κελιά έντονα) ⇒ `null` ⇒ το
 * κουμπί δείχνει indeterminate, όπως το Figma «Mixed» και το Revit «<varies>».
 *
 * Χωρίς θύρα (καμία συνεδρία πίνακα) όλα απαντούν αδρανώς: `false` / `null` / no-op. Ο bridge
 * συνθέτει με κάθε άλλον στον `useRibbonCommands` — δεν επιτρέπεται να διεκδικήσει ξένο κλειδί.
 *
 * @see ui/table-cell-editor/table-format-port.ts — η θύρα
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §52
 */

import { useSyncExternalStore } from 'react';
import {
  getTableFormatPort,
  getTableFormatRevision,
  subscribeTableFormatPort,
} from '../../table-cell-editor/table-format-port';
import {
  getTableStyleSnapshot,
  subscribeTableStyles,
} from '../../../bim/table/table-style-registry';
import { resolveStyleNameLabel } from '../../../systems/style-naming/style-name-label';
import {
  TABLE_FORMAT_RIBBON_KEYS,
  TABLE_FORMAT_TOGGLE_FIELD,
  TABLE_PROPERTIES_RIBBON_KEYS,
  isTableFormatActionKey,
  isTableFormatComboboxKey,
  isTableFormatToggleKey,
  isTablePropertiesActionKey,
  isTablePropertiesComboboxKey,
  isTablePropertiesVisibilityKey,
} from './bridge/table-format-command-keys';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';

export interface RibbonTableFormatBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (commandKey: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/** Το ίδιο σχήμα με κάθε άλλον bridge: κλειδί που δεν μου ανήκει ⇒ αδρανές. */
const NULL_TOGGLE: RibbonToggleState = false;

/** «Ένα σκαλί πάνω» / «ένα σκαλί κάτω» — δύο εντολές, ένα πεδίο κατεύθυνσης. */
const STEP_DIRECTION: Readonly<Record<string, 1 | -1>> = {
  [TABLE_FORMAT_RIBBON_KEYS.actions.sizeUp]: 1,
  [TABLE_FORMAT_RIBBON_KEYS.actions.sizeDown]: -1,
};

/** Ποια δομική εντολή σε ποιον άξονα και προς ποια πλευρά — δηλωτικά, ποτέ αλυσίδα `if`. */
const STRUCTURE_INSERT: Readonly<
  Record<string, { readonly axis: 'row' | 'column'; readonly side: 'before' | 'after' }>
> = {
  [TABLE_PROPERTIES_RIBBON_KEYS.actions.insertRowAbove]: { axis: 'row', side: 'before' },
  [TABLE_PROPERTIES_RIBBON_KEYS.actions.insertRowBelow]: { axis: 'row', side: 'after' },
  [TABLE_PROPERTIES_RIBBON_KEYS.actions.insertColumnLeft]: { axis: 'column', side: 'before' },
  [TABLE_PROPERTIES_RIBBON_KEYS.actions.insertColumnRight]: { axis: 'column', side: 'after' },
};

const STRUCTURE_DELETE: Readonly<Record<string, 'row' | 'column'>> = {
  [TABLE_PROPERTIES_RIBBON_KEYS.actions.deleteRow]: 'row',
  [TABLE_PROPERTIES_RIBBON_KEYS.actions.deleteColumn]: 'column',
};

/** Το ύψος σε sheet-mm όπως το γράφει το dropdown: «2.5», ποτέ «2.50». */
function formatHeight(mm: number): string {
  return Number.isInteger(mm) ? String(mm) : Number(mm.toFixed(3)).toString();
}

export function useRibbonTableFormatBridge(): RibbonTableFormatBridge {
  // Η **μόνη** συνδρομή στη θύρα: ένας ακέραιος. Δες την κεφαλίδα για το γιατί αρκεί.
  useSyncExternalStore(subscribeTableFormatPort, getTableFormatRevision, () => 0);
  // Και μία στο μητρώο στυλ: ένα νέο custom στυλ οφείλει να εμφανιστεί στο dropdown χωρίς
  // να χρειαστεί ο χρήστης να ξαναεπιλέξει τον πίνακα. Χαμηλής συχνότητας εξ ορισμού.
  useSyncExternalStore(subscribeTableStyles, getTableStyleSnapshot, getTableStyleSnapshot);

  const getComboboxState = (commandKey: string): RibbonComboboxState | null => {
    const port = getTableFormatPort();
    if (isTableFormatComboboxKey(commandKey)) {
      const mm = port?.textHeightMm() ?? null;
      // `null` = μεικτό, όπως και στα toggles: η κορδέλα δείχνει κενό πεδίο αντί να διαλέξει
      // αυθαίρετα μία από τις τρεις τιμές μιας σειράς τίτλου/κεφαλίδας/δεδομένων.
      return { value: mm === null ? null : formatHeight(mm), options: [] };
    }
    if (isTablePropertiesComboboxKey(commandKey)) {
      const { styles } = getTableStyleSnapshot();
      return {
        value: port?.structure.styleId() ?? null,
        // 🔴 §52.2 — «κλειδί ή κυριολεξία;» το απαντά ο ΕΝΑΣ κανόνας, ποτέ η επιφάνεια. Εδώ
        // έγραφε `isLiteralLabel: true` για κάθε στυλ, και τα built-in (που κρατούν κλειδί
        // i18n στο `name`) έβγαιναν ωμά στην οθόνη.
        options: styles.map((style) => ({ value: style.id, ...resolveStyleNameLabel(style) })),
      };
    }
    return null;
  };

  const onComboboxChange = (commandKey: string, value: string): void => {
    const port = getTableFormatPort();
    if (!port) return;
    if (isTableFormatComboboxKey(commandKey)) {
      const mm = Number.parseFloat(value);
      // Μη αριθμός ή μη θετικό ⇒ **καμία** εγγραφή. Ύψος `0` δεν είναι μικρό κείμενο, είναι
      // αόρατο — και ο χρήστης δεν θα καταλάβαινε γιατί άδειασε ο πίνακας.
      if (!Number.isFinite(mm) || mm <= 0) return;
      port.setField('textHeightMm', mm);
      return;
    }
    if (isTablePropertiesComboboxKey(commandKey)) port.structure.setStyleId(value);
  };

  const getToggleState = (commandKey: string): RibbonToggleState => {
    if (!isTableFormatToggleKey(commandKey)) return NULL_TOGGLE;
    const state = getTableFormatPort()?.state(TABLE_FORMAT_TOGGLE_FIELD[commandKey]);
    if (!state) return NULL_TOGGLE;
    return state.mixed ? null : state.value === true;
  };

  /**
   * ⚠️ Το `nextValue` **αγνοείται** επίτηδες, και δεν είναι παράλειψη.
   *
   * Η κορδέλα το υπολογίζει ως `!current` — αλλά σε **μεικτή** επιλογή το `current` είναι
   * `null` και το `!null` δίνει `true` κατά τύχη, όχι κατά κανόνα. Ο σωστός κανόνας («μεικτό
   * ⇒ όλα ναι») ζει **μέσα** στη θύρα, μαζί με την ανάγνωση που τον τροφοδοτεί — ένα σημείο,
   * κοινό με το mini toolbar. Δες `tableFormatCommands.toggle`.
   */
  const onToggle = (commandKey: string): void => {
    if (!isTableFormatToggleKey(commandKey)) return;
    getTableFormatPort()?.toggle(TABLE_FORMAT_TOGGLE_FIELD[commandKey]);
  };

  const onAction = (commandKey: string): void => {
    const port = getTableFormatPort();
    if (!port) return;
    if (isTableFormatActionKey(commandKey)) {
      if (commandKey === TABLE_FORMAT_RIBBON_KEYS.actions.reset) port.reset();
      else port.stepTextHeight(STEP_DIRECTION[commandKey]);
      return;
    }
    if (!isTablePropertiesActionKey(commandKey)) return;
    if (commandKey === TABLE_PROPERTIES_RIBBON_KEYS.actions.selectAll) {
      port.structure.selectAll();
      return;
    }
    // 🔴 ADR-767 Δ3 — **η μοναδική ρητή ενέργεια ανανέωσης.** Ο φύλακας «έχει δεσμό;» ζει
    // μέσα στη θύρα, όχι εδώ: το ίδιο κουμπί μπορεί αύριο να πατηθεί από άλλη επιφάνεια, και
    // ένας έλεγχος ανά επιφάνεια θα ήταν N ευκαιρίες να ξεχαστεί.
    if (commandKey === TABLE_PROPERTIES_RIBBON_KEYS.actions.refreshBinding) {
      port.binding.refresh();
      return;
    }
    const insert = STRUCTURE_INSERT[commandKey];
    if (insert) {
      port.structure.insertAxis(insert.axis, insert.side);
      return;
    }
    const axis = STRUCTURE_DELETE[commandKey];
    // Ο φύλακας πλήθους ρωτιέται **εδώ** και όχι μόνο μέσα: ο πίνακας δεν μένει ποτέ χωρίς
    // γραμμή ή στήλη, και μια μερική διαγραφή θα ήταν χειρότερη από καμία (§42).
    if (axis && port.structure.canDeleteAxis(axis)) port.structure.deleteAxis(axis);
  };

  /**
   * Τα δύο panels που ζουν **μόνο με δρομέα**. Δες `TABLE_PROPERTIES_RIBBON_KEYS.panels` για
   * το γιατί απόντα και όχι γκρίζα.
   */
  const getPanelVisibility = (visibilityKey: string): boolean => {
    if (!isTablePropertiesVisibilityKey(visibilityKey)) return true;
    // 🔴 ADR-767 — το «Δεδομένα» ρωτά **άλλη** ερώτηση από τα άλλα δύο panels: εκείνα θέλουν
    // δρομέα («ποιας γραμμής;»), αυτό θέλει **δεσμό**. Ένα κοινό `scope() != null` θα έκρυβε
    // το «Ανανέωση» σε σκέτη επιλογή δεμένου πίνακα — δηλαδή ακριβώς στη συνηθέστερη στιγμή
    // που ο χρήστης θέλει να το πατήσει.
    if (visibilityKey === TABLE_PROPERTIES_RIBBON_KEYS.panels.data) {
      return getTableFormatPort()?.binding.isBound() === true;
    }
    return getTableFormatPort()?.scope() != null;
  };

  return { onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility };
}
