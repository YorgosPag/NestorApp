/**
 * =============================================================================
 * ΕΓΓΕΝΗΣ ΑΝΑΛΥΣΗ ΜΙΑΣ ΣΑΡΩΜΕΝΗΣ ΣΕΛΙΔΑΣ PDF (ADR-929 §6.16 βήμα 4)
 * =============================================================================
 *
 * «Σε ποια κλίμακα πρέπει να αποδοθεί η σελίδα ώστε 1 px της απόδοσης = 1 px της σάρωσης;» — από το operator list του
 * pdf.js, χωρίς να αποκωδικοποιηθεί ξανά η εικόνα. Το ίδιο που αναφέρει το `pdfimages -list` (x-ppi / y-ppi).
 *
 * 🔑 **CTM.** Κάθε εικόνα ζωγραφίζεται στο μοναδιαίο τετράγωνο, απεικονισμένο από τον τρέχοντα πίνακα (μονάδες σελίδας, pt).
 *   Ο πίνακας ακολουθεί `save`/`restore`/`transform` και τα Form XObjects (`paintFormXObjectBegin` = save + πίνακας της φόρμας,
 *   `…End` = restore). Τα `beginGroup`/`endGroup` μετρούν μόνο ως save/restore: ο πίνακας μιας ομάδας διαφάνειας είναι ο
 *   πίνακας της ΙΔΙΑΣ φόρμας, που έρχεται αμέσως μετά με το `paintFormXObjectBegin` — αν μετρούσε και εδώ, θα μετρούσε δύο φορές.
 * 🔑 **Κυρίαρχη ανάλυση.** Ανάλυση εικόνας = px ανά pt κατά μήκος κάθε άξονά της (`πλάτος / |στήλη x του πίνακα|`). Οι εικόνες
 *   ομαδοποιούνται κατά ανάλυση (μια σάρωση μπορεί να είναι κομμένη σε λωρίδες) και κερδίζει η ομάδα με τη μεγαλύτερη κάλυψη
 *   — **μόνο** αν καλύπτει τουλάχιστον το μισό της σελίδας. Αλλιώς η σελίδα είναι διανυσματική (ή με μικρές εικόνες) ⇒ `null`.
 * 📏 Η περιστροφή της σελίδας (`/Rotate`) δεν αλλάζει μήκη, άρα ούτε την ανάλυση.
 * ⚠️ Καθαρή συνάρτηση: καμία εισαγωγή του pdf.js εδώ (οι κωδικοί `OPS` εγχέονται), ώστε να ελέγχεται χωρίς browser.
 *
 * @module subapps/dxf-viewer/pdf-background/services/pdf-native-resolution
 */

import { composeAffine, IDENTITY_AFFINE, type Affine2x3 } from '@/lib/geometry/affine-2x3';

/** Οι κωδικοί του `pdfjs.OPS` που χρειάζεται η ανάλυση (δομικά συμβατό με το `OPS` του pdf.js). */
export interface PdfImageOps {
  readonly save: number;
  readonly restore: number;
  readonly transform: number;
  readonly paintFormXObjectBegin: number;
  readonly paintFormXObjectEnd: number;
  readonly beginGroup: number;
  readonly endGroup: number;
  readonly paintImageXObject: number;
  readonly paintInlineImageXObject: number;
  readonly paintImageMaskXObject: number;
}

/** Το operator list μιας σελίδας (`page.getOperatorList()`). */
export interface PdfOperatorListLike {
  readonly fnArray: readonly number[];
  readonly argsArray: readonly unknown[];
}

/** Ελάχιστη κάλυψη της σελίδας από την κυρίαρχη ομάδα εικόνων για να θεωρηθεί σάρωση. */
export const SCANNED_PAGE_MIN_COVERAGE = 0.5;
/** Σχετική ανοχή για «ίδια ανάλυση» ανάμεσα σε κομμάτια της ίδιας σάρωσης. */
const SAME_RESOLUTION_TOLERANCE = 0.01;

interface PaintedImage {
  /** px ανά pt (το μέγιστο των δύο αξόνων: καμία απώλεια σε κανέναν). */
  readonly pxPerPt: number;
  /** Εμβαδόν στη σελίδα, pt². */
  readonly areaPt: number;
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function readMatrix(args: unknown): Affine2x3 | null {
  if (!Array.isArray(args) || args.length < 6 || !args.slice(0, 6).every(isNumber)) return null;
  const [a, b, c, d, e, f] = args as number[];
  return { a, b, c, d, e, f };
}

/** Οι διαστάσεις σε px μιας εικόνας από τα ορίσματα της εντολής της (`[objId, w, h]` ή `[{ width, height }]`). */
function imageSize(fn: number, args: unknown, ops: PdfImageOps): { w: number; h: number } | null {
  if (!Array.isArray(args)) return null;
  if (fn === ops.paintImageXObject) return isNumber(args[1]) && isNumber(args[2]) ? { w: args[1], h: args[2] } : null;
  const img: unknown = args[0];
  if (typeof img !== 'object' || img === null) return null;
  const { width, height } = img as { width?: unknown; height?: unknown };
  return isNumber(width) && isNumber(height) ? { w: width, h: height } : null;
}

function paintedImage(ctm: Affine2x3, size: { w: number; h: number }): PaintedImage | null {
  const xLen = Math.hypot(ctm.a, ctm.b);
  const yLen = Math.hypot(ctm.c, ctm.d);
  const areaPt = Math.abs(ctm.a * ctm.d - ctm.b * ctm.c);
  if (xLen <= 0 || yLen <= 0 || areaPt <= 0 || size.w < 1 || size.h < 1) return null;
  return { pxPerPt: Math.max(size.w / xLen, size.h / yLen), areaPt };
}

/** Όλες οι εικόνες της σελίδας, με την ανάλυση και το εμβαδόν τους. */
function paintedImages(list: PdfOperatorListLike, ops: PdfImageOps): PaintedImage[] {
  const stack: Affine2x3[] = [];
  let ctm = IDENTITY_AFFINE;
  const out: PaintedImage[] = [];
  const images = new Set([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageMaskXObject]);
  list.fnArray.forEach((fn, i) => {
    const args = list.argsArray[i];
    if (fn === ops.save || fn === ops.beginGroup) stack.push(ctm);
    else if (fn === ops.restore || fn === ops.endGroup || fn === ops.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === ops.transform) ctm = composeAffine(ctm, readMatrix(args) ?? IDENTITY_AFFINE);
    else if (fn === ops.paintFormXObjectBegin) {
      stack.push(ctm);
      ctm = composeAffine(ctm, readMatrix(Array.isArray(args) ? args[0] : null) ?? IDENTITY_AFFINE);
    } else if (images.has(fn)) {
      const size = imageSize(fn, args, ops);
      const painted = size ? paintedImage(ctm, size) : null;
      if (painted) out.push(painted);
    }
  });
  return out;
}

/**
 * Η εγγενής κλίμακα απόδοσης (px ανά pt, η σημασία του `scale` του `getViewport`) της κυρίαρχης σάρωσης της σελίδας, ή `null`
 * όταν καμία ομάδα εικόνων ίδιας ανάλυσης δεν καλύπτει τουλάχιστον το {@link SCANNED_PAGE_MIN_COVERAGE} της σελίδας.
 */
export function nativeImageScale(list: PdfOperatorListLike, ops: PdfImageOps, pageAreaPt: number): number | null {
  if (!(pageAreaPt > 0)) return null;
  const groups: { pxPerPt: number; areaPt: number }[] = [];
  for (const img of paintedImages(list, ops)) {
    const same = groups.find((g) => Math.abs(g.pxPerPt - img.pxPerPt) <= SAME_RESOLUTION_TOLERANCE * g.pxPerPt);
    if (same) same.areaPt += img.areaPt;
    else groups.push({ ...img });
  }
  const best = groups.reduce<{ pxPerPt: number; areaPt: number } | null>(
    (acc, g) => (acc === null || g.areaPt > acc.areaPt ? g : acc), null);
  return best !== null && best.areaPt >= SCANNED_PAGE_MIN_COVERAGE * pageAreaPt ? best.pxPerPt : null;
}
