/**
 * ADR-651 Φάση Γ — **μοντέλο φύλλου κατά ISO 5457** (καθαρή γεωμετρία, sheet-mm).
 *
 * Η κορνίζα σχεδίου είναι **παραμετρική γεωμετρία ανά μέγεθος χαρτιού**: το ίδιο μοντέλο
 * παράγει A4…A0 × όρθιο/πλαγιαστό χωρίς καμία σταθερά ανά μέγεθος. Δύο ρητές αποφάσεις
 * SSoT (αρχιτεκτονική Φάσης Γ — βλ. ADR-651 §5.2):
 *
 *  1. **Διαστάσεις χαρτιού**: ΔΕΝ ξαναγράφονται εδώ — έρχονται από το **paper SSoT** του
 *     print engine (`resolvePaperDimensionsMm`, ADR-453), το ίδιο που τυπώνει το PDF.
 *  2. **Αναπαράσταση σχεδίου**: ΔΕΝ εισάγεται νέο γεωμετρικό μοντέλο — παράγονται
 *     `DetailPrimitive[]` (ADR-622), οπότε και τα **τρία** υπάρχοντα backends (preview
 *     canvas / PDF / in-scene entities) ζωγραφίζουν την κορνίζα **δωρεάν**.
 *
 * Το module παράγει ΜΟΝΟ ορθογώνια (rects) + τα primitives του φύλλου. Το περιεχόμενο της
 * πινακίδας (κεφαλίδα, γραμμές πεδίων, σφραγίδα) ζει στο `title-block-layout.ts`, που
 * καταναλώνει αυτά τα rects — μία διάταξη, δύο ρόλοι, μηδέν τρίτη μηχανή.
 *
 * Σύμβαση συντεταγμένων: **sheet-mm, αρχή πάνω-αριστερά, +y προς τα κάτω** (η σύμβαση του
 * ADR-622· ο μετατροπέας προς σκηνή/PDF κάνει το y-flip).
 *
 * @see ../../print/config/paper-math.ts — resolvePaperDimensionsMm (SSoT μεγεθών χαρτιού)
 * @see ../../bim/structural/detail-sheet/detail-sheet-types.ts — DetailPrimitive (SSoT σχεδίου)
 */

import { fieldBlockHeightMm } from '../../bim/structural/detail-sheet/detail-sheet-field-block';
import type {
  DetailPrimitive,
  SheetStroke,
} from '../../bim/structural/detail-sheet/detail-sheet-types';
import { resolvePaperDimensionsMm } from '../../print/config/paper-math';
import type { PaperSpec, RectMm } from '../../print/config/paper-types';

/**
 * ISO 5457 — τα μόνα «μαγικά» νούμερα του προτύπου, σε ΕΝΑ σημείο.
 *
 * `titleBlockMaxWidthMm = 180` δεν είναι αυθαίρετο: είναι το τυπικό πλάτος πινακίδας
 * (ISO 7200) ΚΑΙ ακριβώς το καθαρό πλάτος του A4 όρθιου (210 − 20 − 10) — γι' αυτό στο A4
 * η πινακίδα πιάνει όλο το πλάτος της κορνίζας («κάτω», όπως ορίζει το πρότυπο), ενώ στα
 * A3–A0 μένει κάτω-δεξιά. Ένας κανόνας, δύο συμπεριφορές — καμία ειδική περίπτωση.
 */
export const ISO_5457 = Object.freeze({
  /** Περιθώριο αρχειοθέτησης (αριστερά — εκεί τρυπιέται/δένεται το σχέδιο). */
  filingMarginMm: 20,
  /** Περιθώριο στις άλλες τρεις ακμές. */
  edgeMarginMm: 10,
  /** Πάχος γραμμής περιγράμματος κορνίζας (ISO: βαρύ). */
  frameStrokeMm: 0.7,
  /** Πάχος γραμμής της ακμής κοπής του χαρτιού (βοηθητική — λεπτή). */
  sheetEdgeStrokeMm: 0.13,
  /** Τυπικό (μέγιστο) πλάτος πινακίδας — ISO 7200. */
  titleBlockMaxWidthMm: 180,
  /** Ελάχιστο ύψος πινακίδας, ώστε να μη «σφίγγει» σε πρότυπα με λίγες γραμμές. */
  titleBlockMinHeightMm: 30,
  /** Πλάτος κελιού σφραγίδας (αριστερά μέσα στην πινακίδα). */
  stampWidthMm: 45,
  /** Ελάχιστο ύψος πινακίδας όταν υπάρχει κελί σφραγίδας (να χωράει σφραγίδα/υπογραφή). */
  stampMinHeightMm: 42,
  /** Ανώτατο ποσοστό του ύψους της κορνίζας που επιτρέπεται να πιάσει η πινακίδα. */
  titleBlockMaxHeightFraction: 0.6,
});

const FRAME_HEX = '#111111';
const SHEET_EDGE_HEX = '#9AA0A6';

/** Το βαρύ περίγραμμα (κορνίζα + κουτί πινακίδας). */
export const FRAME_STROKE: SheetStroke = { colorHex: FRAME_HEX, widthMm: ISO_5457.frameStrokeMm };

/** Η λεπτή ακμή κοπής του χαρτιού (δείχνει πού τελειώνει το φύλλο). */
const SHEET_EDGE_STROKE: SheetStroke = {
  colorHex: SHEET_EDGE_HEX,
  widthMm: ISO_5457.sheetEdgeStrokeMm,
};

/** Τα ορθογώνια του φύλλου — ό,τι χρειάζεται η διάταξη, χωρίς primitives. */
export interface SheetFrameMetrics {
  readonly sheetWidthMm: number;
  readonly sheetHeightMm: number;
  /** Η κορνίζα σχεδίασης (μέσα από τα περιθώρια ISO). */
  readonly frame: RectMm;
  /** Το κουτί της πινακίδας — κάτω-δεξιά μέσα στην κορνίζα. */
  readonly titleBlock: RectMm;
  /** Κελί σφραγίδας (αριστερό τμήμα της πινακίδας)· `null` όταν το preset δεν το θέλει. */
  readonly stamp: RectMm | null;
  /** Η ζώνη που παίρνουν κεφαλίδα + γραμμές πεδίων (πινακίδα μείον σφραγίδα). */
  readonly fields: RectMm;
}

export interface SheetFrameInput {
  readonly paper: PaperSpec;
  /** Πλήθος γραμμών πεδίων — ορίζει το φυσικό ύψος της πινακίδας (ADR-622 SSoT). */
  readonly rowCount: number;
  readonly withStampBox: boolean;
}

/** Ύψος πινακίδας: φυσικό ύψος γραμμών, με τα ελάχιστα του προτύπου, φραγμένο στην κορνίζα. */
function resolveTitleBlockHeightMm(
  frameHeightMm: number,
  rowCount: number,
  withStampBox: boolean,
): number {
  const natural = Math.max(
    fieldBlockHeightMm(rowCount),
    ISO_5457.titleBlockMinHeightMm,
    withStampBox ? ISO_5457.stampMinHeightMm : 0,
  );
  return Math.min(natural, frameHeightMm * ISO_5457.titleBlockMaxHeightFraction);
}

/**
 * Τα ορθογώνια του φύλλου για το δοσμένο χαρτί. Καθαρή συνάρτηση: ίδιο input ⇒ ίδιο output
 * (το ghost και το commit ΠΡΕΠΕΙ να συμφωνούν — N.7.2).
 */
export function computeSheetFrameMetrics(input: SheetFrameInput): SheetFrameMetrics {
  const dims = resolvePaperDimensionsMm(input.paper);
  const frame: RectMm = {
    x: ISO_5457.filingMarginMm,
    y: ISO_5457.edgeMarginMm,
    w: dims.widthMm - ISO_5457.filingMarginMm - ISO_5457.edgeMarginMm,
    h: dims.heightMm - 2 * ISO_5457.edgeMarginMm,
  };

  const tbWidthMm = Math.min(ISO_5457.titleBlockMaxWidthMm, frame.w);
  const tbHeightMm = resolveTitleBlockHeightMm(frame.h, input.rowCount, input.withStampBox);
  const titleBlock: RectMm = {
    x: frame.x + frame.w - tbWidthMm,
    y: frame.y + frame.h - tbHeightMm,
    w: tbWidthMm,
    h: tbHeightMm,
  };

  const stampWidthMm = input.withStampBox
    ? Math.min(ISO_5457.stampWidthMm, titleBlock.w * 0.35)
    : 0;
  const stamp: RectMm | null = input.withStampBox
    ? { x: titleBlock.x, y: titleBlock.y, w: stampWidthMm, h: titleBlock.h }
    : null;
  const fields: RectMm = {
    x: titleBlock.x + stampWidthMm,
    y: titleBlock.y,
    w: titleBlock.w - stampWidthMm,
    h: titleBlock.h,
  };

  return {
    sheetWidthMm: dims.widthMm,
    sheetHeightMm: dims.heightMm,
    frame,
    titleBlock,
    stamp,
    fields,
  };
}

/**
 * Η **ωφέλιμη περιοχή** του φύλλου: η κορνίζα μείον την πινακίδα. Επειδή η πινακίδα κάθεται
 * κάτω-δεξιά, η ελεύθερη περιοχή είναι σχήμα **Γ** — και ένα ορθογώνιο σχέδιο χωράει σε Γ
 * **ακριβώς όταν** χωράει σε ένα από τα δύο μέγιστα ορθογώνιά του:
 *
 *   (α) **δίπλα** στην πινακίδα — όλο το ύψος, πλάτος μέχρι την πινακίδα,
 *   (β) **πάνω** από την πινακίδα — όλο το πλάτος, ύψος μέχρι την πινακίδα.
 *
 * ΕΝΑΣ ορισμός, δύο καταναλωτές: η **πρόταση χαρτιού** ρωτά «χωράει;» (`suggest-paper`) και
 * η **εκτύπωση** ρωτά «πού μπαίνει το σχέδιο;» (ADR-651 Φάση ΣΤ) — άρα το σχέδιο τυπώνεται
 * ακριβώς εκεί που η πρόταση υποσχέθηκε ότι χωράει, και **ποτέ** κάτω από την πινακίδα.
 */
export function usableAreaRects(metrics: SheetFrameMetrics): readonly [RectMm, RectMm] {
  const { frame, titleBlock } = metrics;
  const beside: RectMm = { x: frame.x, y: frame.y, w: frame.w - titleBlock.w, h: frame.h };
  const above: RectMm = { x: frame.x, y: frame.y, w: frame.w, h: frame.h - titleBlock.h };
  return [beside, above];
}

/** Το μεγαλύτερο (σε εμβαδόν) από τα δύο ωφέλιμα ορθογώνια — εκεί τυπώνεται το σχέδιο. */
export function largestUsableRect(metrics: SheetFrameMetrics): RectMm {
  const [beside, above] = usableAreaRects(metrics);
  return beside.w * beside.h > above.w * above.h ? beside : above;
}

/** Μετατόπιση ορθογωνίου (χρησιμοποιείται όταν η πινακίδα μπαίνει ΧΩΡΙΣ κορνίζα, στο (0,0)). */
export function translateRect(rect: RectMm, dx: number, dy: number): RectMm {
  return { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h };
}

/** Κλειστό ορθογώνιο περίγραμμα ως primitive. */
export function rectOutline(rect: RectMm, stroke: SheetStroke): DetailPrimitive {
  return {
    kind: 'polyline',
    closed: true,
    stroke,
    points: [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ],
  };
}

/**
 * Η κορνίζα του φύλλου: ακμή κοπής χαρτιού (λεπτή) + περίγραμμα σχεδίασης (βαρύ, 0.7mm).
 * Το κουτί της πινακίδας ΔΕΝ ζωγραφίζεται εδώ — ανήκει στο `title-block-layout`.
 */
export function buildSheetFramePrimitives(metrics: SheetFrameMetrics): DetailPrimitive[] {
  const sheet: RectMm = { x: 0, y: 0, w: metrics.sheetWidthMm, h: metrics.sheetHeightMm };
  return [rectOutline(sheet, SHEET_EDGE_STROKE), rectOutline(metrics.frame, FRAME_STROKE)];
}
