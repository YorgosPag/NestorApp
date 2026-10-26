/**
 * Οι τύποι του γενικού πλέγματος δεδομένων (ADR-923 §5.10.4 Β1).
 *
 * 🔑 **Ένας ιδιοκτήτης των δεδομένων**: το πλέγμα **δεν** κρατά γραμμές. Παίρνει `rows`, και κάθε ενέργεια του
 * ανθρώπου (πληκτρολόγηση · επικόλληση · `Ctrl+D` · `Delete` · εναλλαγή) γίνεται **μία** κλήση `onChange` με τις
 * **νέες** γραμμές — άρα ο καταναλωτής γράφει **μία** εγγραφή ιστορικού ανά ενέργεια και κρίνει ό,τι θέλει
 * (π.χ. `judgeAggregate`) πάνω στο αποτέλεσμα.
 *
 * 🔑 **Μία γραμματική κειμένου ανά στήλη**: `text` (ό,τι φαίνεται και αντιγράφεται) ⇄ `parse` (κείμενο → νέα γραμμή).
 * Πληκτρολόγηση, επικόλληση από Excel και εισαγωγή TSV περνούν από **την ίδια** — δεν μπορούν να διαφωνήσουν.
 *
 * @module components/ui/data-grid/data-grid-types
 */

import type { ReactNode } from 'react';

import type { GridWriteReport } from '@/lib/spreadsheet/paste-plan';

/** Το αποτέλεσμα της ερμηνείας ενός κειμένου: η **νέα** γραμμή ή ένα μήνυμα (ήδη μεταφρασμένο). */
export type DataGridParse<Row> =
  | { readonly ok: true; readonly row: Row }
  | { readonly ok: false; readonly issue: string };

/** Πλάτη στηλών ως **κλάσεις** (N.3: κανένα inline style) — ο πίνακας είναι `table-fixed`. */
export type DataGridWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface DataGridChoice {
  readonly text: string;
  readonly label: string;
}

/** Γιατί ένα κελί δεν γράφεται — π.χ. «Ορίζεται στο MFP-TM» (κληρονομημένο, Δ1). */
export interface DataGridLock {
  readonly reason: string;
}

export interface DataGridColumn<Row> {
  readonly id: string;
  readonly header: ReactNode;
  /** Το όνομα της στήλης ως κείμενο — προσβάσιμο όνομα του πεδίου του ενεργού κελιού. */
  readonly label: string;
  readonly width: DataGridWidth;
  readonly align?: 'start' | 'end';
  /** Μόνιμα στα αριστερά κατά την οριζόντια κύλιση (η πρώτη στήλη αναγνωριστικού). */
  readonly sticky?: boolean;
  /** Ό,τι **φαίνεται** και ό,τι **αντιγράφεται** (TSV). */
  readonly text: (row: Row) => string;
  /** Προαιρετική πλουσιότερη απόδοση (σήματα, μικρογραφία) — αλλιώς το `text`. */
  readonly render?: (row: Row) => ReactNode;
  /** Κείμενο → νέα γραμμή. **Χωρίς** `parse` η στήλη είναι μόνο για ανάγνωση. Το `''` σημαίνει «άδειασε». */
  readonly parse?: (text: string, row: Row) => DataGridParse<Row>;
  /** Κελί κλειδωμένο **για αυτή τη γραμμή** (κληρονομημένο, άξονας υπάρχουσας παραλλαγής…). */
  readonly lock?: (row: Row) => DataGridLock | null;
  /** Επιλογές (`Alt+↓`): κάθε επιλογή είναι **κείμενο** που περνά από το ίδιο `parse`. */
  readonly choices?: (row: Row) => readonly DataGridChoice[];
  /** Διακόπτης: `Space` / κλικ ⇒ η νέα γραμμή. */
  readonly toggle?: (row: Row) => Row;
}

/** Τι έκανε ο άνθρωπος — για το ιστορικό και τις ανακοινώσεις. */
export type DataGridEditKind = 'type' | 'paste' | 'cut' | 'fill' | 'clear' | 'toggle' | 'choose';

export interface DataGridChange<Row> {
  readonly rows: readonly Row[];
  readonly kind: DataGridEditKind;
  /** Κελιά που δεν δέχτηκαν το κείμενο (επικόλληση): ανακοινώνονται, ποτέ σιωπηλά. */
  readonly rejected: readonly DataGridRejection[];
  readonly report: GridWriteReport | null;
}

export interface DataGridRejection {
  readonly row: number;
  readonly columnId: string;
  readonly text: string;
  readonly issue: string;
}

/** Οι λέξεις του πλέγματος — από τον καλούντα (το γενικό συστατικό δεν πληρώνει τίποτα στο κέλυφος i18n). */
export interface DataGridWords {
  /** «Ενεργό κελί: {column}, γραμμή {row}» κ.λπ. — μόνο ό,τι ανακοινώνεται. */
  readonly pasted: (report: GridWriteReport, rejected: number) => string;
  readonly locked: (reason: string) => string;
  readonly choicesLabel: (column: string) => string;
  readonly empty: string;
}

export interface DataGridProps<Row> {
  /** Προσβάσιμο όνομα του πλέγματος. */
  readonly label: string;
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row, index: number) => string;
  readonly columns: readonly DataGridColumn<Row>[];
  readonly words: DataGridWords;
  /** Απουσία ⇒ πλέγμα μόνο για ανάγνωση (πλοήγηση + αντιγραφή). */
  readonly onChange?: (change: DataGridChange<Row>) => void;
  /** Νέα κενή γραμμή — επιτρέπει επικόλληση πέρα από το τέλος (Glide · Airtable). */
  readonly createRow?: (index: number) => Row;
  /** Πόσες γραμμές επιτρέπεται να υπάρξουν συνολικά (π.χ. 200 απόγονοι ανά μοντέλο). */
  readonly maxRows?: number;
  /** Ευρήματα ανά κελί (ήδη μεταφρασμένα) — `aria-invalid` + περιγραφή. */
  readonly issuesOf?: (row: Row, index: number, columnId: string) => readonly string[];
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
  /** `Enter` σε γραμμή πλέγματος μόνο για ανάγνωση (λίστα) / διπλό κλικ ⇒ άνοιγμα. */
  readonly onActivateRow?: (row: Row, index: number) => void;
  /** Σημάδι γραμμής (π.χ. «νέα — δεν αποθηκεύτηκε», «ταιριάζει»). */
  readonly rowTone?: (row: Row, index: number) => 'new' | 'muted' | null;
  readonly className?: string;
}
