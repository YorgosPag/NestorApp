'use client';

/**
 * ADR-763 §16 — **οι σειρές ορισμάτων**: ετικέτα, κουτί, κουμπί σύμπτυξης, και η τιμή στα
 * δεξιά. Καθαρή όψη: κανένα store, κανένα i18n, καμία γνώση για το τι είναι «συνάρτηση».
 *
 * ## Γιατί λίστα και όχι πίνακας
 * Το Excel ζωγραφίζει στήλες και ο πειρασμός είναι `<table>`. Δεν είναι όμως πίνακας
 * δεδομένων: δεν υπάρχουν επικεφαλίδες στηλών, καμία σειρά δεν συγκρίνεται με άλλη, και ο
 * αναγνώστης οθόνης θα ανακοίνωνε «πίνακας 2 γραμμών, 3 στηλών» για μια **φόρμα**. Είναι
 * λίστα πεδίων με σταθερή σειρά — `<ul>` με `<li>`, και η στοίχιση είναι δουλειά του grid.
 *
 * ## 🔴 ΚΑΘΕ ΕΣΤΙΑΣΙΜΟ ΦΕΡΕΙ ΤΟ ΣΗΜΑΔΙ ΣΥΝΕΔΡΙΑΣ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟ
 * Χωρίς το `TABLE_CELL_SESSION_MARKER`, η μεταφορά εστίασης σε αυτά τα κουτιά κάνει τη
 * γραμμή τύπων να δει «έφυγα», να κλείσει τον δρομέα του κελιού και να ξυπνήσει **43** window
 * listeners πάνω σε έναν χρήστη που νομίζει ότι γράφει όρισμα: το επόμενο `Delete` σβήνει
 * **οντότητα**, όχι χαρακτήρα (ADR-763 §10).
 *
 * ## 🔴 Φ2.4 — ΤΟ ΠΕΔΙΟ ΕΞΗΧΘΗ ΩΣ COMPONENT, ΚΑΙ ΗΤΑΝ ΑΝΑΓΚΗ ΟΧΙ ΚΑΛΛΩΠΙΣΜΟΣ
 * Η συμπτυγμένη λωρίδα δείχνει **ακριβώς το ίδιο** τρίπτυχο (ετικέτα · κουτί · κουμπί) με μια
 * σειρά της λίστας. Γραμμένο δεύτερη φορά, θα ήταν sibling clone που το CHECK 3.28 (jscpd,
 * N.18) πιάνει ανεξάρτητα ονόματος — και, χειρότερα, δεύτερο σημείο όπου μπορεί να ξεχαστεί
 * το σημάδι συνεδρίας ή το `preventDefault` του κουμπιού. Εδώ είναι **ένα**.
 *
 * @module subapps/dxf-viewer/ui/dialogs/function-argument-rows
 * @see ui/dialogs/function-argument-field.ts — η ταυτότητα DOM και ο κέρσοράς της
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §16, §21
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-editor/table-cell-session-focus';
import { functionArgumentFieldId } from './function-argument-field';

/** Μία σειρά, έτοιμη για ζωγράφισμα — όλα τα κείμενα μεταφρασμένα από τον γονέα. */
export interface FunctionArgumentRow {
  /** Η ετικέτα αριστερά (`Κείμενο1`). Είναι και το κλειδί του React. */
  readonly name: string;
  /** Έντονη ετικέτα, όπως στο Excel. `false` και για τα «δεν ξέρουμε» (δες `unspecified`). */
  readonly required: boolean;
  /** Το μεταφρασμένο **είδος** (`κείμενο`), γκρι στα δεξιά όσο το κουτί είναι κενό. */
  readonly kindLabel: string;
  readonly value: string;
  /**
   * Η ζωντανή αποτίμηση του ορίσματος (ADR-763 Φ2.3). `undefined` όσο δεν υπάρχει ακόμη
   * απάντηση — τότε τα δεξιά δείχνουν το είδος, που είναι η οδηγία «τι περιμένω εδώ».
   */
  readonly preview?: string;
}

/** Τα δύο κείμενα του κουμπιού σύμπτυξης — μεταφρασμένα από τον γονέα, όπως όλα εδώ. */
export interface FunctionArgumentToggleLabels {
  readonly collapse: string;
  readonly expand: string;
}

export interface FunctionArgumentFieldProps {
  readonly index: number;
  readonly row: FunctionArgumentRow;
  /** Είναι **αυτό** το πεδίο που θα δεχτεί το πληκτρολόγιο μόλις μονταριστεί; */
  readonly focused: boolean;
  /** Η κάρτα είναι μαζεμένη σε αυτό το όρισμα ⇒ το κουμπί λέει «ανάπτυξη». */
  readonly collapsed: boolean;
  readonly toggleLabels: FunctionArgumentToggleLabels;
  readonly onValueChange: (index: number, value: string) => void;
  readonly onFocus: (index: number) => void;
  readonly onToggleCollapse: (index: number) => void;
}

/**
 * 🔴 Το κουμπί **δεν κλέβει την εστίαση** — ADR-763 §10.1, εφαρμοσμένο εδώ ακέραιο.
 *
 * Το `mousedown` σε `<button>` μεταφέρει την εστίαση ως **προεπιλεγμένη ενέργεια**, και ο
 * παραλήπτης διαφέρει ανά μηχανή. Εδώ η ζημιά είναι διπλή και μετρήσιμη: (α) ο φύλακας του
 * `useTableCellSessionBlur` δεν μπορεί να απαντήσει «μέλος της συνεδρίας;» με `relatedTarget`
 * `null` και ακολουθεί τον δρόμο της εξόδου· (β) χαμένη η εστίαση του κουτιού, η **επόμενη**
 * υπόδειξη δεν έχει κέρσορα να διαβάσει. Το `preventDefault` **και** το σημάδι συνεδρίας είναι
 * belt-and-suspenders (N.7.2 #4), όχι πλεονασμός: το πρώτο αποτρέπει το συμβάν, το δεύτερο
 * απαντά σωστά αν κάποια μηχανή το παραγάγει ούτως ή άλλως.
 */
function preventFocusSteal(event: React.MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}

/** Ετικέτα · κουτί · κουμπί — το τρίπτυχο που μοιράζονται η λίστα και η συμπτυγμένη λωρίδα. */
export function FunctionArgumentField(props: FunctionArgumentFieldProps): React.ReactElement {
  const { index, row, focused, collapsed, toggleLabels } = props;
  const id = functionArgumentFieldId(index);
  return (
    <>
      <label
        className={cn('dxf-fn-args-name', row.required && 'dxf-fn-args-name--required')}
        htmlFor={id}
      >
        {row.name}
      </label>
      <input
        id={id}
        className="dxf-fn-args-input"
        type="text"
        value={row.value}
        spellCheck={false}
        autoComplete="off"
        // Δες την κεφαλίδα — χωρίς αυτό ο δρομέας του κελιού κλείνει στην πρώτη εστίαση.
        {...TABLE_CELL_SESSION_MARKER}
        autoFocus={focused}
        onChange={(event) => props.onValueChange(index, event.target.value)}
        onFocus={() => props.onFocus(index)}
      />
      <button
        type="button"
        className="dxf-fn-args-collapse"
        aria-label={collapsed ? toggleLabels.expand : toggleLabels.collapse}
        // Μοτίβο «disclosure»: το κουμπί λέει αν το πράγμα που ελέγχει είναι ανοιχτό. **Χωρίς**
        // `aria-controls`: εκείνο θα έδειχνε στο κουτί από δίπλα, που είναι ορατό και στις δύο
        // μορφές — δηλαδή θα δήλωνε ψέματα για το τι μαζεύεται.
        aria-expanded={!collapsed}
        {...TABLE_CELL_SESSION_MARKER}
        onMouseDown={preventFocusSteal}
        onClick={() => props.onToggleCollapse(index)}
      >
        {collapsed ? '⬇' : '⬆'}
      </button>
    </>
  );
}

export interface FunctionArgumentRowsProps {
  readonly rows: readonly FunctionArgumentRow[];
  readonly activeIndex: number;
  readonly toggleLabels: FunctionArgumentToggleLabels;
  readonly onValueChange: (index: number, value: string) => void;
  readonly onFocus: (index: number) => void;
  readonly onToggleCollapse: (index: number) => void;
  /** Δείχνεται όταν η συνάρτηση δεν δέχεται ορίσματα (`PI`, `TRUE`, `FALSE`, `NA`). */
  readonly emptyLabel: string;
}

export function FunctionArgumentRows(props: FunctionArgumentRowsProps): React.ReactElement {
  const { rows, activeIndex, toggleLabels, emptyLabel } = props;

  if (rows.length === 0) {
    return <p className="dxf-fn-args-none">{emptyLabel}</p>;
  }

  return (
    <ul className="dxf-fn-args-rows">
      {rows.map((row, index) => (
        <li key={row.name} className="dxf-fn-args-row">
          {/* 🔴 Φ2.4 — `focused` είναι πλέον «είναι το ενεργό;» και όχι «είναι το πρώτο;».
              Το `autoFocus` τιμάται **μόνο στο μοντάρισμα**, και το μοντάρισμα ξανασυμβαίνει
              όταν η κάρτα ξανανοίγει από τη σύμπτυξη: με τον παλιό όρο, το πληκτρολόγιο θα
              γύριζε πάντα στην **πρώτη** σειρά, δηλαδή σε άλλο όρισμα από αυτό που ο χρήστης
              μόλις γέμιζε με το ποντίκι. */}
          <FunctionArgumentField
            index={index}
            row={row}
            focused={index === activeIndex}
            collapsed={false}
            toggleLabels={toggleLabels}
            onValueChange={props.onValueChange}
            onFocus={props.onFocus}
            onToggleCollapse={props.onToggleCollapse}
          />
          <ArgumentPreview row={row} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Τα δεξιά της σειράς: **είδος** όσο το κουτί είναι κενό, **τιμή** μόλις γραφτεί κάτι.
 *
 * Η εναλλαγή δεν είναι διακόσμηση: όσο το κουτί είναι άδειο η μόνη χρήσιμη πληροφορία είναι
 * «τι περιμένω εδώ», και μόλις γραφτεί κάτι η μόνη χρήσιμη είναι «τι κατάλαβα». Το Excel
 * κάνει ακριβώς αυτό, και είναι ο λόγος που ο διάλογος διδάσκει τη συνάρτηση χωρίς κείμενο.
 *
 * 🔑 **Φ2.4 — εξάγεται, γιατί τη δείχνει ΚΑΙ η συμπτυγμένη λωρίδα.** Στο Excel η λωρίδα δείχνει
 * **μόνο** τη διεύθυνση, και εκεί ακριβώς ο χρήστης χρειάζεται περισσότερο την τιμή: σέρνει
 * πάνω από κελιά **επειδή** δεν είναι σίγουρος ποια θέλει. Ένα `= 245,8` που μεγαλώνει όσο
 * σέρνει απαντά στο «σωστή περιοχή;» χωρίς να ανοίξει τίποτα. Μία υλοποίηση, δύο θέσεις.
 */
export function ArgumentPreview({ row }: { readonly row: FunctionArgumentRow }): React.ReactElement {
  const empty = row.value === '';
  return (
    <>
      {/* Το `=` είναι **σταθερό** στη σειρά, γεμάτο ή άδειο το κουτί: είναι ο τελεστής που
          διαβάζει ο χρήστης ως «αυτό εδώ γίνεται εκείνο», και μια εμφάνιση υπό συνθήκη θα
          έκανε τη στήλη να αναπηδά σε κάθε πληκτρολόγηση. */}
      <span className="dxf-fn-args-eq" aria-hidden="true">=</span>
      <output className={cn('dxf-fn-args-value', empty && 'dxf-fn-args-value--kind')}>
        {empty ? row.kindLabel : (row.preview ?? '')}
      </output>
    </>
  );
}
