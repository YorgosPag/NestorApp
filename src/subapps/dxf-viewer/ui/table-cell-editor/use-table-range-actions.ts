'use client';

/**
 * ADR-739 Φ.Δ βήμα 8 — **οι ενέργειες της περιοχής**: επέκταση, επιλογή όλων, άδειασμα,
 * αντιγραφή, αποκοπή, επικόλληση.
 *
 * ## Γιατί ξεχωριστό αρχείο και όχι μέσα στον `useTableCellDoubleClickEditor`
 * Ο ανοιχτήρας είναι ήδη **450 γραμμές** — το όριο του N.7.1 είναι 500. Πέντε ακόμη
 * χειριστές θα τον έσπρωχναν έξω και θα ανάγκαζαν έναν βιαστικό διαχωρισμό αργότερα, στη
 * χειρότερη στιγμή. Και ο διαχωρισμός είναι ούτως ή άλλως **σημασιολογικός**: εκείνος ξέρει
 * «ποιο κελί, πού, με τι όψη»· αυτός εδώ ξέρει «ποια κελιά και τι τους κάνω».
 *
 * ## 🔴 ΓΙΑΤΙ ΤΟ ΠΡΟΧΕΙΡΟ ΔΕΝ ΠΕΡΝΑ ΑΠΟ ΠΛΗΚΤΡΑ
 * Το `Ctrl+C`/`Ctrl+V`/`Ctrl+X` **δεν** αναγνωρίζονται ως `keydown`. Ο browser εκπέμπει ήδη
 * πραγματικά συμβάντα `copy`/`cut`/`paste` πάνω στο εστιασμένο `<textarea>` της συνεδρίας,
 * με έτοιμο `clipboardData`. Αυτό είναι καλύτερο σε **τέσσερα** μέτωπα ταυτόχρονα, και το
 * καθένα τους θα ήταν από μόνο του αρκετό:
 *
 *  1. **Καμία άδεια, καμία χειρονομία.** Το `navigator.clipboard.readText()` απαιτεί άδεια
 *     και user gesture, και σε ορισμένα περιβάλλοντα απλώς απορρίπτεται. Το `clipboardData`
 *     του συμβάντος δουλεύει πάντα, γιατί **είναι** η χειρονομία.
 *  2. **Κάθε διάταξη πληκτρολογίου.** Σε **ελληνική** διάταξη το `Ctrl+C` έχει `key: 'ψ'`
 *     και το `Ctrl+V` `key: 'ω'`. Ένας έλεγχος χαρακτήρα θα δούλευε μόνο σε λατινική — το
 *     ίδιο μάθημα που κωδικοποιεί ήδη το `undoRedoIntent` με το `event.code`.
 *  3. **Ό,τι έχει το πρόχειρο, όχι ό,τι νομίζουμε.** Το Excel γεμίζει `text/html` **και**
 *     `text/plain` (TSV)· εμείς διαβάζουμε το δεύτερο απευθείας από την πηγή.
 *  4. **Το ποντίκι δουλεύει δωρεάν.** Δεξί κλικ → «Επικόλληση» εκπέμπει το ίδιο συμβάν.
 *
 * Η **απόφαση** ποιος κατέχει το πρόχειρο σε κάθε κατάσταση δεν ζει εδώ: ζει στο
 * {@link tableClipboardScope}, δίπλα σε κάθε άλλη απόφαση πλήκτρου του πίνακα.
 *
 * ## Ιδιοκτησία πλήκτρων — τίποτα δεν διεκδικείται με `if`
 * Ο `useDxfToolbarShortcuts` παραιτείται από **κάθε** συντόμευση όταν ο στόχος του συμβάντος
 * είναι `INPUT`/`TEXTAREA` (πρώτες γραμμές του `handleKeyDown` του). Άρα όσο η συνεδρία
 * κελιού είναι εστιασμένη, τα `Ctrl+A/C/V` **δεν φτάνουν ποτέ** στον καμβά — ούτε «επιλογή
 * όλων των οντοτήτων», ούτε «πρόχειρο οντοτήτων» (ADR-466). Η ιδιοκτησία είναι **δομική**,
 * όχι δηλωμένη.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-range-actions
 * @see bim/table/table-cell-range.ts — ποια κελιά είναι μέσα (καθαρό)
 * @see bim/table/table-range-clipboard.ts — τι τους κάνω (καθαρό)
 * @see lib/spreadsheet/tsv.ts — η σειριοποίηση (SSoT)
 */

import { useCallback, useMemo, type ClipboardEvent } from 'react';
// ⚠️ ADR-739 §57 — **καμία μετάφραση και καμία ειδοποίηση εδώ πλέον.** Το μοναδικό μήνυμα που
// έστελνε αυτό το αρχείο («το πρόχειρο δεν περιέχει κείμενο») μετακόμισε στον ΕΝΑ εφαρμοστή
// (`use-table-paste-apply.ts`), μαζί με τα υπόλοιπα τέσσερα. Ο κανόνας είναι ο ίδιος με το §54:
// οι διαδρομές επικόλλησης οφείλουν να λένε **τα ίδια**, και ο μόνος τρόπος να μην αποκλίνουν
// είναι να μην έχουν τι να πουν μόνες τους.
// 🔴 ADR-739 §48.12 — **ο ΕΝΑΣ ορισμός** του «ποια περιοχή εννοεί ο χρήστης τώρα», κοινός με
// τον ζωγράφο. Δες το `currentBounds` παρακάτω για το γιατί έπρεπε να είναι κυριολεκτικά ο ίδιος.
import { tableEffectiveRangeBounds } from '../../bim/table/table-effective-range';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { useTableModelCommit } from './use-table-model-commit';
import {
  extendTableCellRangeEnd,
  extendTableSelectionTo,
  resolveTableSelectionBounds,
  tableRangeSize,
  type TableCellRangeBounds,
  type TableCellRef,
} from '../../bim/table/table-cell-range';
// 🔴 ADR-739 §43 — ο ΕΝΑΣ γραφέας του «επίλεξε τα πάντα»: τρεις πόρτες, μία εντολή.
import { selectWholeTable } from './table-select-all-action';
// 🔴 ADR-739 §54 — η **σειριοποίηση** ζει στην καθαρή στοίβα, όχι εδώ: το μενού δεξιού κλικ
// κάνει την ίδια μετατροπή χωρίς `ClipboardEvent`, και δύο σειριοποιητές TSV θα σήμαιναν δύο
// απαντήσεις στο «πώς κωδικοποιείται κελί με στηλοθέτη μέσα του».
import {
  clearTableRange,
  tableRangeToClipboardText,
} from '../../bim/table/table-range-clipboard';
// 🔴 ADR-739 §57 — το εσωτερικό πρόχειρο. Το `Ctrl+C`/`Ctrl+V` **οφείλει** να το γεμίζει και να
// το διαβάζει όπως το κουμπί της κορδέλας: αλλιώς η ίδια αντιγραφή θα έδινε τύπους και μορφή από
// το ποντίκι και γυμνές τιμές από το πληκτρολόγιο, από **το ίδιο** αντίγραφο.
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import { captureTableClipboard } from '../../bim/table/table-clipboard-payload';
import { resolveTablePasteSource } from '../../bim/table/table-clipboard-resolve';
import { FULL_TABLE_PASTE } from '../../bim/table/table-clipboard-paste';
import { getTableClipboard, setTableClipboard } from '../../state/table-clipboard-store';
import { useTablePasteApply } from './use-table-paste-apply';
import type { TableCursorMove } from '../../bim/table/table-cell-navigation';
import {
  setTableCellSelection,
  type TableCellCursorState,
} from '../../state/table-cell-cursor-store';
// 🔴 ADR-739 §48 — τα «μυρμήγκια» της αντιγραμμένης περιοχής (Excel parity). **Ένα** σημείο
// γραφής, στο `onCopy`· δες εκεί γιατί όχι στην αποκοπή.
import { setTableCopyMarquee } from '../../state/table-copy-marquee-store';
import { tableClipboardScope } from './table-cell-key-intent';
import type { TableEntity } from '../../types/table-entity';
import type { ICommand } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import { tableEntityFormulaBook } from '../../bim/table/table-worksheet-book';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

export interface UseTableRangeActionsParams {
  readonly cursor: TableCellCursorState | null;
  /** Η **ζωντανή** οντότητα, ήδη διαβασμένη από τον καλούντα — καμία δεύτερη ανάγνωση σκηνής. */
  readonly entity: TableEntity | null;
  readonly levelManager: LevelManagerLike;
  readonly execute: (command: ICommand) => void;
}

export interface TableRangeActions {
  /** `Shift + βέλος/Home/End` — μεγαλώνει την περιοχή· το ενεργό κελί δεν κουνιέται. */
  readonly extend: (move: TableCursorMove) => void;
  /**
   * `Shift + κλικ` — η περιοχή απλώνεται από το **ενεργό κελί** ως αυτό που δείχτηκε.
   *
   * Δεύτερη γωνία, όχι μετακίνηση: το ενεργό κελί μένει εκεί που ήταν, ακριβώς όπως στο
   * `Shift+βέλος`. Ίδιο με Excel και Sheets.
   */
  readonly selectTo: (cell: TableCellRef) => void;
  /** `Ctrl+A` — όλα τα κελιά **αυτού** του πίνακα. */
  readonly selectAll: () => void;
  /** `Delete` / `Backspace` — αδειάζει **όλη** την περιοχή, με ένα undo. */
  readonly clearSelection: () => void;
  readonly onCopy: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onCut: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLElement>) => void;
}

// ⚠️ ADR-739 §54 — η σημαία «το είπαμε μία φορά» και η **αναφορά** της επικόλλησης μετακόμισαν
// στο `use-table-paste-report.ts`: η δεύτερη διαδρομή επικόλλησης (μενού δεξιού κλικ) οφείλει
// να λέει τα ίδια μηνύματα **και** να μοιράζεται το «μία φορά ανά σελίδα».

export function useTableRangeActions(params: UseTableRangeActionsParams): TableRangeActions {
  const { cursor, entity, levelManager, execute } = params;

  /**
   * Τα τρέχοντα όρια της επιλογής, **τη στιγμή της κλήσης**.
   *
   * Χωρίς επιλογή επιστρέφει το ορθογώνιο του **ενεργού κελιού** — που δεν είναι πάντα
   * ένα κελί: σε συγχώνευση το κούμπωμα το ανοίγει σε ολόκληρη. Γι' αυτό δεν υπάρχει
   * ξεχωριστός κλάδος «χωρίς περιοχή»: το ίδιο ερώτημα, η ίδια απάντηση.
   */
  const currentBounds = useCallback((): TableCellRangeBounds | null => {
    if (!cursor || !entity) return null;
    const model = resolveTableModel(activeTableModel(entity));
    // 🔴 ADR-739 §48.12 — **ΚΥΡΙΟΛΕΚΤΙΚΑ Η ΙΔΙΑ ΣΥΝΑΡΤΗΣΗ ΠΟΥ ΡΩΤΑ Ο ΖΩΓΡΑΦΟΣ.**
    //
    // Εδώ έγραφε `resolveTableSelectionBounds(model, selection ?? {from: pos, to: pos, kind})` —
    // αριθμητικά **ταυτόσημο** με το `tableEffectiveRangeBounds` (και τα δύο καταλήγουν σε
    // `rawTableCellRangeBounds` + `snapToWholeMerges`), αλλά **δεύτερη διατύπωση** της ίδιας
    // ερώτησης. Ήταν το πέμπτο αντίγραφο του σχήματος «επιλογή ?? ενεργό κελί» που η κεφαλίδα
    // του `table-effective-range` υπάρχει για να σβήσει.
    //
    // 🔑 Δεν είναι καλλωπισμός: το §48.12 **συγκρίνει** αυτά τα όρια με εκείνα του ζωγράφου για
    // να αποφασίσει αν θα αποσύρει το περίγραμμα. Με δύο διατυπώσεις, η ισότητα ήταν **σύμπτωση
    // που κρατούσε όσο κανείς δεν άγγιζε καμία από τις δύο**· με μία, είναι **ταυτότητα**. Η
    // κλάση σφάλματος «το πρόχειρο κράτησε άλλο ορθογώνιο από αυτό που ζωγραφίστηκε» παύει να
    // είναι εκφράσιμη — δεν φυλάγεται με test, δεν υπάρχει.
    const selectionBounds = cursor.selection
      ? resolveTableSelectionBounds(model, cursor.selection)
      : null;
    return tableEffectiveRangeBounds(model, cursor.position, selectionBounds);
  }, [cursor, entity]);

  // ADR-739 Φ.Δ βήμα 9 — η μία διαδρομή commit ζει πλέον σε δικό της module: την καλεί και
  // το μενού των ζωνών δείκτη. Δες την κεφαλίδα εκείνου για το γιατί δεν αντιγράφηκε.
  const commitModel = useTableModelCommit({ levelManager, execute });

  const extend = useCallback(
    (move: TableCursorMove) => {
      if (!cursor || !entity) return;
      const model = resolveTableModel(activeTableModel(entity));
      // Η γωνία που ΜΕΝΕΙ είναι το ενεργό κελί (ή το ήδη σταθερό `from` μιας ανοιχτής
      // επιλογής)· κουνιέται μόνο το `to`. Αυτή ΕΙΝΑΙ η διαφορά `βέλος` ↔ `Shift+βέλος`.
      const current = cursor.selection ?? {
        from: cursor.position,
        to: cursor.position,
        kind: 'range' as const,
      };
      const next = extendTableCellRangeEnd(model, current.to, move);
      // `null` = άκρη πλέγματος. Η περιοχή **μένει** όπου είναι — ποτέ αναδίπλωση, ίδια
      // σύμβαση με τον δρομέα.
      //
      // ADR-739 §27.15 — το είδος **διατηρείται**: `Shift+δεξί` πάνω σε επιλεγμένη στήλη
      // δίνει **δύο ολόκληρες στήλες** (Excel), όχι ορθογώνιο που ξαφνικά ξανακουμπώνει
      // στη συγχώνευση του τίτλου. Η επέκταση δεν αλλάζει **τι** διάλεξε ο χρήστης.
      //
      // §27.16 Ε2 — ο κανόνας ζει πλέον σε **μία** συνάρτηση, γιατί το `Shift+κλικ` σε
      // γράμμα στήλης τον ζητά από άλλο αρχείο. Δύο αντίγραφα μιας γραμμής δεν πιάνονται
      // από κανένα εργαλείο και αποκλίνουν σιωπηλά.
      if (next) setTableCellSelection(extendTableSelectionTo(current, next));
    },
    [cursor, entity],
  );

  const selectTo = useCallback(
    (cell: TableCellRef) => {
      if (!cursor) return;
      // Η **σταθερή** γωνία είναι το ενεργό κελί, ακόμα κι αν υπάρχει ήδη επιλογή: ένα
      // `Shift+κλικ` στο Excel ξαναορίζει την περιοχή από την αφετηρία, δεν την προσθέτει
      // στην προηγούμενη.
      // ADR-739 §27.15 — `Shift+κλικ` σε **κελί** ορίζει γωνίες με το χέρι ⇒ **περιοχή**,
      // με το κούμπωμα ενεργό: εδώ είναι ακριβώς η περίπτωση όπου «μισό συγχωνευμένο
      // κελί» θα ήταν ανερμήνευτο.
      setTableCellSelection({ from: cursor.position, to: cell, kind: 'range' });
    },
    [cursor],
  );

  const selectAll = useCallback(() => {
    if (!cursor || !entity) return;
    // 🔴 ADR-739 §43 — το σώμα μετακόμισε στο {@link selectWholeTable} τη στιγμή που η πράξη
    // απέκτησε **τρίτη** πόρτα (αριστερό και δεξί κλικ στο τετραγωνάκι της γωνίας). Το
    // σκεπτικό — γιατί το «ενεργό κελί δεν μετακινείται» και γιατί το είδος είναι `'range'` —
    // ζει εκεί, δίπλα στον κώδικα που το εκτελεί. Εδώ μένει μόνο ο φύλακας «υπάρχει δρομέας;»,
    // που είναι η γνώση **της συνεδρίας**, όχι της πράξης.
    selectWholeTable(resolveTableModel(activeTableModel(entity)));
  }, [cursor, entity]);

  const clearSelection = useCallback(() => {
    const bounds = currentBounds();
    if (!bounds || !entity) return;
    commitModel(
      entity,
      clearTableRange(tableEntityFormulaBook(entity), activeTableModel(entity), bounds),
    );
  }, [currentBounds, entity, commitModel]);

  // ── Πρόχειρο ──────────────────────────────────────────────────────────────

  /** Το TSV της τρέχουσας περιοχής, ή `null` όταν δεν υπάρχει τι να αντιγραφεί. */
  const rangeAsTsv = useCallback((): string | null => {
    const bounds = currentBounds();
    if (!bounds || !entity) return null;
    return tableRangeToClipboardText(activeTableModel(entity), bounds);
  }, [currentBounds, entity]);

  /** `true` όταν το πρόχειρο ανήκει στην **περιοχή**· `false` ⇒ ο browser κάνει τη δουλειά. */
  const ownsClipboard = useCallback(
    () => cursor !== null && tableClipboardScope(cursor.mode) === 'range',
    [cursor],
  );

  /**
   * Γράφει την περιοχή στο πρόχειρο του λειτουργικού και **δηλώνει αν το ανέλαβε**.
   *
   * Η αντιγραφή και η αποκοπή διαφέρουν σε **ένα** πράγμα — η δεύτερη αδειάζει μετά. Δύο
   * σώματα με τα ίδια τέσσερα βήματα ήταν sibling clone και το CHECK 3.28 (jscpd, N.18) το
   * έπιασε (7 γραμμές / 54 tokens). Το σοβαρό δεν είναι οι γραμμές: αν κάποτε προστεθεί
   * δεύτερη μορφή στο πρόχειρο (`text/html`, όπως γράφει το Excel), ένα από τα δύο θα την
   * μάθαινε και το άλλο όχι — δηλαδή η αποκοπή θα επικολλούσε αλλιώς από την αντιγραφή.
   */
  const writeRangeToClipboard = useCallback(
    (event: ClipboardEvent<HTMLElement>): boolean => {
      if (!ownsClipboard()) return false;
      const tsv = rangeAsTsv();
      if (tsv === null) return false;
      event.preventDefault();
      event.clipboardData.setData('text/plain', tsv);
      // 🔴 §57 — **το δεύτερο πρόχειρο, στην ίδια αναπνοή** (ίδιος κανόνας με τη διαδρομή του
      // μενού· δες την κεφαλίδα του `use-table-menu-clipboard.ts`). Το `bounds` ξαναρωτιέται
      // από την ίδια πηγή που παρήγαγε το TSV, ώστε το αποτύπωμα και το φορτίο να περιγράφουν
      // **κατά ταυτότητα** το ίδιο ορθογώνιο.
      const bounds = currentBounds();
      if (bounds && entity) {
        const payload = captureTableClipboard(activeTableModel(entity), resolveTableStyle(entity), bounds);
        if (payload) setTableClipboard(payload);
      }
      return true;
    },
    [ownsClipboard, rangeAsTsv, currentBounds, entity],
  );

  const onCopy = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      if (!writeRangeToClipboard(event)) return;
      // 🔴 ADR-739 §48 — **τα μυρμήγκια, ΜΟΝΟ όταν η αντιγραφή όντως έγινε.**
      //
      // Ο έλεγχος επιστροφής δεν είναι ευλάβεια: το `writeRangeToClipboard` σιωπά όταν το
      // πρόχειρο ανήκει στον browser (γράφεται κείμενο **μέσα** σε κελί) ή όταν δεν υπάρχει τι
      // να αντιγραφεί. Μυρμήγκια εκεί θα υπόσχονταν πρόχειρο που δεν γράφτηκε ποτέ.
      //
      // Τα `bounds` ξαναρωτιούνται αντί να περάσουν από το `rangeAsTsv`: εκείνο απαντά «τι
      // κείμενο», αυτό «ποια κελιά». Ίδια πηγή (`currentBounds`), ίδιο render, μηδέν πιθανότητα
      // απόκλισης — και το TSV **δεν** ξέρει όρια, οπότε μια κοινή επιστροφή θα ήταν το να
      // μάθει κάτι που δεν το αφορά.
      const bounds = currentBounds();
      if (bounds && entity) setTableCopyMarquee(entity.id, bounds, activeTableModel(entity));
    },
    [writeRangeToClipboard, currentBounds, entity],
  );

  const onCut = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      // Η αποκοπή είναι **αντιγραφή + άδειασμα**, με αυτή τη σειρά: αν το άδειασμα
      // προηγούνταν, το πρόχειρο θα γέμιζε με κενά κελιά. Και **μόνο** αν η αντιγραφή
      // όντως έγινε — αλλιώς θα σβήναμε δεδομένα που δεν μπήκαν πουθενά.
      if (writeRangeToClipboard(event)) clearSelection();
    },
    [writeRangeToClipboard, clearSelection],
  );

  // §57 — **ο ίδιος** εφαρμοστής με τις άλλες δύο διαδρομές· δες `use-table-paste-apply.ts`.
  const applyPaste = useTablePasteApply({ levelManager, execute });

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      if (!ownsClipboard() || !cursor || !entity) return;
      event.preventDefault();
      // 🔑 Εδώ το κείμενο υπάρχει **πάντα** (είναι το `clipboardData` του συμβάντος), οπότε ο
      // επιλυτής δεν βλέπει ποτέ `null` σε αυτή τη διαδρομή: το «τυφλό» φορτίο είναι δομικά
      // αδύνατο στο `Ctrl+V`, και αυτό είναι ακριβώς το πλεονέκτημα που τεκμηριώνει η κεφαλίδα.
      const source = resolveTablePasteSource(
        event.clipboardData.getData('text/plain'),
        getTableClipboard(),
        FULL_TABLE_PASTE,
      );
      applyPaste(entity, cursor.position, source, FULL_TABLE_PASTE);
    },
    [ownsClipboard, cursor, entity, applyPaste],
  );

  return useMemo(
    () => ({ extend, selectTo, selectAll, clearSelection, onCopy, onCut, onPaste }),
    [extend, selectTo, selectAll, clearSelection, onCopy, onCut, onPaste],
  );
}

/** Το μέγεθος της τρέχουσας επιλογής — `null` όταν δεν υπάρχει πραγματική περιοχή. */
export function resolveTableSelectionSize(
  cursor: TableCellCursorState | null,
  entity: TableEntity | null,
): { readonly rows: number; readonly columns: number } | null {
  if (!cursor || !entity || !cursor.selection) return null;
  const bounds = resolveTableSelectionBounds(resolveTableModel(activeTableModel(entity)), cursor.selection);
  return bounds ? tableRangeSize(bounds) : null;
}
