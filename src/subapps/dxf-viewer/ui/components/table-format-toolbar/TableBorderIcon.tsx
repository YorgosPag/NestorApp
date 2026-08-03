'use client';

/**
 * ADR-750 Φάση 3 — **το εικονίδιο κάθε εντολής περιγράμματος, παραγόμενο από το μητρώο**.
 *
 * ## 🔑 Γιατί ΕΝΑ συστατικό και όχι δεκατρία SVG
 * Δεκατρία χειρόγραφα SVG είναι δεκατρία αδέλφια-κλώνοι (CHECK 3.28, N.18) — ακριβώς το λάθος
 * που απέφυγε η Φ2 με το μητρώο, μεταφερμένο στο UI. Και, χειρότερα από το διπλότυπο: ένα
 * χειρόγραφο εικονίδιο μπορεί να **διαφωνήσει** με τη συμπεριφορά του κουμπιού του, και κανένα
 * test δεν βλέπει τη διαφωνία — δεν υπάρχει τίποτα να συγκρίνει.
 *
 * Εδώ το εικονίδιο **δεν μιμείται** την εντολή: εκτελεί **τις ίδιες συναρτήσεις γεωμετρίας**
 * ({@link tableBorderSideOrientation}, {@link tableBorderSideCrossings}) που εκτελεί και ο
 * εφαρμοστής, με όρια ένα πλέγμα 2×2 αντί για τον πίνακα του χρήστη. Η απόκλιση δεν είναι
 * απίθανη — είναι **μη εκφράσιμη**. Το Excel έχει 13 στατικά bitmap που *μπορούν* να αποκλίνουν·
 * εδώ δεν υπάρχει δεύτερη πηγή να αποκλίνει από την πρώτη.
 *
 * ## Τα δύο επίπεδα γραμμής (§8.2, μετρημένα)
 * ```
 * διάστικτο πλέγμα 2×2  →  ΣΥΜΦΡΑΖΟΜΕΝΟ («εδώ είναι τα κελιά»)
 * συμπαγής γραμμή       →  ΕΝΕΡΓΕΙΑ («αυτές τις ακμές αφορά»), σε τρία πάχη κατά `pen`
 * ```
 * ⚠️ Το πλέγμα δεν είναι διακόσμηση. Μια μόνη συμπαγής γραμμή σε κενό φόντο λέει «γραμμή», όχι
 * «κάτω» — το «κάτω» προκύπτει **μόνο** από τη θέση της σε ορατό πλέγμα. Χωρίς αυτό, και τα 13
 * εικονίδια θα ήταν αδιάκριτα μεταξύ τους.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableBorderIcon
 * @see bim/table/table-range-border-ops.ts — το μητρώο και η γεωμετρία που καταναλώνει
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §8.2 · §18
 */

import React from 'react';
import type { TableEdgeOrientation } from '../../../types/table-edges';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import {
  tableBorderSideCrossings,
  tableBorderSideOrientation,
  type TableBorderCommand,
  type TableBorderPen,
} from '../../../bim/table/table-range-border-ops';
import styles from './TableBorderIcon.module.css';

/**
 * Το πλέγμα του εικονιδίου είναι **περιοχή 2×2** — ο μικρότερος πίνακας στον οποίο και οι έξι
 * πλευρές είναι διακριτές. Σε 1×1 οι εσωτερικές δεν υπάρχουν καν (η `insideH` δίνει κενό), άρα
 * «Όλα τα περιγράμματα» και «Εξωτερικά» θα ζωγραφίζονταν **ταυτόσημα**.
 */
const ICON_BOUNDS: TableCellRangeBounds = { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 };

/** Πλευρά του viewBox σε μονάδες SVG — η κλίμακα την ορίζει το `size` του καλούντος. */
const VIEW = 16;
/** Περιθώριο ώστε το πάχος της εξωτερικής γραμμής να μην κόβεται στο όριο του viewBox. */
const PAD = 1.5;
/** Απόσταση δύο διαδοχικών γραμμών του πλέγματος (3 γραμμές ⇒ 2 διαστήματα). */
const STEP = (VIEW - 2 * PAD) / 2;

const PEN_WIDTH: Readonly<Record<Exclude<TableBorderPen, 'hidden'>, number>> = {
  base: 1.1,
  thick: 2.2,
  double: 0.85,
};

/** Απόσταση των δύο παράλληλων της διπλής γραμμής, εκατέρωθεν του άξονά της. */
const DOUBLE_GAP = 1.1;

/**
 * Μία γραμμή του εικονιδίου: προσανατολισμός, θέση σε δείκτες πλέγματος (0–2), μολύβι.
 *
 * Το `'hidden'` **αποκλείεται στον τύπο** και όχι με έλεγχο στο σώμα: μια αόρατη γραμμή δεν
 * είναι γραμμή του εικονιδίου, οπότε ο μεταγλωττιστής εγγυάται ότι το {@link PEN_WIDTH} έχει
 * πάντα απάντηση — καμία περίπτωση «τι πάχος έχει το τίποτα».
 */
interface IconLine {
  readonly orientation: TableEdgeOrientation;
  readonly at: number;
  readonly pen: Exclude<TableBorderPen, 'hidden'>;
}

export interface TableBorderIconProps {
  readonly command: TableBorderCommand;
  /** Πλευρά σε px· το εικονίδιο κλιμακώνεται, οι αναλογίες μένουν. */
  readonly size?: number;
}

/**
 * Το εικονίδιο μιας εντολής.
 *
 * `aria-hidden`: το όνομα του κουμπιού το δίνει το `aria-label` του γονέα (§9.2). Ένα εικονίδιο
 * που διεκδικεί όνομα θα διαβαζόταν δύο φορές.
 */
export function TableBorderIcon({ command, size = 16 }: TableBorderIconProps): React.ReactElement {
  return (
    <TableIconFrame size={size}>
      {/*
        🔑 Το κλειδί είναι **μόνο** η θέση, χωρίς δείκτη πίνακα — και αυτό είναι εγγύηση, όχι
        αισιοδοξία: οι έξι πλευρές είναι **ανά δύο ξένες** (`table-range-border-ops.ts`,
        αναλλοίωτη που η Φ2 έκανε άμεσα ελέγξιμη με το `tableRangeSideEdges`). Δύο σκέλη της
        ίδιας εντολής δεν μπορούν να διεκδικήσουν την ίδια γραμμή, άρα δύο ίδια κλειδιά δεν
        είναι εκφράσιμα.
      */}
      {commandLines(command).map((line) => (
        <React.Fragment key={`${line.orientation}${line.at}`}>{strokesOf(line)}</React.Fragment>
      ))}
    </TableIconFrame>
  );
}

/** Η πλευρά του τετράγωνου πλέγματος 2×2 σε μονάδες viewBox — το «κελί» κάθε εικονιδίου. */
export const TABLE_ICON_BOX = { x: PAD, y: PAD, w: VIEW - 2 * PAD, h: VIEW - 2 * PAD } as const;

/**
 * ADR-750 Φ5 — **το κοινό καρέ κάθε εικονιδίου του μενού**: το `<svg>` και το διάστικτο
 * πλέγμα 2×2 του συμφραζομένου. Τα «ενεργά» στοιχεία τα δίνει ο καλών.
 *
 * Εξήχθη όταν προστέθηκαν τα εικονίδια των **διαγωνίων**: εκείνα χρειάζονται ακριβώς το ίδιο
 * πλέγμα και το ίδιο viewBox, και ένα δεύτερο αντίγραφο θα ήταν sibling clone (CHECK 3.28) —
 * αλλά κυρίως θα ήταν **δεύτερο πλέγμα**, που θα μπορούσε κάποτε να έχει άλλο βήμα ή άλλη
 * διάστιξη από το πρώτο. Δύο εικονίδια δίπλα-δίπλα με διαφορετικό πλέγμα διαβάζονται ως δύο
 * διαφορετικά πράγματα.
 */
export function TableIconFrame({
  size = 16, children,
}: { readonly size?: number; readonly children: React.ReactNode }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
    >
      <g className={styles.grid} strokeWidth={0.75} strokeDasharray="1.4 1.4">
        {gridLines().map(({ orientation, at }) => (
          <line key={`${orientation}${at}`} {...segment(orientation, at)} />
        ))}
      </g>
      <g className={styles.active}>{children}</g>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — από το μητρώο στη γεωμετρία
// ──────────────────────────────────────────────────────────────────────────────

/** Οι έξι γραμμές του διάστικτου πλέγματος: τρεις ανά προσανατολισμό. */
function gridLines(): readonly Pick<IconLine, 'orientation' | 'at'>[] {
  const lines: Pick<IconLine, 'orientation' | 'at'>[] = [];
  for (const orientation of ['H', 'V'] as const) {
    for (let at = 0; at <= 2; at++) lines.push({ orientation, at });
  }
  return lines;
}

/**
 * Οι **ενεργές** γραμμές μιας εντολής — η ίδια ερώτηση που κάνει ο εφαρμοστής, με άλλα όρια.
 *
 * Το `'hidden'` παραλείπεται **χωρίς ειδική περίπτωση**: το αόρατο μολύβι δεν έχει τι να δείξει,
 * οπότε το «Χωρίς περίγραμμα» βγαίνει σκέτο διάστικτο πλέγμα — που είναι ακριβώς το εικονίδιό
 * του στο Excel. Η σημασιολογία («τι μολύβι μπαίνει») δίνει το σωστό σχέδιο μόνη της.
 */
function commandLines(command: TableBorderCommand): readonly IconLine[] {
  const lines: IconLine[] = [];
  for (const part of command.parts) {
    if (part.pen === 'hidden') continue;
    for (const side of part.sides) {
      const orientation = tableBorderSideOrientation(side);
      for (const at of tableBorderSideCrossings(side, ICON_BOUNDS)) {
        lines.push({ orientation, at, pen: part.pen });
      }
    }
  }
  return lines;
}

/** Μία ή δύο `<line>` κατά το μολύβι — η διπλή είναι δύο παράλληλες, ποτέ διακεκομμένη (§6.4). */
function strokesOf(line: IconLine): React.ReactElement | readonly React.ReactElement[] {
  const width = PEN_WIDTH[line.pen];
  if (line.pen !== 'double') {
    return <line strokeWidth={width} {...segment(line.orientation, line.at)} />;
  }
  return [-DOUBLE_GAP, DOUBLE_GAP].map((offset) => (
    <line
      key={offset}
      strokeWidth={width}
      {...segment(line.orientation, line.at, offset)}
    />
  ));
}

/** Δείκτης πλέγματος ⇒ συντεταγμένες του viewBox. Το `offset` μετατοπίζει εγκάρσια (διπλή). */
function segment(
  orientation: TableEdgeOrientation,
  at: number,
  offset = 0,
): { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number } {
  const cross = PAD + at * STEP + offset;
  return orientation === 'H'
    ? { x1: PAD, y1: cross, x2: VIEW - PAD, y2: cross }
    : { x1: cross, y1: PAD, x2: cross, y2: VIEW - PAD };
}
