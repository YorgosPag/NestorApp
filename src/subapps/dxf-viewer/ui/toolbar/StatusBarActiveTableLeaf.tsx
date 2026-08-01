'use client';

/**
 * StatusBarActiveTableLeaf — ADR-739 Φ.Δ βήμα 4, η **ορατή ένδειξη** της λειτουργίας πίνακα.
 *
 * ## Γιατί είναι απαίτηση και όχι διακόσμηση
 * Μέσα στη λειτουργία πίνακα **καμία** συντόμευση σχεδίασης δεν πυροδοτεί: το `L` δεν
 * ξεκινά γραμμή, τα βέλη δεν παν το σχέδιο, το `Ctrl+Z` σημαίνει άλλο πράγμα. Χωρίς ρητή
 * ένδειξη ο χρήστης δεν έχει **κανέναν** τρόπο να μάθει γιατί έπαψε να δουλεύει ο viewer —
 * και η μετρημένη κατάληξη αυτού είναι το object-edit mode του Figma, που περιγράφεται ως
 * «feature που ανάβει κατά λάθος και οι χρήστες το μισούν αμέσως», με κόσμο να πατά `Esc`
 * στα τυφλά. Η υπόσχεση εξόδου γράφεται **δίπλα** στην κατάσταση, όχι σε τεκμηρίωση.
 *
 * ## Γιατί δείχνει και την κατάσταση κελιού
 * Το Excel δείχνει «Έτοιμο / Καταχώριση / Επεξεργασία» στη γραμμή κατάστασης, και η
 * διαφορά τους είναι **μετρήσιμη στα βέλη** (πλοήγηση κελιού vs κέρσορας κειμένου). Είναι
 * η ίδια πληροφορία που ήδη κωδικοποιεί το `mode` του δρομέα· εδώ απλώς γίνεται ορατή.
 *
 * ## ADR-040
 * Micro-leaf: συνδρομή **μόνο** στον δρομέα κελιού — χαμηλή συχνότητα (ένα πάτημα
 * πλήκτρου), ποτέ 60fps. Το κέλυφος της γραμμής κατάστασης δεν ξαναποδίδεται σε κίνηση
 * δρομέα ποντικιού. Αδελφό των {@link StatusBarActiveGroupLeaf} / `StatusBarActiveBlockLeaf`.
 *
 * @see state/table-cell-cursor-store.ts — η κατάσταση που διαβάζεται
 */

import { useContext } from 'react';
import { useTranslation } from '@/i18n';
import {
  useTableCellCursor,
  type TableCellCursorMode,
} from '../../state/table-cell-cursor-store';
// ADR-739 Φ.Δ βήμα 8 — το μέγεθος της επιλογής χρειάζεται το **μοντέλο** (οι συγχωνεύσεις
// μεγαλώνουν την περιοχή), άρα και τη σκηνή.
import { LevelsContext } from '../../systems/levels/LevelsSystem';
import { resolveTableById } from '../table-cell-editor/table-entity-lookup';
import { resolveTableSelectionSize } from '../table-cell-editor/use-table-range-actions';

interface StatusBarActiveTableLeafProps {
  className?: string;
  separatorClassName?: string;
}

/**
 * Τα κλειδιά είναι **δεδομένα**, όχι `switch`: μια νέα κατάσταση δρομέα (π.χ. η `point`
 * του Excel, όταν έρθουν οι τύποι στη Φ.Δ.11) προστίθεται εδώ και ο τύπος `Record` κάνει
 * τον μεταγλωττιστή να απαιτήσει το κλειδί της — αντί να ξεχαστεί σε ένα `default`.
 */
const MODE_KEY: Record<TableCellCursorMode, string> = {
  nav: 'table.mode.nav',
  enter: 'table.mode.enter',
  edit: 'table.mode.edit',
};

/** Inline «Πίνακας · Έτοιμο · 3 γραμμές × 2 στήλες · Esc για έξοδο», αλλιώς τίποτα. */
export function StatusBarActiveTableLeaf({ className, separatorClassName }: StatusBarActiveTableLeafProps) {
  const { t } = useTranslation('dxf-viewer');
  const cursor = useTableCellCursor();
  /**
   * 🔴 ADR-739 Φ.Δ βήμα 8 — γιατί εδώ διαβάζεται η **σκηνή** και όχι μόνο ο δρομέας.
   *
   * Το μέγεθος της επιλογής **δεν** είναι `|Δγραμμές| × |Δστήλες|`: η περιοχή «κουμπώνει»
   * ώστε να περικλείει ολόκληρες τις συγχωνεύσεις (§6.4). Σε πίνακα με συγχωνευμένη γραμμή
   * τίτλου — δηλαδή **και στους δύο** αληθινούς πίνακες της σκηνής — η αφελής αφαίρεση θα
   * έλεγε «1 × 1» ενώ ο καμβάς θα είχε μαρκάρει τρεις στήλες. Ένας αριθμός στη γραμμή
   * κατάστασης που διαφωνεί με την οθόνη είναι χειρότερος από κανέναν αριθμό.
   *
   * `useContext` απευθείας και **όχι** `useLevelsContext()`: εκείνο πετά σφάλμα εκτός
   * `LevelsSystem`, και μια γραμμή κατάστασης δεν επιτρέπεται να ρίξει την εφαρμογή επειδή
   * φιλοξενήθηκε αλλού. Απόν context ⇒ κανένα μέγεθος, όχι κρασάρισμα.
   *
   * Καμία συνδρομή στη σκηνή: το μέγεθος αλλάζει μόνο με τον **δρομέα**, που είναι ήδη η
   * συνδρομή αυτού του φύλλου (ADR-040 — ένα πάτημα πλήκτρου, ποτέ 60fps).
   */
  const levels = useContext(LevelsContext);
  const entity = cursor && levels ? resolveTableById(levels, cursor.entityId) : null;
  const size = resolveTableSelectionSize(cursor, entity);

  if (!cursor) return null;

  return (
    <>
      <span className={separatorClassName}>|</span>
      <span className={className}>
        {t('table.mode.label')} · {t(MODE_KEY[cursor.mode])}
        {size ? ` · ${t('table.range.size', { rows: size.rows, columns: size.columns })}` : ''}
        {' · '}
        {t('table.mode.hint')}
      </span>
    </>
  );
}
