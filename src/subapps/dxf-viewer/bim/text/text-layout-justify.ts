/**
 * 🏢 ENTERPRISE — στοίχιση παραγράφου MTEXT μέσα στη στήλη (ADR-635 Φ C.21, εκκρεμότητα Γ).
 *
 * Το `\pxq{l|c|r|j|d}` **διαβαζόταν** ήδη σωστά (Φ C.20) αλλά δεν το χρησιμοποιούσε κανείς: η
 * μόνη στοίχιση που έφτανε στην απόδοση ήταν η **αγκύρωση της οντότητας** (κωδ. 71). Έτσι μια
 * κεντραρισμένη ή πλήρως στοιχισμένη παράγραφος του AutoCAD φαινόταν αριστερή στον Νέστορα.
 *
 * ── Οι δύο στοιχίσεις είναι ΔΙΑΦΟΡΕΤΙΚΕΣ και συνυπάρχουν ─────────────────────────────────
 *   • **αγκύρωση (71)** — πού κάθεται ΟΛΟ το μπλοκ σχετικά με το σημείο εισαγωγής· την
 *     εφαρμόζει ο renderer μία φορά, σε επίπεδο οντότητας.
 *   • **στοίχιση παραγράφου (`\pxq`)** — πού κάθεται ΚΑΘΕ γραμμή μέσα στη **στήλη** (κωδ. 41)·
 *     ζει εδώ, γιατί χρειάζεται το πλάτος στήλης που ξέρει μόνο η διάταξη.
 *
 * ── Ο τυπογραφικός κανόνας της πλήρους στοίχισης ─────────────────────────────────────────
 * Η **τελευταία γραμμή μιας παραγράφου δεν τεντώνεται** — αλλιώς μια γραμμή δύο λέξεων απλώνεται
 * σε ολόκληρο το πλάτος. Ισχύει και για κάθε γραμμή που τερματίζει σε **ρητή** αλλαγή (`\P`/`\N`):
 * ο συγγραφέας έκλεισε τη γραμμή, δεν την έκοψε η στήλη. (Ίδια συμπεριφορά: InDesign «Justify
 * with last line aligned left», CSS `text-align: justify`.)
 *
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΜΕΤΡΑΜΕ ΟΛΗ ΤΗ ΓΡΑΜΜΗ: τα κενά ΜΕΤΑΞΥ span (στηλοθέτες!) πρέπει να μείνουν
 * ακέραια. Το τέντωμα κρατά τα αρχικά διάκενα των span και μοιράζει το υπόλοιπο **μόνο** στα
 * εσωτερικά κενά λέξεων, οπότε μια γραμμή με στάσεις δεν χάνει τη στοίχιση των στηλών της.
 *
 * @module bim/text/text-layout-justify
 */

import { measureTextAdvanceWorld } from '../../text-engine/fonts';
import type {
  ParagraphJustification, TextLayoutLine, TextLayoutSpan,
} from './text-layout-types';

/** Ομάδες κενών ↔ λέξεων μέσα σε ένα span, με τα κενά να επιβιώνουν ως δικά τους τμήματα. */
const WORD_SPLIT = /( +)/;

/** Το `slack` (αχρησιμοποίητο πλάτος) της γραμμής μέσα στη στήλη· ≤ 0 όταν γεμίζει/ξεχειλίζει. */
function slackOf(line: TextLayoutLine, frame: number): number {
  return Number.isFinite(frame) ? frame - line.widthWorld : 0;
}

/** Ένα τμήμα της γραμμής: είτε λέξη (μαζί με το span της) είτε ομάδα κενών. */
interface Segment {
  readonly span: TextLayoutSpan;
  readonly text: string;
  readonly isGap: boolean;
  /** Το span στο οποίο ανήκει άλλαξε σε σχέση με το προηγούμενο τμήμα (διατήρησε το διάκενο). */
  readonly startsSpan: boolean;
}

/** Η γραμμή σε τμήματα λέξεων/κενών, με σειρά ζωγραφικής. */
function segmentsOf(spans: readonly TextLayoutSpan[]): Segment[] {
  const out: Segment[] = [];
  for (const span of spans) {
    let first = true;
    for (const text of span.text.split(WORD_SPLIT)) {
      if (!text) continue;
      out.push({ span, text, isGap: text[0] === ' ', startsSpan: first });
      first = false;
    }
    // Ένα span που είναι εξ ολοκλήρου κενό δεν παράγει τμήμα «αρχής span» αλλιώς — το `first`
    // παραμένει true και το επόμενο span κρατά σωστά το δικό του αρχικό x.
  }
  return out;
}

/**
 * Δείκτες των **εσωτερικών** ομάδων κενών — αυτές που έχουν λέξη ΚΑΙ αριστερά ΚΑΙ δεξιά. Μόνο
 * αυτές δέχονται το τέντωμα· ηγετικά/τελικά κενά δεν είναι διαχωριστές λέξεων.
 */
function interiorGapIndices(segments: readonly Segment[]): number[] {
  const firstWord = segments.findIndex(s => !s.isGap);
  let lastWord = -1;
  for (let i = segments.length - 1; i >= 0; i--) if (!segments[i].isGap) { lastWord = i; break; }
  if (firstWord < 0 || lastWord <= firstWord) return [];
  const idx: number[] = [];
  for (let i = firstWord + 1; i < lastWord; i++) if (segments[i].isGap) idx.push(i);
  return idx;
}

/**
 * Τέντωμα ΜΙΑΣ γραμμής στο πλάτος της στήλης. Επιστρέφει τη γραμμή αυτούσια όταν δεν υπάρχει
 * περιθώριο ή δεν υπάρχει κενό να το δεχτεί (μονολεκτική γραμμή — το AutoCAD ούτε αυτό απλώνει).
 */
function stretchLine(line: TextLayoutLine, frame: number): TextLayoutLine {
  const slack = slackOf(line, frame);
  if (slack <= 0) return line;
  const segments = segmentsOf(line.spans);
  const gaps = new Set(interiorGapIndices(segments));
  if (gaps.size === 0) return line;
  const delta = slack / gaps.size;

  const out: TextLayoutSpan[] = [];
  let extra = 0; // συσσωρευμένο τέντωμα ώς εδώ
  let x = 0;
  segments.forEach((seg, i) => {
    // Νέο span ⇒ ξεκίνα από το ΔΙΚΟ του x (+ ό,τι έχει τεντωθεί): έτσι τα διάκενα που έβαλαν
    // οι στηλοθέτες μένουν ακέραια αντί να συμπτυχθούν σε συνεχή ροή λέξεων.
    if (seg.startsSpan) x = seg.span.xWorld + extra;
    // ⚠️ Τα τμήματα μετριούνται ξεχωριστά· το kerning ΓΥΡΩ ΑΠΟ ΚΕΝΟ είναι μηδενικό σε κάθε
    // πραγματική γραμματοσειρά, οπότε Σ(τμήματα) ≡ πλάτος span σε ό,τι μας ενδιαφέρει.
    const w = measureTextAdvanceWorld(seg.text, seg.span.heightWorld, seg.span.style);
    // Το κενό ΠΑΡΑΜΕΝΕΙ span με το ΦΥΣΙΚΟ του πλάτος: το τέντωμα μπαίνει στη ΘΕΣΗ της επόμενης
    // λέξης, όχι στο πλάτος του κενού. Έτσι (α) το κείμενο της γραμμής μένει ακέραιο για κάθε
    // καταναλωτή που το ξανασυνθέτει (`layoutLineStrings` → κουτί/λαβές) και (β) το αναλλοίωτο
    // «πλάτος span == μέτρηση του span» δεν σπάει ούτε στις τεντωμένες γραμμές.
    out.push({ ...seg.span, text: seg.text, xWorld: x, widthWorld: w });
    x += w;
    if (seg.isGap && gaps.has(i)) { extra += delta; x += delta; }
  });
  const width = out.reduce((m, s) => Math.max(m, s.xWorld + s.widthWorld), 0);
  return { spans: out, widthWorld: width, xOffsetWorld: line.xOffsetWorld };
}

/** Η οριζόντια μετατόπιση μιας γραμμής για κεντρική / δεξιά στοίχιση παραγράφου. */
function offsetFor(justification: ParagraphJustification, slack: number): number {
  if (slack <= 0) return 0;
  if (justification === 1) return slack / 2;
  if (justification === 2) return slack;
  return 0;
}

/**
 * Εφαρμόζει τη στοίχιση της παραγράφου στις γραμμές `[start, end)` του πίνακα **επί τόπου**.
 *
 * Χωρίς πεπερασμένη στήλη (κωδ. 41 = 0, «auto») δεν υπάρχει πλάτος μέσα στο οποίο να στοιχίσεις:
 * το AutoCAD τότε δεν αναδιπλώνει καθόλου και η στοίχιση παραγράφου δεν έχει νόημα — γι' αυτό
 * βγαίνουμε νωρίς αντί να «στοιχίσουμε» σε άπειρο πλάτος.
 */
export function applyParagraphJustification(
  lines: TextLayoutLine[],
  start: number,
  justification: ParagraphJustification,
  frame: number,
): void {
  if (justification === 0 || !Number.isFinite(frame) || frame <= 0) return;
  const end = lines.length;
  for (let i = start; i < end; i++) {
    // Πλήρης στοίχιση: τεντώνονται όλες ΕΚΤΟΣ της τελευταίας γραμμής της παραγράφου.
    if (justification === 3) {
      if (i < end - 1) lines[i] = stretchLine(lines[i], frame);
      continue;
    }
    lines[i] = { ...lines[i], xOffsetWorld: offsetFor(justification, slackOf(lines[i], frame)) };
  }
}
