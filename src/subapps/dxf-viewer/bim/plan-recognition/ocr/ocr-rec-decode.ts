/**
 * =============================================================================
 * ΑΠΟΚΩΔΙΚΟΠΟΙΗΣΗ CTC — ΕΞΟΔΟΣ ΑΝΑΓΝΩΣΤΗ → ΚΕΙΜΕΝΟ (ADR-929 Φ0.3)
 * =============================================================================
 *
 * Άπληστη αποκωδικοποίηση CTC (Graves et al. 2006), όπως το `rec_one` του μετρημένου Python και το `CTCLabelDecode` του
 * PaddleOCR: σε κάθε χρονικό βήμα η πιθανότερη κλάση· διαδοχικές ίδιες κλάσεις συμπτύσσονται σε μία· η κλάση `0`
 * (blank) πετιέται. Η βαθμολογία είναι ο **μέσος όρος** της πιθανότητας των χαρακτήρων που κρατήθηκαν (κανένας ⇒ `0`).
 *
 * 📏 Η έξοδος του αναγνώστη PP-OCR είναι **ήδη** κατανομή πιθανότητας ανά βήμα (softmax μέσα στο γράφημα ONNX) — καμία
 *   δεύτερη κανονικοποίηση εδώ.
 *
 * @module bim/plan-recognition/ocr/ocr-rec-decode
 */

/** Έξοδος αναγνώστη `[βήματα × κλάσεις]`, γραμμή-προς-γραμμή. */
export interface RecognizerOutput {
  readonly data: Float32Array;
  readonly steps: number;
  readonly classes: number;
}

export interface DecodedText {
  readonly text: string;
  /** Μέση πιθανότητα των χαρακτήρων που κρατήθηκαν, στο `[0, 1]`. */
  readonly score: number;
}

function argmaxAt(out: RecognizerOutput, step: number): { readonly index: number; readonly prob: number } {
  const base = step * out.classes;
  let index = 0;
  let prob = out.data[base];
  for (let c = 1; c < out.classes; c++) {
    if (out.data[base + c] > prob) { prob = out.data[base + c]; index = c; }
  }
  return { index, prob };
}

/** Κείμενο + βαθμολογία από την έξοδο του αναγνώστη, με τις κλάσεις του `recognitionClasses`. */
export function decodeCtc(out: RecognizerOutput, classes: readonly string[]): DecodedText {
  if (classes.length !== out.classes) throw new RangeError(`ocr-rec-decode: ${classes.length} classes != ${out.classes}`);
  let text = '';
  let sum = 0;
  let kept = 0;
  let last = -1;
  for (let t = 0; t < out.steps; t++) {
    const { index, prob } = argmaxAt(out, t);
    if (index !== last && index !== 0) {
      text += classes[index];
      sum += prob;
      kept++;
    }
    last = index;
  }
  return { text, score: kept > 0 ? sum / kept : 0 };
}
