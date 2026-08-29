/**
 * 🔴 ADR-828 §2 — **ΤΙ ΜΠΟΡΕΙ ΝΑ ΕΙΝΑΙ ΜΙΑ ΣΕΙΡΑ.** Καθαρό λεξιλόγιο: μηδέν μοντέλο, μηδέν
 * γεωμετρία, μηδέν React, μηδέν `t()`.
 *
 * ## Γιατί διακριτή ένωση και όχι σημαίες
 * Κάθε είδος σειράς χρειάζεται **άλλα** δεδομένα για να συνεχιστεί: ένας αριθμός θέλει βήμα
 * και δεκαδικά, ένας μήνας θέλει στήλη λεξιλογίου και μορφή γραφής, μια ημερομηνία θέλει
 * **μονάδα** βήματος. Ένα αντικείμενο με προαιρετικά πεδία θα επέτρεπε τον συνδυασμό
 * «μήνας με δεκαδικά», που δεν σημαίνει τίποτα, και θα μετέθετε τον έλεγχο σε χρόνο
 * εκτέλεσης — δηλαδή στο κελί του χρήστη.
 *
 * ## Το `'copy'` **δεν** είναι αποτυχία
 * Είναι ο **ένας** τρόπος να πει το σύστημα «δεν βλέπω σειρά· επανάλαβε το μοτίβο» — δηλαδή
 * ακριβώς η συμπεριφορά που είχε η λαβή πριν από αυτή τη δουλειά και που παραμένει σωστή για
 * τα περισσότερα κελιά ενός πίνακα ποσοτήτων. Ένα `null` θα ζητούσε από κάθε καλούντα να
 * θυμηθεί τι σημαίνει η απουσία· ένα ρητό είδος δεν ξεχνιέται.
 *
 * @module subapps/dxf-viewer/bim/table/table-fill-series-types
 * @see bim/table/table-fill-series-detect.ts — ποιο είδος είναι
 * @see bim/table/table-fill-series-generate.ts — τι γράφει το είδος στη θέση k
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §2
 */

import type { CalendarNameForm, CalendarNameListId } from '@/lib/date/calendar-name-vocabulary';
import type { WrittenWordShape } from '@/utils/greek-text';
import type { DecimalSeparator } from '@/lib/number/locale-number';
import type { TableCell } from '../../types/table';
import type { TableCellFormat } from '../../types/table-cell-format';

/**
 * Πώς προχωρά μια σειρά ημερομηνιών.
 *
 * ⚠️ Το `'weekday'` **δεν συμπεραίνεται ποτέ** από τα δεδομένα, και αυτό είναι σχεδιασμός:
 * «Δευτέρα, Τρίτη, Τετάρτη» είναι αριθμητικά **αδιάκριτο** από «+1 ημέρα» — και οι δύο
 * αναγνώσεις παράγουν τις ίδιες τρεις τιμές. Υπάρχει **μόνο** ως ρητή επιλογή του ανθρώπου
 * στο μενού «Συμπλήρωση καθημερινών». Γράφεται εδώ ώστε ο επόμενος να μη «συμπληρώσει» τον
 * ανιχνευτή νομίζοντας ότι ξεχάστηκε.
 */
export type TableDateStepUnit = 'day' | 'weekday' | 'month' | 'year';

/**
 * Πώς ήταν **γραμμένος** ο αριθμός — ό,τι χάνεται μόλις γίνει `number`.
 *
 * Χωρίς αυτό, σπόρος `10,5` με βήμα `0,5` θα συνέχιζε `11.5` με **τελεία**: ο χρήστης θα
 * έβλεπε τη στήλη του να αλλάζει σύμβαση στη μέση. Η μορφή προβολής (ADR-760) **δεν** είναι
 * απάντηση εδώ — εκείνη ζωγραφίζει έναν αποθηκευμένο αριθμό στην οθόνη, ενώ αυτό παράγει το
 * **κείμενο που θα είχε πληκτρολογήσει ο άνθρωπος**.
 */
export interface NumericWrittenShape {
  readonly decimalSeparator: DecimalSeparator;
  readonly decimals: number;
  readonly grouped: boolean;
}

/**
 * Το είδος της σειράς και ό,τι χρειάζεται για να συνεχιστεί.
 *
 * 🔑 Σε **όλα** τα είδη, το `start` είναι η τιμή στη θέση **0 = ο πρώτος σπόρος της λωρίδας**,
 * ποτέ ο τελευταίος. Αυτό είναι που κάνει την ανάστροφη σύρση δωρεάν: η θέση γίνεται
 * αρνητική και η ίδια έκφραση `start + step·k` εξάγει προς τα πίσω, χωρίς κλάδο.
 */
export type TableFillSeries =
  /** «Δεν είναι σειρά.» Ο καλών πέφτει πίσω στην κυκλική επανάληψη του μοτίβου. */
  | { readonly kind: 'copy' }
  | {
      readonly kind: 'numeric';
      readonly start: number;
      readonly step: number;
      readonly written: NumericWrittenShape;
    }
  | {
      readonly kind: 'suffix-number';
      /** Ό,τι προηγείται των ψηφίων, αυτούσιο: `'Στοιχείο '`. */
      readonly prefix: string;
      /** Ό,τι έπεται, αυτούσιο — συνήθως κενό. */
      readonly suffix: string;
      readonly start: number;
      readonly step: number;
      /** Μήκος ζωναρώματος με μηδενικά· `0` = κανένα. `Στοιχείο 001` ⇒ `3`. */
      readonly pad: number;
    }
  | {
      readonly kind: 'list';
      readonly listId: CalendarNameListId;
      /** 🔑 Η στήλη που **αναγνωρίστηκε** — και επομένως η στήλη που θα παραχθεί. */
      readonly form: CalendarNameForm;
      /** Κεφαλαία/πεζά/τόνοι του σπόρου, για να τα φορέσει η συνέχεια. */
      readonly shape: WrittenWordShape;
      /** **0-based** δείκτης του πρώτου σπόρου μέσα στη λίστα. */
      readonly start: number;
      readonly step: number;
    }
  | {
      readonly kind: 'date';
      /** Σειριακός αριθμός Excel του πρώτου σπόρου. */
      readonly start: number;
      readonly step: number;
      readonly unit: TableDateStepUnit;
    };

/**
 * Ένα κελί-σπόρος: το κελί **και η επιλυμένη μορφή του**.
 *
 * 🔴 Η μορφή δεν είναι προαιρετική διακόσμηση — είναι η **μόνη** πληροφορία εκτός κελιού που
 * ο ανιχνευτής επιτρέπεται να δει, και χωρίς αυτήν δεν μπορεί να ξεχωρίσει ημερομηνία από
 * αριθμό. Το `46239` είναι 5 Αυγούστου 2026 **ή** 46.239 ευρώ, και τη διαφορά τη γνωρίζει
 * μόνο η μορφή (ADR-760). Το να μαντέψουμε από το μέγεθος είναι ακριβώς αυτό που εκείνο το
 * ADR υπάρχει για να απαγορεύσει.
 */
export interface TableFillSeed {
  readonly cell: TableCell | undefined;
  readonly format: TableCellFormat;
}

/** Το «δεν είναι σειρά», ως μία σταθερά — ώστε να μη γεννιέται νέο αντικείμενο ανά απόρριψη. */
export const NOT_A_SERIES: TableFillSeries = { kind: 'copy' };
