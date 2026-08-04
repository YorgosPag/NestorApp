'use client';

/**
 * 🔴 ADR-754 **Γ3** — **ΤΟ ΠΛΗΚΤΡΟ ΠΟΥ ΚΛΕΙΔΩΝΕΙ ΤΗΝ ΑΝΑΦΟΡΑ** (`F4`).
 *
 * Το αδελφό αρχείο του `table-point-mode-pointer.ts`: εκείνο απαντά «τι κάνει το **κλικ** μέσα
 * σε τύπο», αυτό «τι κάνει το **πλήκτρο**». Ίδια δομή, ίδιες τρεις πηγές, ίδιος ένας γραφέας:
 *
 * | ερώτηση | ποιος απαντά |
 * |---|---|
 * | «ποια αναφορά είναι του δρομέα, και τι γίνεται;» | `formula/table-formula-reference-edit.ts` (καθαρό) |
 * | «πού είναι ο κέρσορας;» | το **εστιασμένο πεδίο**, τη στιγμή του συμβάντος |
 * | «ποιος γράφει;» | ο δρομέας (`setTableCellCursorDraftAt`) |
 *
 * ## 🔴 Ο κέρσορας διαβάζεται από το DOM — **ξανά**, και για τον ίδιο λόγο
 * Η θέση του κέρσορα **δεν είναι παράγωγη** του προχείρου: την κινεί ο χρήστης με βέλη, με
 * κλικ μέσα στο κείμενο, με IME. Ένα αντίγραφο σε store θα παλιώνε σε **κάθε πάτημα βέλους**,
 * και μαζί του θα παλιώνε η απάντηση στο «ποια αναφορά εννοεί το `F4`;» — δηλαδή θα κλείδωνε
 * **άλλη** αναφορά από αυτήν που κοιτά ο χρήστης. Είναι το μοτίβο που ο ADR-040 ονομάζει
 * **event-time read μέσω getter** (ADR-754 §3.1).
 *
 * ## Γιατί ΜΙΑ συνάρτηση για **δύο** πεδία
 * Η συνεδρία έχει δύο πεδία κειμένου (το κελί και τη γραμμή τύπων) και το `F4` οφείλει να
 * κάνει **ακριβώς** το ίδιο και στα δύο. Η ερώτηση «ποιο πεδίο έχει την εστίαση και πού είναι
 * ο κέρσοράς του;» δεν τα ξεχωρίζει — γι' αυτό δεν υπάρχει εδώ καμία παράμετρος πεδίου, και
 * γι' αυτό η γραμμή τύπων το απέκτησε **δωρεάν**, όπως και την υπόδειξη (§4.2).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-point-mode-keys
 * @see ui/table-cell-editor/table-point-mode-pointer.ts — το αδελφό: τι κάνει το κλικ
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §12
 */

import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { toggleFormulaReferenceAbsolute } from '../../bim/table/formula/table-formula-reference-edit';
import { activeTableCellSessionCaret } from './table-cell-session-focus';
import { setTableCellCursorDraftAt } from '../../state/table-cell-cursor-store';
import type { TableEntity } from '../../types/table-entity';

/**
 * `F4` — κλειδώνει/ξεκλειδώνει την αναφορά όπου κάθεται ο δρομέας, κυκλικά.
 *
 * `false` όταν δεν έγινε τίποτα: κανείς δεν γράφει, ή ο δρομέας δεν είναι πάνω σε αναφορά.
 * Ο καλών **δεν** χρειάζεται να το ερμηνεύσει ως σφάλμα — είναι η συνηθισμένη έκβαση όταν ο
 * χρήστης πατά `F4` πάνω σε σκέτο κείμενο.
 */
export function toggleTableFormulaAbsoluteRef(entity: TableEntity, draft: string): boolean {
  // `null` ⇒ κανένα πεδίο της συνεδρίας δεν έχει την εστίαση ⇒ δεν υπάρχει «ο δρομέας».
  const caretIndex = activeTableCellSessionCaret();
  if (caretIndex === null) return false;

  // Ο ΙΔΙΟΣ απομνημονευμένος (WeakMap) δρόμος που περνά και η γεωμετρία — ίδιο persisted ⇒
  // ίδιο μοντέλο, καμία δεύτερη αποσειριοποίηση ανά πάτημα πλήκτρου.
  const model = resolveTableModel(entity.model);
  const edit = toggleFormulaReferenceAbsolute(model, draft, caretIndex);
  if (!edit) return false;

  // 🔴 **Μία** εγγραφή για πρόχειρο **και** κέρσορα: το μήκος της αναφοράς αλλάζει σε κάθε
  // πάτημα, οπότε δύο χωριστές εγγραφές θα άφηναν ένα καρέ όπου το κείμενο είναι το νέο και
  // ο κέρσορας ακόμη ο παλιός — και αν ο χρήστης πληκτρολογήσει μέσα σε αυτό, γράφει σε λάθος
  // σημείο (ADR-754 §4).
  setTableCellCursorDraftAt(edit.draft, edit.caretIndex);
  return true;
}
