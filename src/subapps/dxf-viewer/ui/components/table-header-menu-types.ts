/**
 * ADR-739 Φ.Δ / ADR-750 Φ3-Φ5 / ADR-755 — **το συμβόλαιο του μενού ζωνών δείκτη**.
 *
 * Εξήχθη από το `TableHeaderContextMenu.tsx` (N.7.1): εκείνο έφτασε **505/500** γραμμές όταν το
 * ADR-755 πρόσθεσε το τέταρτο χειριστήριο. Η τομή είναι σημασιολογική και όχι μετρική — εδώ ζει
 * **τι ζητά** το μενού από τον ξενιστή του, εκεί **πώς** συμπεριφέρονται οι δύο επιφάνειες.
 *
 * ## 🔑 Το επαναλαμβανόμενο σχήμα: ΜΙΑ ερώτηση ανά πάνελ, όχι N props
 * Τα τρία `resolve*` δεν είναι στιλιστική επιλογή. Το πάνελ περιγραμμάτων μεγάλωσε από 2 σε 5
 * ικανότητες μέσα σε μία φάση· με ξεχωριστά props, κάθε επόμενη θα πρόσθετε ακόμη ένα σε
 * **τρία** αρχεία. Έτσι ο τύπος του πάνελ **είναι** το συμβόλαιο: μια νέα ικανότητα εμφανίζεται
 * μόνη της και ο μεταγλωττιστής δείχνει το ένα σημείο που τη γεμίζει.
 *
 * @module subapps/dxf-viewer/ui/components/table-header-menu-types
 * @see ui/components/TableHeaderContextMenu.tsx — η υλοποίηση
 */

import type { TableHeaderMenuState } from './TableHeaderMenuItems';
import type {
  TableFormatSnapshot,
  TableMergeMenuHostProps,
  TableToggleFormatKey,
} from './table-format-toolbar/TableFormatToolbar';
import type { TableToolbarExtrasState } from './table-format-toolbar/table-toolbar-extras';
import type { TableBorderMenuProps } from './table-format-toolbar/TableBorderMenu';
import type { TextHeightStepDirection } from '../../bim/table/table-text-height-scale';
import type { TableIndicatorHit } from '../../bim/table/table-indicator-geometry';
import type { TableAxisStyleOverride, TableCellOverflow } from '../../types/table';

/**
 * ADR-750 Φ5 — το dropdown περιγραμμάτων **όπως το βλέπει ο ξενιστής**: όλα τα props του
 * πάνελ εκτός από τη θέση roving, που την ξέρει μόνο η γραμμή εργαλείων.
 *
 * Ονομασμένος τύπος και όχι inline `Omit<…>`: τον χρειάζονται **τρία** αρχεία (το prop, το
 * `OpenTarget`, ο ξενιστής της Φ4) και τρία inline `Omit` είναι τρεις ευκαιρίες να αποκλίνουν.
 */
export type TableBorderMenuHostProps = Omit<TableBorderMenuProps, 'roving'>;

/** Ένα item δέχεται πάντα **ποια** υποδιαίρεση πατήθηκε — ποτέ κρυφή κατάσταση. */
export type TableHeaderAction = (hit: TableIndicatorHit) => void;

export interface TableHeaderMenuProps {
  readonly onInsertBefore: TableHeaderAction;
  readonly onInsertAfter: TableHeaderAction;
  readonly onDelete: TableHeaderAction;
  /**
   * 🔴 ADR-739 §61 — **«Μορφοποίηση κελιών…»** και στις ζώνες δείκτη.
   *
   * Είναι θέση του Excel, όχι συμμετρία: το δεξί κλικ σε αριθμό γραμμής ή γράμμα στήλης δείχνει
   * εκεί «Format Cells…» **μετά** τη «Διαγραφή», μαζί με «Ύψος γραμμής…» / «Πλάτος στήλης…».
   * Το ότι εδώ η ίδια χειρονομία δίνει επιπλέον mini toolbar δεν αναιρεί την ανάγκη: η γραμμή
   * δείχνει τα **εννιά** χειριστήρια, ο διάλογος δείχνει ό,τι δεν χωρά σε κουμπί (ελεύθερη
   * γωνία, εσοχή, δεκαδικά, νόμισμα).
   *
   * ⚠️ `TableHeaderAction` όπως τα τρία δομικά: ο στόχος γεννιέται **από το χτύπημα**, τη στιγμή
   * του πατήματος, ώστε ένα undo ενόσω το μενού ήταν ανοιχτό να σημαίνει «δεν ανοίγει».
   */
  readonly onFormatCells: TableHeaderAction;
  readonly resolveState: (hit: TableIndicatorHit) => TableHeaderMenuState;
  /** Η κατάσταση των χειριστηρίων μορφοποίησης — ξαναρωτιέται **μετά από κάθε** πάτημα. */
  readonly resolveFormat: (hit: TableIndicatorHit) => TableFormatSnapshot;
  readonly onToggleFormat: (hit: TableIndicatorHit, key: TableToggleFormatKey) => void;
  readonly onStepTextHeight: (hit: TableIndicatorHit, direction: TextHeightStepDirection) => void;
  readonly onResetFormat: TableHeaderAction;
  /**
   * ADR-739 Φ.Ε/Φ4 — το χρώμα **κειμένου** του άξονα: `hex` ρητό · `undefined` «Αυτόματο»
   * (αφαιρεί την παράκαμψη· δεν γράφει ποτέ το χρώμα του στυλ ως ρητή τιμή).
   *
   * Περνά από τον **ίδιο** `runFormat` με τα Β/Ι/Υ, όχι από δικό του δρόμο: είναι πράξη άξονα,
   * άρα οφείλει να κλείνει το μενού και να αφήνει τη γραμμή ακριβώς όπως εκείνα (§28.13).
   */
  readonly onSetTextColor: (hit: TableIndicatorHit, value: string | undefined) => void;
  /**
   * ADR-739 Φ.Ε/Φ4β — το **γέμισμα**, με την τρίτη κατάσταση: `hex` ρητό · `null` ρητά κανένα ·
   * `undefined` «Αυτόματο». Δες `TableFormatToolbar` για το γιατί είναι ένα prop και όχι τρία.
   */
  readonly onSetFillColor: (hit: TableIndicatorHit, value: string | null | undefined) => void;
  /**
   * 🔴 ADR-739 §55 — **τυπογραφία, αριθμητική μορφή, στοίχιση** για τον άξονα που πατήθηκε.
   *
   * Μία ερώτηση για τρία τμήματα — το ίδιο σχήμα με τα `resolve*` από κάτω, και για τον ίδιο
   * λόγο: εμφανίζονται και εξαφανίζονται μαζί, οπότε «δύο από τα τρία» δεν πρέπει να είναι
   * εκφράσιμο. Ξαναρωτιέται μετά από **κάθε** πάτημα, όπως το {@link resolveFormat}: η γραμμή
   * επιβιώνει του μενού και το combobox οφείλει να δείξει το μέγεθος που μόλις γράφτηκε.
   */
  readonly resolveToolbar: (hit: TableIndicatorHit) => TableToolbarExtrasState;
  /**
   * 🔴 §55 — ο **ΕΝΑΣ** γραφέας των τεσσάρων νέων πεδίων, με το κλειδί ως όρισμα.
   *
   * Δες την αδελφή δήλωση στο `TableRangeContextMenu` (`TableRangeFormatActions.onSetField`)
   * για το γιατί ένας χειριστής και όχι τέσσερις — και γιατί τα δύο χρώματα κρατούν τα δικά
   * τους props.
   */
  readonly onSetFormatField: <K extends keyof TableAxisStyleOverride>(
    hit: TableIndicatorHit,
    key: K,
    value: TableAxisStyleOverride[K] | undefined,
  ) => void;
  /**
   * 🔴 §58 Γ2 — ο γραφέας του **ξεχειλίσματος**· ξεχωριστός από τον από πάνω.
   *
   * Δεν χωρά στο {@link onSetFormatField}: το `overflow` **δεν είναι**
   * `keyof TableAxisStyleOverride` — ζει μόνο στο `TableCellStyleOverride` και γράφεται πάντα σε
   * επίπεδο κελιού. Χωμένο εκεί θα απαιτούσε cast, δηλαδή θα έκανε εκφράσιμη μια εγγραφή που το
   * μοντέλο απορρίπτει. Δες `setTableFormatOverflow` για το γιατί «πάντα κελί».
   */
  readonly onSetOverflow: (hit: TableIndicatorHit, value: TableCellOverflow) => void;
  /**
   * ADR-750 Φ3/Φ5 — **όλο** το dropdown περιγραμμάτων του άξονα που πατήθηκε, σε μία ερώτηση.
   *
   * Ζει δίπλα στη μορφοποίηση κειμένου αλλά είναι **άλλο επίπεδο**: εκείνη γράφει στυλ άξονα,
   * αυτό γράφει ρητές ακμές πλέγματος και διαγωνίους κελιών. Γι' αυτό έχει και δική του
   * «Επαναφορά» (Α19).
   */
  readonly resolveBorderMenu: (hit: TableIndicatorHit) => TableBorderMenuHostProps;
  /**
   * ADR-755 — το split button **συγχώνευσης** για τον άξονα που πατήθηκε.
   *
   * Ίδιο σχήμα «μία ερώτηση» με το {@link resolveBorderMenu}, και για τον ίδιο λόγο. Η
   * συγχώνευση είναι πράξη **περιοχής**, αλλά ένας ολόκληρος άξονας *είναι* περιοχή — το Excel
   * επιτρέπει «συγχώνευσε ολόκληρη τη γραμμή», και θα ήταν αυθαίρετο να λείπει εδώ.
   */
  readonly resolveMergeMenu: (hit: TableIndicatorHit) => TableMergeMenuHostProps;
  /** Το μενού έκλεισε — με ή χωρίς ενέργεια. Εδώ επιστρέφει η εστίαση στο κελί. */
  readonly onClosed: () => void;
}

export interface TableHeaderContextMenuHandle {
  open: (x: number, y: number, hit: TableIndicatorHit) => void;
  close: () => void;
}

/**
 * Στόχος + κατάσταση, παγωμένα μαζί στο άνοιγμα: δεν μπορούν να αποκλίνουν μεταξύ τους.
 *
 * Τα τρία τελευταία πεδία είναι τα **μόνα** που ανανεώνονται όσο ζει η επιφάνεια — και
 * οφείλουν να ανανεώνονται: μετά την απόφαση του ιδιοκτήτη (2026-08-03) το πάτημα διώχνει το
 * μενού αλλά **αφήνει τη γραμμή στην οθόνη**, οπότε ένα «Β» που δεν φώτιζε θα έδειχνε ότι η
 * πράξη απέτυχε ενώ έχει ήδη εφαρμοστεί στον καμβά.
 */
export interface TableHeaderOpenTarget {
  readonly hit: TableIndicatorHit;
  readonly state: TableHeaderMenuState;
  readonly format: TableFormatSnapshot;
  /** ADR-739 §55 — ανανεώνεται **μαζί** με το `format`: ίδιο πάτημα, ίδια γραμμή, ίδια στιγμή. */
  readonly toolbar: TableToolbarExtrasState;
  /** ADR-750 Φ3/Φ5 — ανανεώνεται μαζί με το `format`, για τον ίδιο ακριβώς λόγο. */
  readonly borders: TableBorderMenuHostProps;
  /** ADR-755 — ίδιο σκεπτικό: μετά τη συγχώνευση το κουμπί οφείλει να δείξει πατημένο. */
  readonly merge: TableMergeMenuHostProps;
  /** Το σημείο του δεξιού κλικ — το toolbar κάθεται από πάνω του. */
  readonly anchor: { readonly x: number; readonly y: number };
}
