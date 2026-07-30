/**
 * dxf-text-anchor — DXF `TEXT` / `ATTRIB` / `ATTDEF` anchor + 9-point attachment SSoT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ MODULE (ADR-635 Φ C.25)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο import διάβαζε τη θέση ΚΑΘΕ single-line TEXT από τα group **10/20** και το
 * **11/21 δεν το άνοιγε ποτέ**. Κατά το DXF spec (AcDbText) το 10/20 είναι το
 * *first* alignment point και είναι το πραγματικό σημείο σχεδίασης **μόνο** για
 * left-baseline κείμενο· μόλις το 72 (H-just) ή το 73 (V-just) γίνει non-zero,
 * το AutoCAD **αγνοεί** το 10/20 και αγκυρώνει στο **11/21** (*second* alignment
 * point). Στο `47_ergasia.dxf` του Giorgio: **433 από 1.127** TEXT έχουν 72∈{1,2}
 * και group 11 που **διαφέρει** από το 10 — και στα **433/433** διέφερε. Άρα
 * κάθε κεντραρισμένο/δεξιά-στοιχισμένο κείμενο σχεδιαζόταν μετατοπισμένο κατά
 * όλη την απόσταση insertion→alignment (μετρημένο: έως **3,3 m** στους πίνακες
 * συντεταγμένων, δηλ. ~μία ολόκληρη στήλη) ⇒ τα κείμενα «έφευγαν» από τις
 * στήλες και **επικάλυπταν** τα διπλανά.
 *
 * ⚠️ **ΜΟΝΟ για TEXT/ATTRIB/ATTDEF.** Στο **MTEXT** το group 11 είναι το
 * **x-axis direction vector**, ΟΧΙ σημείο — το MTEXT αγκυρώνεται πάντα στο
 * 10/20 κατά το code 71. Μη «γενικεύσεις» αυτό το module στο `convertMText`:
 * θα διάβαζε ένα διάνυσμα ως συντεταγμένη.
 *
 * ⚠️ **72 = 3 (Aligned) και 72 = 5 (Fit) ΔΕΝ αγκυρώνουν στο 11/21.** Εκεί το
 * κείμενο *τεντώνεται* ΜΕΤΑΞΥ 10/20 και 11/21 (το 11/21 είναι το άλλο άκρο,
 * όχι η άγκυρα). Ο renderer δεν υλοποιεί τέντωμα και το `mapHorizontalAlignment`
 * τα δίνει ως `'left'` ⇒ η σωστή άγκυρα είναι η **αρχή**, το 10/20. Αν κάποτε
 * μπει πραγματικό Aligned/Fit, το 11/21 μπαίνει ως *πλάτος-στόχος*, όχι ως θέση.
 *
 * @see ADR-635 Φ C.25 — AutoCAD DXF import entity coverage
 * @module utils/dxf-text-anchor
 */

import type { Point2D } from '../rendering/types/Types';
import type { TextJustification } from '../text-engine/types';
import { mapHorizontalAlignment } from './dxf-converter-helpers';

/**
 * Alignment → baseline row of the 9-point grid. The historic default for imported
 * single-line TEXT (73 = 0 = baseline), kept as the fallback when no vertical
 * justification is declared.
 */
export const ALIGNMENT_TO_ATTACHMENT: Record<'left' | 'center' | 'right', TextJustification> = {
  left: 'BL', center: 'BC', right: 'BR',
};

/**
 * Attachment row → DXF TEXT vertical-alignment code 73 (0=baseline, 1=bottom,
 * 2=middle, 3=top). INVERSE of the `row` half of {@link mapTextAttachment}; lives
 * next to its forward map so the two can never drift. Used by the export writer.
 * Bottom-row (`B*`) → 0 (baseline, the DXF default) keeps left-baseline TEXT
 * byte-identical on re-export.
 */
export function attachmentToVJust(attachment: TextJustification | undefined): 0 | 1 | 2 | 3 {
  switch (attachment?.[0]) {
    case 'T':
      return 3;
    case 'M':
      return 2;
    default:
      return 0;
  }
}

/**
 * Does this justification pair make the group 11/21 *second* alignment point the
 * real anchor? Per the DXF TEXT spec: yes for every non-left H-just that is a
 * true justification (1 Center, 2 Right, 4 Middle) and for ANY non-baseline
 * V-just — but NOT for 3 (Aligned) / 5 (Fit), where 11/21 is the far end of a
 * stretch span rather than an anchor (see the module header).
 */
export function usesAlignmentPoint(hJust: number, vJust: number): boolean {
  return hJust === 1 || hJust === 2 || hJust === 4 || vJust !== 0;
}

/**
 * The world point a single-line TEXT/ATTRIB/ATTDEF is actually drawn from.
 *
 * `position` on a scene `type:'text'` entity is its **attachment point** (see
 * `bim/text/text-box.ts` — every consumer, 2D glyphs / grips / hit-test / 3D
 * plane / bbox, resolves the box around it), so this must return the point the
 * chosen `attachment` refers to — i.e. the DXF alignment point when there is one.
 *
 * Falls back to 10/20 when the entity declares a justification but omits (or
 * malforms) 11/21 — a hand-written or truncated DXF must not turn into `NaN`
 * coordinates, which the import's non-finite filter would then drop entirely.
 */
export function resolveTextAnchor(
  data: Record<string, string>,
  hJust: number,
  vJust: number,
): Point2D {
  const insertion: Point2D = { x: parseFloat(data['10']), y: parseFloat(data['20']) };
  if (!usesAlignmentPoint(hJust, vJust)) return insertion;

  const x = parseFloat(data['11']);
  const y = parseFloat(data['21']);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : insertion;
}

/**
 * Is `position` the glyph BASELINE (DXF TEXT group 73 = 0, the default) rather than a row of
 * the 9-point grid? ADR-635 Φ C.26 — the state {@link mapTextAttachment} structurally cannot
 * return, because the grid has three rows and DXF has four vertical modes.
 *
 * 72 = 4 (Middle) is excluded for the SAME reason it forces row `M` there: the spec has it
 * override 73 entirely, so a 73 = 0 alongside it is not a baseline anchor. Keeping the two
 * functions' 72 = 4 rule identical is what stops the row and the flag from contradicting.
 *
 * 72 = 3 (Aligned) / 5 (Fit) DO sit on the baseline (they stretch horizontally, not vertically),
 * so they are deliberately NOT excluded.
 */
export function isBaselineAnchored(hJust: number, vJust: number): boolean {
  return vJust === 0 && hJust !== 4;
}

/**
 * DXF TEXT codes 72 (H) + 73 (V) → the 9-point attachment the text engine speaks.
 *
 * The column is derived through the EXISTING `mapHorizontalAlignment` SSoT (so the
 * entity's `alignment` field and its `textNode.attachment` can never disagree about
 * left/center/right), and only the row is decided here.
 *
 * Row: 3 → `T`, 2 → `M`, 0 (baseline) / 1 (bottom) → `B`. The 9-point grid has no
 * separate baseline slot, so baseline and bottom collapse to `B` here.
 *
 * ⚠️ That collapse is LOSSY and it is why every AutoCAD table text sat a font descent too
 * high (ADR-635 Φ C.26). The lost bit is carried alongside by {@link isBaselineAnchored} →
 * `DxfTextNode.baselineAnchored`; this function keeps returning the 9-point row because the
 * box / grips / 3D plane / export all speak that grid. Do NOT try to encode the baseline as
 * a fourth row here — widen the ANCHOR, not the grid.
 *
 * 72 = 4 (Middle) is BOTH horizontal center and vertical middle and the spec has it
 * override 73, so it forces row `M`.
 */
export function mapTextAttachment(hJust: number, vJust: number): TextJustification {
  const column = ALIGNMENT_TO_ATTACHMENT[mapHorizontalAlignment(hJust)][1];
  const row = hJust === 4 ? 'M' : vJust === 3 ? 'T' : vJust === 2 ? 'M' : 'B';
  return `${row}${column}` as TextJustification;
}
