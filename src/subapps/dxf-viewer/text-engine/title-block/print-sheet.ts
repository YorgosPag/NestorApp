/**
 * ADR-651 Φάση ΣΤ — **το τυπωμένο φύλλο**: η ΙΔΙΑ πινακίδα/κορνίζα της οθόνης, πάνω στη
 * σελίδα του PDF.
 *
 * WYSIWYG (πρακτική Revit/ArchiCAD/Vectorworks): **δεν υπάρχει δεύτερη μηχανή πινακίδας για
 * την εκτύπωση**. Το print engine καταναλώνει το ΙΔΙΟ layout model της Φάσης Γ
 * (`buildTitleBlockLayout` → `DetailPrimitive[]`, ADR-622) και το ζωγραφίζει με τον ΙΔΙΟ
 * jsPDF ζωγράφο που ήδη τυπώνει τα φύλλα λεπτομερειών (`detail-pdf-primitives`).
 *
 * Δύο πράγματα ορίζει αυτό το module — και τα δύο καθαρές συναρτήσεις:
 *  1. **τι ζωγραφίζεται** (κορνίζα ISO 5457 + πινακίδα, σε sheet-mm = page-mm· καμία
 *     μετατροπή, καμία αναστροφή άξονα),
 *  2. **πού μπαίνει το σχέδιο** — στην **ωφέλιμη** περιοχή (κορνίζα μείον πινακίδα, SSoT
 *     `sheet-frame.ts`), ώστε το σχέδιο να μην τυπώνεται ποτέ κάτω από την πινακίδα. Το
 *     legacy `drawTitleBlock` ζωγράφιζε ένα αδιαφανές κουτί **πάνω** στο σχέδιο· οι μεγάλοι
 *     δεν το κάνουν αυτό — το σχέδιο ζει **μέσα** στην κορνίζα.
 *
 * Το **χαρτί** έρχεται από το `PrintRequest` (ό,τι διάλεξε ο χρήστης στον διάλογο
 * εκτύπωσης) — όχι από το ribbon store: τυπώνεις σε αυτό που βάζεις στον εκτυπωτή.
 *
 * @see ./sheet-frame.ts — ISO 5457 γεωμετρία + ωφέλιμη περιοχή (SSoT)
 * @see ../../print/assemble/pdf-assembler.ts — ο καταναλωτής
 */

import type { DetailPrimitive } from '../../bim/structural/detail-sheet/detail-sheet-types';
import type { PaperSpec, PrintableAreaMm, RectMm } from '../../print/config/paper-types';
import { computeSheetFrameMetrics, largestUsableRect } from './sheet-frame';
import { buildTitleBlockLayout, type TitleBlockLayoutOptions } from './title-block-layout';
import type { TitleBlockContent } from './title-block-rows';

/** Οι επιλογές της πινακίδας **χωρίς** το χαρτί/αρχή — αυτά τα ορίζει η εκτύπωση. */
export type TitleBlockSheetOptions = Omit<TitleBlockLayoutOptions, 'paper' | 'origin'>;

export interface PrintSheetInput {
  /** Το χαρτί του print request (νικά πάντα το χαρτί του ribbon). */
  readonly paper: PaperSpec;
  /** Το ΛΥΜΕΝΟ περιεχόμενο της πινακίδας (πραγματικά στοιχεία έργου/μελετητή). */
  readonly content: TitleBlockContent;
  readonly options: TitleBlockSheetOptions;
}

export interface PrintSheet {
  /** Κορνίζα + πινακίδα σε page-mm (αρχή = γωνία σελίδας, +y κάτω). */
  readonly primitives: readonly DetailPrimitive[];
  /** Εκεί τοποθετείται το σχέδιο (raster ή vector) — ποτέ κάτω από την πινακίδα. */
  readonly drawingAreaMm: PrintableAreaMm;
}

/** Το ίδιο ορθογώνιο, στο λεξιλόγιο του print engine. */
function toPrintableArea(rect: RectMm): PrintableAreaMm {
  return { xMm: rect.x, yMm: rect.y, widthMm: rect.w, heightMm: rect.h };
}

/**
 * Το φύλλο εκτύπωσης για το δοσμένο χαρτί + περιεχόμενο. Καθαρή συνάρτηση: ίδιο input ⇒
 * ίδιο output (η σελίδα PDF και το in-scene block παράγονται από την ίδια γεωμετρία).
 */
export function buildPrintSheet(input: PrintSheetInput): PrintSheet {
  const layout = buildTitleBlockLayout(input.content, {
    ...input.options,
    paper: input.paper,
    // Η σελίδα PDF ΕΙΝΑΙ το φύλλο: το (0,0) είναι η γωνία της, με ή χωρίς ζωγραφισμένη κορνίζα.
    origin: 'sheet',
  });
  const metrics = computeSheetFrameMetrics({
    paper: input.paper,
    rowCount: input.content.rows.length,
    withStampBox: input.options.withStampBox,
  });
  return {
    primitives: layout.primitives,
    drawingAreaMm: toPrintableArea(largestUsableRect(metrics)),
  };
}
