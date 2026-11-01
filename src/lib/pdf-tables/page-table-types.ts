/**
 * Οι ορισμοί της **ανασύνθεσης πίνακα από PDF** (ADR-923 §5.5.1): ουδέτεροι ως προς το τι είναι ο πίνακας. Όλες οι θέσεις είναι
 * κλάσματα σελίδας 0..1 με αρχή πάνω-αριστερά, ανεξάρτητα από ζουμ και ανάλυση.
 * @module lib/pdf-tables/page-table-types
 */

export interface PageBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Μια λέξη της στρώσης κειμένου, με τη θέση της. */
export interface PageWord extends PageBox {
  readonly id: string;
  readonly text: string;
}

/** Μια ζωγραφισμένη οριζόντια (`h`) ή κάθετη (`v`) γραμμή. `at` = η σταθερή συντεταγμένη, `from..to` = το άνοιγμα. */
export interface PageRule {
  readonly axis: 'h' | 'v';
  readonly at: number;
  readonly from: number;
  readonly to: number;
}

/** Πίνακας όπως τον δηλώνουν οι ετικέτες δομής του PDF. Το pdf.js δεν δίνει ενώσεις κελιών: είναι μάρτυρας, όχι γεωμετρία. */
export interface PageTagTable {
  readonly rows: readonly (readonly string[])[];
}

export interface PageTableCell {
  readonly row: number;
  readonly col: number;
  readonly rowSpan: number;
  readonly colSpan: number;
  /** Το κείμενο όπως τυπώνεται. Κενό = κενό κελί. */
  readonly text: string;
  readonly wordIds: readonly string[];
  readonly box: PageBox;
}

/** `ruled` = ζωγραφισμένες γραμμές · `aligned` = στοίχιση λέξεων, όταν δεν υπάρχουν γραμμές. */
export type PageTableSource = 'ruled' | 'aligned';

/** Τι λένε οι ετικέτες για την ανασύνθεση: `absent` = δεν υπάρχει δεύτερος μάρτυρας, όχι διαφωνία. */
export type PageTableWitness = 'agrees' | 'disputed' | 'absent';

export interface PageTable {
  /** Σταθερό μέσα στη σελίδα: `t0`, `t1`… από πάνω προς τα κάτω. */
  readonly key: string;
  readonly source: PageTableSource;
  readonly witness: PageTableWitness;
  readonly rowCount: number;
  readonly colCount: number;
  readonly cells: readonly PageTableCell[];
}
