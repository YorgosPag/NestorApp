'use client';

/**
 * ADR-739 Φ.Δ βήμα 7 — **η γραμμή τύπων (fx) + η αναφορά κελιού**.
 *
 * Μια σταθερή θέση, αγκυρωμένη πάνω από τον πίνακα, όπου φαίνεται πάντα (α) **ποιο** κελί
 * είναι το τρέχον και (β) **ολόκληρη** η τιμή του — χωρίς να μπεις μέσα του.
 *
 * ## Τι προσθέτει, αφού το βήμα 6 έδωσε ήδη «βλέπω όλο το κείμενο μέσα στο κελί»
 * Δύο πράγματα που ο in-cell επεξεργαστής **δεν μπορεί** να δώσει, εξ ορισμού:
 *  1. **Ανάγνωση χωρίς γραφή.** Το βήμα 6 δείχνει ολόκληρη την τιμή μόνο αφού μπεις σε
 *     λειτουργία γραφής — δηλαδή αφού αναλάβεις τον κίνδυνο να την αλλάξεις. Εδώ η τιμή
 *     φαίνεται σε **πλοήγηση**, με το πεδίο να δείχνει το δεσμευμένο κείμενο.
 *  2. **Τύπος και αποτέλεσμα ταυτόχρονα.** Είναι η προϋπόθεση του Φ.Δ.11: ένα κελί με
 *     `=SUM(B2:B7)` δείχνει **αριθμό**· ο τύπος πρέπει να φαίνεται κάπου αλλού, αλλιώς
 *     γίνεται αόρατος τη στιγμή που υπολογίζεται. Χωρίς αυτή τη γραμμή, οι τύποι είναι
 *     μη-επεξεργάσιμοι.
 *
 * ## Η θέση — γιατί ΔΕΝ είναι λωρίδα της σελίδας
 * Ο Giorgio το έθεσε ρητά: «ο πίνακας να μην μετακινείται καθόλου κατά το edit». Μια
 * λωρίδα στη **ροή** της διάταξης (κάτω από την κορδέλα) θα κόνταινε τον καμβά και θα
 * μετέθετε το σχέδιο τη στιγμή του διπλού κλικ. Εδώ η γραμμή είναι **αγκυρωμένη στον
 * πίνακα**, ακριβώς πάνω από τη ζώνη γραμμάτων: ίδια μηχανή με τον επεξεργαστή κελιού
 * ({@link TextEditorAnchorLayer}) ⇒ ακολουθεί pan/zoom **χωρίς κανένα re-render** (ADR-040).
 *
 * ⚠️ **Δεν γέρνει με τον πίνακα** (`rotationRad: 0`), σε αντίθεση με τον επεξεργαστή κελιού
 * και τις ζώνες δείκτη. Δεν είναι ασυνέπεια: ο επεξεργαστής **είναι** το κελί και οι ζώνες
 * είναι μέρος του πίνακα· η γραμμή τύπων είναι **εργαλείο**. Ανάποδα γράμματα σε πεδίο που
 * πληκτρολογείς είναι ακριβώς το πρόβλημα που λύνει το `MTEXTFIXED = 2` του AutoCAD (δες
 * την κεφαλίδα του `TextEditorAnchorLayer`) — και όλες οι παλέτες κάθε CAD μένουν ίσιες.
 *
 * ## 🔴 ΕΝΑ πρόχειρο, δύο πεδία — μηδέν συγχρονισμός
 * Το πρόχειρο ζει στον **δρομέα** (`TableCellCursorState.draft`, τεκμηριωμένη απόφαση του
 * βήματος 2). Και τα δύο πεδία διαβάζουν από εκεί και γράφουν εκεί. Δεν υπάρχει δεύτερη
 * κατάσταση, άρα δεν υπάρχει τίποτα να συγχρονιστεί και τίποτα να αποκλίνει.
 *
 * ## 🔴 Η ιδιοκτησία πλήκτρων ΔΕΝ κουνιέται
 * Το πεδίο είναι `<input>`, άρα ο δομικός φύλακας `isTextEntryTarget` απαντά `true` και οι
 * **43** window listeners παραιτούνται όπως πριν. Και φέρει το σημάδι συνεδρίας, ώστε το
 * `handleBlur` του κελιού να δει «μετακίνηση **μέσα** στη συνεδρία» και όχι «έξοδος» — δες
 * `table-cell-session-focus.ts`, όπου ζει το ΕΝΑ κριτήριο.
 *
 * ## Έρευνα (ADR-739 §25.2)
 * - **Excel**: Name Box + fx πάνω από το πλέγμα, μόνιμα. Σε **συγχωνευμένο** δείχνει σκέτη
 *   την άγκυρα (`C7`) ενώ ο τύπος γράφει `C7:D7` — τεκμηριωμένη πηγή σύγχυσης.
 * - **Google Sheets**: ίδια θέση· κλικ στη γραμμή = Edit mode, η εστίαση **μένει** εκεί.
 * - **AutoCAD**: δεν έχει γραμμή τύπων — έχει `TABLEINDICATOR` (γράμματα/αριθμοί γύρω από
 *   τον πίνακα) και Properties palette. Οι τύποι του (`=Sum(A1:A5)`) φαίνονται **μόνο** μέσα
 *   στον in-place επεξεργαστή, δηλαδή μόνο αν μπεις σε γραφή. Αυτό ακριβώς το κενό κλείνει.
 * - **Figma**: inspector panel — πλήρης τιμή του επιλεγμένου, χωρίς είσοδο σε γραφή.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/TableFormulaBar
 * @see bim/table/table-cell-reference.ts — ΠΩΣ ονομάζεται το κελί (SSoT ονοματολογίας)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §25
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TextEditorAnchorLayer, type TextEditorAnchor } from '../text-toolbar/TextEditorAnchorLayer';
import { flattenToSingleLine } from './TableCellEditorOverlay';
import { useTableCellSessionKeys } from './use-table-cell-session-keys';
import { TABLE_CELL_SESSION_MARKER, useTableCellSessionBlur } from './table-cell-session-focus';
import {
  closeTableCellCursor,
  restartTableCellCursorSession,
  setTableCellCursorDraft,
  setTableCellCursorMode,
  type TableCellCursorMode,
} from '../../state/table-cell-cursor-store';
import type { TableCellReference } from '../../bim/table/table-cell-reference';
import type { TableCellSessionHandlers } from './table-cell-session-types';

export interface TableFormulaBarProps extends TableCellSessionHandlers {
  /** Η ονομασία του τρέχοντος κελιού· `null` όταν η ταυτότητα δεν λύνεται στο μοντέλο. */
  readonly reference: TableCellReference | null;
  readonly mode: TableCellCursorMode;
  readonly draft: string;
  /** Το **δεσμευμένο** κείμενο — αυτό που φαίνεται όσο δεν γράφεις. */
  readonly initialText: string;
  readonly anchor: TextEditorAnchor;
}

export function TableFormulaBar(props: TableFormulaBarProps): React.ReactElement {
  const {
    reference, mode, draft, initialText, anchor,
    onCommit, onMove, onClear, onHistory, onExtend, onSelectAll,
  } = props;
  const { t } = useTranslation('dxf-viewer');

  /**
   * Σε **πλοήγηση** το πεδίο δείχνει το δεσμευμένο κείμενο· σε **γραφή** το πρόχειρο.
   *
   * Είναι η συμπεριφορά του Excel και είναι και η μόνη συνεπής: σε πλοήγηση δεν υπάρχει
   * πρόχειρο (είναι `''` εξ ορισμού — δες το store), οπότε η εναλλακτική θα ήταν να δείχνει
   * η γραμμή τύπων **κενό** πάνω σε γεμάτο κελί.
   */
  const value = mode === 'nav' ? initialText : draft;

  const handleCommit = useCallback(() => {
    // Ίδιος φύλακας με τον επεξεργαστή κελιού: σε πλοήγηση δεν υπάρχει πρόχειρο, και ένα
    // «γράψε το άδειο πρόχειρο» θα **έσβηνε το κελί** χωρίς ο χρήστης να γράψει τίποτα.
    if (mode === 'nav') return;
    onCommit(draft);
  }, [mode, draft, onCommit]);

  /**
   * Κλικ μέσα στη γραμμή = **μπαίνω σε γραφή** πάνω στο τρέχον κείμενο (Excel / Sheets).
   *
   * Το πρόχειρο σπέρνεται από το δεσμευμένο κείμενο, ακριβώς όπως κάνει το `F2`: μπήκες για
   * να **διορθώσεις**, όχι για να ξαναγράψεις από την αρχή. Χωρίς αυτό, ο πρώτος χαρακτήρας
   * θα έσβηνε ολόκληρη την τιμή.
   */
  const handleFocus = useCallback(() => {
    if (mode === 'nav') setTableCellCursorMode('edit', initialText);
  }, [mode, initialText]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // Ο ίδιος φύλακας μονής γραμμής με το κελί: το `TableCell.value` είναι απλό `string`,
    // και μια **επικόλληση** πολυγραμμικού κειμένου δεν επιτρέπεται να βάλει χαρακτήρα
    // ελέγχου μέσα σε κελί που θα γραφτεί σε DXF. Ίδια συνάρτηση, όχι δεύτερη.
    setTableCellCursorDraft(flattenToSingleLine(event.target.value));
  }, []);

  // Η ΙΔΙΑ σημασιολογία πλήκτρων με το κελί, από την ίδια καλωδίωση. Χωρίς `onPassthrough`:
  // η γραμμή τύπων δεν έχει δικό της κύκλο δέσμευσης — το `Escape` το δρομολογεί ο
  // escape-bus από τον **έναν** χειριστή του επεξεργαστή κελιού, που ισχύει για ολόκληρη
  // τη συνεδρία ανεξάρτητα από το ποιο πεδίο κρατά την εστίαση.
  const handleKeyDown = useTableCellSessionKeys({
    mode,
    initialText,
    commit: handleCommit,
    onMove,
    onClear,
    onHistory,
    onExtend,
    onSelectAll,
  });

  // ADR-739 §26.15 — κλικ από τη γραμμή τύπων πάνω σε κελί του **ίδιου** πίνακα: η συνεδρία
  // δεν φεύγει, μετακομίζει. Το πληκτρολόγιο επιστρέφει στο πλέγμα (Excel), από τον ένα
  // δρόμο ανάκτησης — τον ίδιο που περνά και ο επεξεργαστής κελιού.
  const handleBlur = useTableCellSessionBlur(
    handleCommit,
    closeTableCellCursor,
    restartTableCellCursorSession,
  );

  return (
    <TextEditorAnchorLayer {...anchor}>
      <section
        className="flex h-full w-full items-stretch overflow-hidden rounded-sm border border-border bg-background/95 text-xs shadow-sm backdrop-blur-sm"
        aria-label={t('table.formulaBar.ariaLabel')}
      >
        {/* Το «πλαίσιο ονόματος»: ταυτότητα (`B3`) + το κείμενο κεφαλίδας ως συμφραζόμενο.
            Η κεφαλίδα λείπει σιωπηλά όταν ο πίνακας δεν έχει γραμμή κεφαλίδας — φυσιολογικό
            σε πίνακα υπομνήματος, όχι σφάλμα. */}
        <span
          className="flex shrink-0 items-center gap-1.5 border-r border-border px-2 font-mono font-semibold text-foreground"
          aria-label={t('table.formulaBar.referenceAriaLabel')}
        >
          {reference?.a1 ?? ''}
          {reference?.columnHeader ? (
            <em className="max-w-32 truncate font-sans text-[10px] font-normal not-italic text-muted-foreground">
              {reference.columnHeader}
            </em>
          ) : null}
        </span>
        <span
          className="flex shrink-0 items-center border-r border-border px-2 font-serif italic text-muted-foreground"
          aria-hidden="true"
        >
          {t('table.formulaBar.symbol')}
        </span>
        <input
          type="text"
          spellCheck={false}
          value={value}
          className="min-w-0 flex-1 bg-transparent px-2 text-foreground outline-none"
          aria-label={t('table.formulaBar.valueAriaLabel')}
          // Δες `table-cell-session-focus.ts`: αυτό είναι που εμποδίζει τη γραμμή τύπων να
          // κλείσει τον δρομέα τη στιγμή που την πατάς.
          {...TABLE_CELL_SESSION_MARKER}
          onFocus={handleFocus}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </section>
    </TextEditorAnchorLayer>
  );
}
