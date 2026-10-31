/**
 * Ο **κριτής διάταξης** (ADR-923 §5.6.1): κρίνει το **τελικό PDF**, όχι το πρότυπο. Τρέχει σε κάθε έκδοση και στην πύλη CHECK 3.110.
 *
 * | Μέτρηση | Τι σημαίνει στο χαρτί |
 * |---|---|
 * | `overlappingTextCount` | κείμενο που πατά άλλο κείμενο (π.χ. τιμή πάνω στο διπλανό κελί) |
 * | `clippedTextCount` | κείμενο που βγαίνει έξω από το κομμένο χαρτί |
 * | `undersizedTextCount` | κείμενο κάτω από το {@link PUBLICATION_MIN_TEXT_PT} |
 *
 * 🔑 Μετρά μόνο τη **ζώνη των γραμμάτων** και όχι όλο το κουτί της γραμμής: οι ουρές μιας γραμμής αγγίζουν νόμιμα την επόμενη.
 * 🔑 Το `runsExamined` είναι μέρος της απάντησης: «0 επικαλύψεις σε 0 κομμάτια» σημαίνει ότι κανείς δεν κοίταξε.
 * @module subapps/catalog/publishing/publication-layout-judge
 */

/** Κάτω από αυτό το μέγεθος ένας τυπωμένος τεχνικός πίνακας δεν διαβάζεται άνετα. */
export const PUBLICATION_MIN_TEXT_PT = 6;

const OVERLAP_MIN_PT = 0.5;
const OVERLAP_MIN_BAND_SHARE = 0.25;
const CLIP_TOLERANCE_PT = 0.5;
/** Η ζώνη των γραμμάτων, σε κλάσμα μεγέθους πάνω από τη γραμμή βάσης. */
const GLYPH_BAND = [0.1, 0.65] as const;
const SAMPLE_LIMIT = 5;

export interface JudgedTextRun {
  readonly text: string;
  readonly transform: readonly number[];
  readonly width: number;
}

export interface JudgedPage {
  readonly widthPt: number;
  readonly heightPt: number;
  readonly runs: readonly JudgedTextRun[];
}

export interface PublicationLayoutVerdict {
  readonly pagesExamined: number;
  readonly runsExamined: number;
  readonly overlappingTextCount: number;
  readonly clippedTextCount: number;
  readonly undersizedTextCount: number;
  /** Λίγα δείγματα για το αρχείο καταγραφής και το μήνυμα της πύλης: `σελίδα: «α» × «β»`. */
  readonly samples: readonly string[];
}

interface TextBox {
  readonly text: string;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}

const sizeOf = (run: JudgedTextRun): number => Math.hypot(run.transform[0], run.transform[1]);

/** Το κουτί των γραμμάτων σε άξονες σελίδας: το κείμενο στη στήλη `rail` είναι περιστραμμένο 90°. */
function boxOf(run: JudgedTextRun): TextBox {
  const [a, b, c, d, originX, originY] = run.transform;
  const size = sizeOf(run);
  const along = { x: a / size, y: b / size };
  const across = { x: c / size, y: d / size };
  const corners = [0, run.width].flatMap((reach) => GLYPH_BAND.map((band) => ({
    x: originX + along.x * reach + across.x * band * size,
    y: originY + along.y * reach + across.y * band * size,
  })));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return { text: run.text, left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) };
}

function overlaps(first: TextBox, second: TextBox): boolean {
  const across = Math.min(first.right, second.right) - Math.max(first.left, second.left);
  const upward = Math.min(first.top, second.top) - Math.max(first.bottom, second.bottom);
  const thinnest = Math.min(first.top - first.bottom, first.right - first.left, second.top - second.bottom, second.right - second.left);
  return across > OVERLAP_MIN_PT && upward > OVERLAP_MIN_PT && Math.min(across, upward) > thinnest * OVERLAP_MIN_BAND_SHARE;
}

/** Σάρωση κατά `left`: σε σελίδα με χιλιάδες κομμάτια δεν συγκρίνεται το καθένα με όλα. */
function overlappingPairs(boxes: readonly TextBox[]): (readonly [TextBox, TextBox])[] {
  const sorted = [...boxes].sort((first, second) => first.left - second.left);
  const pairs: (readonly [TextBox, TextBox])[] = [];
  sorted.forEach((box, index) => {
    for (let next = index + 1; next < sorted.length && sorted[next].left < box.right; next += 1) {
      if (overlaps(box, sorted[next])) pairs.push([box, sorted[next]]);
    }
  });
  return pairs;
}

function isClipped(box: TextBox, page: JudgedPage, bleedPt: number): boolean {
  const limit = bleedPt - CLIP_TOLERANCE_PT;
  return box.left < limit || box.bottom < limit || box.right > page.widthPt - limit || box.top > page.heightPt - limit;
}

/** `bleedPt`: το περιθώριο κοπής του προφίλ. Στην οθόνη 0, στην εκτύπωση το κομμένο χαρτί είναι μικρότερο από τη σελίδα. */
export function judgePublicationLayout(pages: readonly JudgedPage[], bleedPt: number): PublicationLayoutVerdict {
  const samples: string[] = [];
  let overlappingTextCount = 0;
  let clippedTextCount = 0;
  let undersizedTextCount = 0;
  pages.forEach((page, index) => {
    const boxes = page.runs.map(boxOf);
    const pairs = overlappingPairs(boxes);
    overlappingTextCount += pairs.length;
    clippedTextCount += boxes.filter((box) => isClipped(box, page, bleedPt)).length;
    undersizedTextCount += page.runs.filter((run) => sizeOf(run) < PUBLICATION_MIN_TEXT_PT).length;
    for (const [first, second] of pairs.slice(0, SAMPLE_LIMIT - samples.length)) samples.push(`${index + 1}: «${first.text}» × «${second.text}»`);
  });
  const runsExamined = pages.reduce((sum, page) => sum + page.runs.length, 0);
  return { pagesExamined: pages.length, runsExamined, overlappingTextCount, clippedTextCount, undersizedTextCount, samples };
}
