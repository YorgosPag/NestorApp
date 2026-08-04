'use client';

/**
 * ADR-739 Φ.Δ βήμα 7 — **η ΜΙΑ καλωδίωση** της σημασιολογίας πλήκτρων σε πεδίο συνεδρίας
 * κελιού.
 *
 * ## Γιατί υπάρχει
 * Η σημασιολογία («ποιο πλήκτρο τι σημαίνει») ζει ήδη σε ένα σημείο:
 * {@link resolveTableCellKeyIntent}, καθαρή συνάρτηση, δοκιμασμένη σαν πίνακας
 * προδιαγραφής. Αυτό που **δεν** ζούσε σε ένα σημείο ήταν η **εκτέλεσή** της: το
 * `switch (intent.kind)` με τα `preventDefault` και τη σειρά «πρώτα commit, μετά move».
 * Μέχρι το βήμα 6 υπήρχε ένας καταναλωτής, οπότε ζούσε μέσα του.
 *
 * Το βήμα 7 προσθέτει **δεύτερο** πεδίο κειμένου στην ίδια συνεδρία (τη γραμμή τύπων). Ένα
 * αντιγραμμένο `switch` 30 γραμμών θα ήταν ακριβώς το sibling clone που πιάνει το CHECK
 * 3.28 (jscpd, N.18) — και, χειρότερα, ένα σημείο όπου η σειρά commit/move θα μπορούσε να
 * αποκλίνει σιωπηλά ανάμεσα στα δύο πεδία. Η σειρά **είναι** το συμβόλαιο: αντίστροφα, το
 * κείμενο γράφεται στο **επόμενο** κελί.
 *
 * ## Τι μένει έξω
 * Η **τιμή** και ο κύκλος ζωής της (πρόχειρο, φρουρός «μία φορά», escape-bus): αυτά ανήκουν
 * στον καταναλωτή. Το κελί έχει φρουρό μέσω `useInlineEditorKeys`· η γραμμή τύπων δεν
 * χρειάζεται δικό της, γιατί το commit είναι ιδεμποτές στο **μοντέλο**
 * (`buildTableCellEditCommand` επιστρέφει `null` όταν δεν άλλαξε τίποτα).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-cell-session-keys
 * @see ui/table-cell-editor/table-cell-key-intent.ts — Η ΣΗΜΑΣΙΟΛΟΓΙΑ (καθαρή)
 */

import { useCallback, type KeyboardEvent } from 'react';
import { resolveTableCellKeyIntent } from './table-cell-key-intent';
import { setTableCellCursorMode, type TableCellCursorMode } from '../../state/table-cell-cursor-store';
import type { TableCellSessionHandlers } from './table-cell-session-types';

/**
 * 🔴 **Κληρονομεί, δεν ξαναδηλώνει.** Τα `onMove`/`onClear`/`onHistory`/`onExtend`/
 * `onSelectAll` είναι **ακριβώς** το συμβόλαιο του {@link TableCellSessionHandlers}, και
 * γραμμένα δεύτερη φορά εδώ ήταν sibling clone — το CHECK 3.28 (jscpd, N.18) το
 * χαρακτήρισε έτσι (23 γραμμές / 55 tokens). Το ουσιώδες δεν είναι οι γραμμές: δύο
 * αντίγραφα της ίδιας υπογραφής μπορούν να **αποκλίνουν**, δηλαδή το πλήκτρο να καλεί
 * κάτι με άλλο σχήμα από αυτό που ο καλών παρέχει — ακριβώς ο κίνδυνος που περιγράφει η
 * κεφαλίδα του `table-cell-session-types`.
 *
 * Το `onCommit` **εξαιρείται**: εκείνο δέχεται το νέο κείμενο (ο καλών γράφει στο μοντέλο),
 * ενώ εδώ η δέσμευση είναι άνευ ορίσματος — το πεδίο κατέχει ήδη το πρόχειρό του.
 */
export interface TableCellSessionKeyParams extends Omit<TableCellSessionHandlers, 'onCommit'> {
  readonly mode: TableCellCursorMode;
  /** Το **δεσμευμένο** κείμενο του κελιού — ο σπόρος του προχείρου όταν το `F2` ανοίγει γραφή. */
  readonly initialText: string;
  /** Δέσμευσε ό,τι γράφτηκε. Καλείται **πριν** από κάθε μετακίνηση — δες την κεφαλίδα. */
  readonly commit: () => void;
  /**
   * Τι γίνεται με ό,τι κανείς δεν διεκδίκησε. Απόν ⇒ τίποτα, που είναι το σωστό για ένα
   * πεδίο χωρίς δικό του κύκλο δέσμευσης: το συμβάν συνεχίζει τον φυσικό του δρόμο.
   */
  readonly onPassthrough?: (event: KeyboardEvent<HTMLElement>) => void;
  /**
   * ADR-751 Φ8.γ — `Alt+Enter` σε **πλοήγηση**: άνοιξε τη διεύθυνση του κελιού.
   *
   * ## Γιατί ΠΡΟΑΙΡΕΤΙΚΟ, και γιατί ΔΕΝ μπαίνει στο `TableCellSessionHandlers`
   * Το κοινό συμβόλαιο το απαιτούν **και τα δύο** πεδία της συνεδρίας. Η γραμμή τύπων όμως
   * **δεν μπορεί** να βρεθεί σε `nav`: το `onFocus` της περνά τη συνεδρία σε `edit` (κλικ
   * στη γραμμή = «διορθώνω αυτή την τιμή», Excel/Sheets — τεκμηριωμένο στο
   * `table-cell-session-types`). Άρα εκεί η πρόθεση `openLink` **δεν παράγεται ποτέ**, και
   * μια υποχρεωτική δέσμευση θα ήταν κώδικας που δεν εκτελείται — ακριβώς το είδος
   * «κάλυψης σε νεκρό δίδυμο» που δεν είναι κάλυψη.
   */
  readonly onOpenLink?: () => void;
}

/** Ο χειριστής `onKeyDown` κάθε πεδίου της συνεδρίας. */
export function useTableCellSessionKeys(
  params: TableCellSessionKeyParams,
): (event: KeyboardEvent<HTMLElement>) => void {
  const {
    mode, initialText, commit, onMove, onClear, onHistory, onExtend, onSelectAll,
    onToggleAbsoluteRef, onPassthrough, onOpenLink,
  } = params;

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const intent = resolveTableCellKeyIntent(event.key, event, mode);
      switch (intent.kind) {
        case 'move':
          event.preventDefault();
          // 🔴 Η σειρά είναι το συμβόλαιο: **πρώτα** δεσμεύεται το πρόχειρο, **μετά**
          // μετακινείται ο δρομέας. Αντίστροφα, το κείμενο θα γραφόταν στο νέο κελί.
          commit();
          onMove(intent.move);
          return;
        case 'mode':
          event.preventDefault();
          // `F2` από πλοήγηση: το πρόχειρο γεννιέται ΤΩΡΑ από το δεσμευμένο κείμενο του
          // κελιού· από γραφή αλλάζει μόνο ποιος κατέχει τα βέλη (το «διπλό F2» του Excel).
          setTableCellCursorMode(intent.to, mode === 'nav' ? initialText : undefined);
          return;
        case 'extend':
          // 🔴 ΚΑΜΙΑ δέσμευση εδώ, σε αντίθεση με το `move`: η επέκταση περιοχής είναι
          // κατάσταση **διεπαφής** και δεν αγγίζει το μοντέλο (§6.6). Ένα `commit()` θα
          // έγραφε το πρόχειρο σε κάθε `Shift+βέλος` — και σε πλοήγηση το πρόχειρο είναι
          // κενό, δηλαδή θα **έσβηνε** το κελί περνώντας από πάνω του.
          event.preventDefault();
          onExtend(intent.move);
          return;
        case 'selectAll':
          // Το `preventDefault` είναι απαραίτητο: αλλιώς ο browser «επιλέγει όλο το
          // κείμενο» του πεδίου — αόρατο σε πλοήγηση, αλλά αφήνει το πεδίο σε κατάσταση
          // επιλογής που ο επόμενος χαρακτήρας θα αντικαθιστούσε.
          event.preventDefault();
          onSelectAll();
          return;
        case 'clear':
          event.preventDefault();
          onClear();
          return;
        case 'history':
          // `preventDefault` απαραίτητο: χωρίς αυτό ο browser θα έτρεχε **και** το δικό του
          // undo πάνω στο πεδίο — δύο ενέργειες για ένα πάτημα.
          event.preventDefault();
          onHistory(intent.direction);
          return;
        case 'openLink':
          // ADR-751 Φ8.γ — `preventDefault` απαραίτητο για τον ίδιο λόγο με το `suppress`:
          // το `<textarea>` κρατά την εστίαση και θα έγραφε `\n` πίσω από το άνοιγμα.
          event.preventDefault();
          onOpenLink?.();
          return;
        case 'absoluteRef':
          // 🔴 ADR-754 Γ3 — `preventDefault` **πάντα**, ακόμη κι όταν δεν υπάρχει αναφορά να
          // κλειδωθεί: το `F4` είναι συντόμευση του **browser** (εστίαση στη γραμμή
          // διευθύνσεων). Χωρίς αυτό, ένα `F4` πάνω σε σκέτο κείμενο θα πετούσε τον χρήστη
          // έξω από τον πίνακα — δηλαδή η «καμία ενέργεια» θα ήταν η χειρότερη ενέργεια.
          event.preventDefault();
          onToggleAbsoluteRef();
          return;
        case 'suppress':
          // Πλήκτρο που το `<textarea>` **θα** εκτελούσε και δεν πρέπει: σήμερα `Alt+Enter`
          // **σε γραφή**, όπου η αλλαγή γραμμής του Excel μένει δεσμευμένη για τη Φ.Δ.10.
          event.preventDefault();
          return;
        case 'passthrough':
          onPassthrough?.(event);
      }
    },
    [
      mode, initialText, commit, onMove, onClear, onHistory, onExtend, onSelectAll,
      onToggleAbsoluteRef, onPassthrough, onOpenLink,
    ],
  );
}
