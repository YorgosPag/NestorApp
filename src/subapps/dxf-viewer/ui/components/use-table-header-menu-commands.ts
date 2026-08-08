'use client';

/**
 * 🔴 ADR-739 §62 — **η ΕΚΤΕΛΕΣΗ ΕΝΤΟΛΗΣ** του μενού ζωνών δείκτη, χωριστά από τον κύκλο ζωής του.
 *
 * ## Γιατί ΑΥΤΗ η τομή, και όχι όποια χωρούσε στις 24 γραμμές που έμεναν
 * Το `TableHeaderContextMenu.tsx` διακρίνει **ήδη** δύο ευθύνες στην κεφαλίδα του, και οι πέντε
 * τυλιχτές από κάτω είναι ολόκληρη η δεύτερη:
 *
 * ```
 *   ΚΥΚΛΟΣ ΖΩΗΣ   πού κάθεται ο κρυφός trigger · ποιος ο ΕΝΑΣ δρόμος εξόδου (§27.7) ·
 *                 escape-bus · «κλικ έξω» όσο ζει μόνη της η γραμμή
 *   ΕΚΤΕΛΕΣΗ      εφάρμοσε → ξαναρώτησε → κλείσε **μόνο** το μενού
 * ```
 *
 * Η δεύτερη είναι καθαρά «τι γίνεται όταν πατηθεί κουμπί» και **δεν αγγίζει** τίποτα από τη
 * μηχανική της πρώτης: δεν ξέρει από trigger, από Radix, από escape. Παίρνει τον ανοιχτό στόχο,
 * τον γραφέα του, και τον **έναν** δρόμο εξόδου — και επιστρέφει πέντε χειριστές.
 *
 * ## 🔴 Ο ΕΝΑΣ ΔΡΟΜΟΣ ΕΞΟΔΟΥ ΠΕΡΝΑ ΜΕΣΑ ΩΣ ΠΑΡΑΜΕΤΡΟΣ — δεν ξαναγράφεται εδώ
 * Το `closeMenuKeepToolbar` **μένει** στο component, γιατί ζει από τον κύκλο ζωής (`isOpen`,
 * `onClosed`) και είναι το μισό της απόφασης του ιδιοκτήτη «φεύγει μόνο το μενού». Ένα δεύτερο
 * σώμα εδώ θα ήταν ακριβώς η ασυμμετρία που ο **ένας** δρόμος του §27.7 υπάρχει για να λείπει.
 *
 * ## 🔴 ΓΙΑΤΙ `Pick<TableHeaderMenuProps, …>` ΚΑΙ ΟΧΙ ΞΑΝΑΓΡΑΜΜΕΝΕΣ ΥΠΟΓΡΑΦΕΣ
 * Οι έξι εξαρτήσεις είναι **ήδη** μέλη του συμβολαίου του μενού, με τη δική τους τεκμηρίωση στο
 * `table-header-menu-types.ts`. Ξαναγραμμένες εδώ θα ήταν δεύτερη δήλωση των **ίδιων** τύπων —
 * το σχήμα των δύο λιστών namespace του CHECK 3.34, που απέκλιναν κατά 63 χωρίς καμία πύλη να
 * τις συγκρίνει. Με `Pick` δεν υπάρχει τίποτα να αποκλίνει: αλλάζει η υπογραφή του
 * `onSetFormatField` και **ο μεταγλωττιστής** το φέρνει εδώ.
 *
 * @module subapps/dxf-viewer/ui/components/use-table-header-menu-commands
 * @see ui/components/TableHeaderContextMenu.tsx — ο κύκλος ζωής (το άλλο μισό)
 * @see ui/components/table-header-menu-types.ts — το συμβόλαιο, ΕΝΑ αντίγραφο
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { TableAxisStyleOverride, TableCellOverflow } from '../../types/table';
import type {
  TableHeaderAction,
  TableHeaderMenuProps,
  TableHeaderOpenTarget,
} from './table-header-menu-types';

/**
 * Ό,τι χρειάζεται η εκτέλεση και **τίποτα άλλο** — τα έξι μέλη του συμβολαίου που ξαναρωτούν ή
 * γράφουν, από την **μία** πηγή τους.
 */
export type TableHeaderCommandContract = Pick<
  TableHeaderMenuProps,
  | 'resolveFormat'
  | 'resolveToolbar'
  | 'resolveBorderMenu'
  | 'resolveMergeMenu'
  | 'onSetFormatField'
  | 'onSetOverflow'
>;

/** Οι πέντε χειριστές που καταναλώνει η γραμμή εργαλείων του μενού. */
export interface TableHeaderMenuCommands {
  readonly runFormat: (action: TableHeaderAction) => void;
  readonly setToolbarField: <K extends keyof TableAxisStyleOverride>(
    key: K,
    value: TableAxisStyleOverride[K] | undefined,
  ) => void;
  readonly setToolbarOverflow: (value: TableCellOverflow) => void;
  readonly runBorder: (action: TableHeaderAction) => void;
  readonly runMerge: (action: () => void | Promise<void>) => void;
}

export function useTableHeaderMenuCommands(
  contract: TableHeaderCommandContract,
  target: TableHeaderOpenTarget | null,
  setTarget: Dispatch<SetStateAction<TableHeaderOpenTarget | null>>,
  closeMenuKeepToolbar: () => void,
): TableHeaderMenuCommands {
  const {
    resolveFormat, resolveToolbar, resolveBorderMenu, resolveMergeMenu,
    onSetFormatField, onSetOverflow,
  } = contract;

  /**
   * Μια πράξη μορφοποίησης: εκτελείται και **μετά κλείνει ολόκληρη η επιφάνεια**.
   *
   * ## 🔴 ΑΝΑΤΡΟΠΗ ΤΟΥ ΡΙΣΚΟΥ 1 — ΑΠΟΦΑΣΗ ΙΔΙΟΚΤΗΤΗ (2026-08-03)
   * Μέχρι τότε εδώ γινόταν `setTarget({ …target, format: resolveFormat(…) })`: η πράξη
   * εκτελούνταν, η κατάσταση των κουμπιών ανανεωνόταν, και **το μενού έμενε ανοιχτό**. Ήταν
   * σχεδιασμένο, όχι τυχαίο — το §28.7 το ονομάζει «ρίσκο 1» και ολόκληρος ο φύλακας
   * `keepOpenOnToolbar` γράφτηκε γι' αυτό, με επιχείρημα ότι «η μορφοποίηση είναι κατεξοχήν
   * επαναλαμβανόμενη πράξη».
   *
   * Ο ιδιοκτήτης το ανέτρεψε ρητά: «όταν κάνω κλικ πάνω σε εντολές του toolbar **το κάτω
   * μενού να κλείνει**, όπως στο Excel». Και το Excel πράγματι κλείνει **και τις δύο**
   * επιφάνειες μετά από μία εντολή. Καταγράφεται ως ανατροπή ώστε να μη «διορθωθεί» πίσω
   * από κάποιον που θα διαβάσει μόνο το §28.7 ή τα παλιά σχόλια του toolbar.
   *
   * ## 🔴 ΤΟ ΜΗ ΠΡΟΦΑΝΕΣ: ο φύλακας ΔΕΝ αφαιρείται — γίνεται ΠΡΟΫΠΟΘΕΣΗ
   * Η «προφανής» υλοποίηση είναι να σβήσει κανείς τον `keepOpenOnToolbar` και να αφήσει το
   * Radix να κλείσει μόνο του. **Θα έσπαγε την ίδια την εντολή**: το `DismissableLayer`
   * κλείνει στο `pointerdown`, δηλαδή **πριν** το `click`. Το toolbar θα ξεμόνταρε ενδιάμεσα
   * και το `onClick` του κουμπιού **δεν θα έτρεχε ποτέ** — μενού που κλείνει χωρίς να έχει
   * γίνει τίποτα, η χειρότερη δυνατή εκδοχή.
   *
   * Άρα η σειρά είναι ρητή και αντίστροφη από τη διαίσθηση:
   * `pointerdown` ⇒ ο φύλακας **κρατά** ανοιχτό · `click` ⇒ εκτελείται η πράξη ⇒ **μετά**
   * κλείνουμε εμείς. Το κλείσιμο περνά από το `handleOpenChange` (§27.7: **ένας** δρόμος),
   * άρα η εστίαση επιστρέφει στο κελί ακριβώς όπως και στα δομικά items.
   *
   * ## 🔴 Η κατάσταση των κουμπιών ΞΑΝΑΡΩΤΙΕΤΑΙ — γιατί η γραμμή ΔΕΝ φεύγει
   * Ο ιδιοκτήτης διόρθωσε το εύρος μέσα στην ίδια συνεδρία: φεύγει **μόνο** το μενού. Άρα η
   * γραμμή μένει στην οθόνη και ένα «Β» που δεν φώτιζε μετά το πάτημα θα έδειχνε ότι η πράξη
   * απέτυχε ενώ έχει ήδη εφαρμοστεί στον καμβά.
   *
   * 🔴 Η ανανέωση γίνεται εδώ, **έξω** από τον updater του `setTarget`. Ένα
   * `setTarget(prev => { action(prev.hit); … })` θα εκτελούσε την πράξη **δύο φορές** σε
   * StrictMode (ο updater καλείται δύο φορές επίτηδες) — δύο εντολές, δύο βήματα undo, και
   * ένα «Β» που ανάβει και σβήνει μόνο του.
   */
  const runFormat = useCallback((action: TableHeaderAction) => {
    if (!target) return;
    action(target.hit);
    // §55 — **και τα δύο** στιγμιότυπα της γραμμής, με μία εγγραφή state: ένα «Α↑» αλλάζει
    // ταυτόχρονα το κουμπί μεγέθους και την τιμή του combobox, και δύο ξεχωριστές ανανεώσεις
    // θα άφηναν τη γραμμή να δείχνει δύο διαφορετικές αλήθειες για ένα καρέ.
    setTarget({ ...target, format: resolveFormat(target.hit), toolbar: resolveToolbar(target.hit) });
    closeMenuKeepToolbar();
  }, [target, setTarget, resolveFormat, resolveToolbar, closeMenuKeepToolbar]);

  /**
   * 🔴 §55 — ο γραφέας των τεσσάρων νέων πεδίων, τυλιγμένος στον **ίδιο** {@link runFormat}:
   * είναι πράξεις μορφοποίησης άξονα, άρα οφείλουν να κλείνουν το μενού και να αφήνουν τη
   * γραμμή ακριβώς όπως τα Β/Ι/Υ (§28.13).
   */
  const setToolbarField = useCallback(
    <K extends keyof TableAxisStyleOverride>(
      key: K,
      value: TableAxisStyleOverride[K] | undefined,
    ): void => {
      runFormat((hit) => onSetFormatField(hit, key, value));
    },
    [runFormat, onSetFormatField],
  );

  /**
   * 🔴 §58 Γ2 — το ξεχείλισμα, στον **ίδιο** {@link runFormat}: είναι πράξη μορφοποίησης, άρα
   * κλείνει το μενού και αφήνει τη γραμμή ακριβώς όπως τα Β/Ι/Υ (§28.13).
   */
  const setToolbarOverflow = useCallback(
    (value: TableCellOverflow): void => {
      runFormat((hit) => onSetOverflow(hit, value));
    },
    [runFormat, onSetOverflow],
  );

  /**
   * ADR-750 Φ3 — μια εντολή περιγράμματος: **ίδια σειρά** με το {@link runFormat}.
   *
   * Ξεχωριστός χειριστής και όχι κοινός, επειδή ανανεώνεται **άλλη** ερώτηση: η μορφοποίηση
   * ξαναρωτά το στυλ του άξονα, το περίγραμμα ξαναρωτά τις ρητές ακμές. Ένας χειριστής που
   * ξαναρωτούσε και τα δύο θα διέτρεχε όλα τα κελιά του άξονα **και** όλες τις ακμές της
   * περιοχής σε κάθε πάτημα — διπλάσια δουλειά, με τη μισή να απαντά σε ερώτηση που κανείς
   * δεν έκανε.
   */
  const runBorder = useCallback((action: TableHeaderAction) => {
    if (!target) return;
    action(target.hit);
    setTarget({ ...target, borders: resolveBorderMenu(target.hit) });
    closeMenuKeepToolbar();
  }, [target, setTarget, resolveBorderMenu, closeMenuKeepToolbar]);

  /**
   * 🔴 ADR-755 — μια εντολή **συγχώνευσης**: ίδια σειρά, με **μία** αναγκαστική αντιστροφή.
   *
   * Εδώ το μενού κλείνει **πριν** την πράξη, όχι μετά — και είναι το μοναδικό σημείο όπου
   * σπάει το μοτίβο των {@link runFormat} / {@link runBorder}. Ο λόγος είναι μετρήσιμος: η
   * συγχώνευση μπορεί να ανοίξει **modal διάλογο** («θα κρατηθεί μόνο η επάνω αριστερή
   * τιμή»). Με το μενού ακόμη ανοιχτό, ο διάλογος θα γεννιόταν κάτω από ένα Radix
   * `FocusScope` που επαναφέρει κάθε εστίαση στο `role="menu"` — δηλαδή ο χρήστης θα έβλεπε
   * ερώτηση που **δεν μπορεί να απαντήσει με πληκτρολόγιο**.
   *
   * Η ανανέωση της κατάστασης γίνεται **μετά** το `await`, με updater: το κουμπί οφείλει να
   * δείξει πατημένο μόλις η συγχώνευση γραφτεί, αλλά η γραμμή μπορεί στο μεταξύ να έχει
   * φύγει (`Escape`) — γι' αυτό ο έλεγχος `prev` και όχι κλεισμένο `target`.
   */
  const runMerge = useCallback((action: () => void | Promise<void>) => {
    if (!target) return;
    closeMenuKeepToolbar();
    void Promise.resolve(action()).then(() => {
      setTarget((prev) => (prev ? { ...prev, merge: resolveMergeMenu(prev.hit) } : prev));
    });
  }, [target, setTarget, resolveMergeMenu, closeMenuKeepToolbar]);

  return { runFormat, setToolbarField, setToolbarOverflow, runBorder, runMerge };
}
