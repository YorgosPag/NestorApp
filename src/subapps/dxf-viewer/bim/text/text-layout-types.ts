/**
 * 🏢 ENTERPRISE — τύποι της οπτικής διάταξης κειμένου (ADR-635 Φ C.20/C.21).
 *
 * Ξεχωριστό αρχείο ώστε το SSoT διάταξης (`text-layout.ts`) και η εξαγωγή πηγαίων γραμμών
 * (`text-layout-source.ts`) να μοιράζονται ΕΝΑ σχήμα χωρίς κυκλική εξάρτηση.
 *
 * ── Η ΣΥΜΒΑΣΗ ΠΟΥ ΚΛΕΙΔΩΝΕΙ ΕΔΩ (ADR-635 Φ C.21) ─────────────────────────────────────────
 * Ένα span κουβαλά **το ίδιο** αντικείμενο στυλ με το οποίο μετρήθηκε το `widthWorld` του:
 *
 *     measureTextAdvanceWorld(span.text, span.heightWorld, span.style) === span.widthWorld
 *
 * ΓΙΑΤΙ: μέχρι το Φ C.20 το span κρατούσε `bold?`/`italic?`/`fontFamily?` **μόνο όταν ήταν
 * αληθή**, οπότε το «ρητά ΨΕΥΔΕΣ» δεν ξεχώριζε από το «δεν δηλώθηκε» — και ο renderer έπεφτε
 * πίσω στο στυλ του ΜΠΛΟΚ (= στυλ του **πρώτου** run). Στο `47_ergasia.dxf` ο πρώτος run είναι
 * `b1` + `\L`, άρα ΟΛΟ το κείμενο βαφόταν έντονο και υπογραμμισμένο ενώ η διάταξη το είχε
 * μετρήσει κανονικό: κάθε span ζωγραφιζόταν πλατύτερο απ' όσο μετρήθηκε, καβαλούσε το επόμενο
 * (φαινομενικά «χαμένο κενό»: `ΦΕΚ405`) και η γραμμή ξεχείλιζε δεξιά από τη στήλη.
 *
 * ⚠️ ΜΗΝ ξανακάνεις προαιρετικό κανένα πεδίο του `style`/`decoration`. Η προαιρετικότητα ΕΙΝΑΙ
 * το σφάλμα: υποχρεώνει τον καταναλωτή να μαντέψει από πού κληρονομεί, και η μαντεψιά του
 * ζωγράφου δεν είναι ΠΟΤΕ εγγυημένα η ίδια με τη μαντεψιά του μετρητή.
 *
 * @module bim/text/text-layout-types
 */

import type { TextAdvanceStyle } from '../../text-engine/fonts';
import type { LineSpacingMode } from '../../text-engine/types';

/** Οι γραμμικές διακοσμήσεις ενός run — AutoCAD `\L`/`\l`, `\O`/`\o`, `\K`/`\k`. */
export interface TextSpanDecoration {
  readonly underline: boolean;
  readonly overline: boolean;
  readonly strikethrough: boolean;
}

/** Καμία διακόσμηση — κοινή σταθερή αναφορά (μηδέν αλλοκατάσταση στη συνήθη περίπτωση). */
export const NO_DECORATION: TextSpanDecoration = Object.freeze({
  underline: false, overline: false, strikethrough: false,
});

/** True όταν κάτι πρέπει όντως να ζωγραφιστεί — γλιτώνει τον έλεγχο τριών πεδίων στον renderer. */
export function hasAnyDecoration(d: TextSpanDecoration): boolean {
  return d.underline || d.overline || d.strikethrough;
}

/** Συνεχόμενο κομμάτι μιας οπτικής γραμμής, στο δικό του x, με το δικό του στυλ βαφής. */
export interface TextLayoutSpan {
  readonly text: string;
  /** Οριζόντια μετατόπιση από την αρχή της γραμμής, μονάδες κόσμου. */
  readonly xWorld: number;
  /** Πλάτος glyph advance του `text`, μονάδες κόσμου. */
  readonly widthWorld: number;
  /** Ύψος χαρακτήρα του span, μονάδες κόσμου (το inline `\H` υπερισχύει του ύψους μπλοκ). */
  readonly heightWorld: number;
  /** ΤΟ ΣΤΥΛ ΤΗΣ ΜΕΤΡΗΣΗΣ — πλήρως επιλυμένο, χωρίς κληρονομιά προς τα κάτω. */
  readonly style: TextAdvanceStyle;
  /** Διακοσμήσεις ΑΝΑ RUN (όχι ανά γραμμή — το AutoCAD υπογραμμίζει μόνο ό,τι δηλώθηκε). */
  readonly decoration: TextSpanDecoration;
  /** CSS χρώμα, ή undefined όταν το run κληρονομεί το χρώμα οντότητας/επιπέδου. */
  readonly color?: string;
}

/** ΜΙΑ οπτική γραμμή (μετά την αναδίπλωση) — ό,τι ζωγραφίζει ο renderer σε μία γραμμή βάσης. */
export interface TextLayoutLine {
  readonly spans: readonly TextLayoutSpan[];
  /** Συνολικό advance της γραμμής, μονάδες κόσμου (max δεξιό άκρο span). */
  readonly widthWorld: number;
  /**
   * Μετατόπιση της ΓΡΑΜΜΗΣ μέσα στη στήλη, από τη στοίχιση **παραγράφου** (`\pxqc` / `\pxqr`).
   *
   * ⚠️ ΔΕΝ είναι η αγκύρωση της οντότητας (κωδ. 71, TL…BR) — αυτή τοποθετεί ΟΛΟ το μπλοκ και
   * την εφαρμόζει ο renderer. Οι δύο συνυπάρχουν: το AutoCAD πρώτα στοιχίζει κάθε παράγραφο
   * μέσα στη στήλη, μετά αγκυρώνει τη στήλη στο σημείο εισαγωγής.
   */
  readonly xOffsetWorld: number;
  /**
   * Απόσταση γραμμής βάσης **από την προηγούμενη γραμμή** ÷ ύψος χαρακτήρα (em). Ανά γραμμή,
   * γιατί το `\ps` είναι ιδιότητα **παραγράφου**: ένα MTEXT μπορεί να έχει `\psm0.9;` σε μία
   * παράγραφο και `\psm1.5;` στην επόμενη. Για την πρώτη γραμμή δεν χρησιμοποιείται.
   */
  readonly spacingRatio: number;
}

/**
 * Στοίχιση παραγράφου του MTEXT — `\pxq{l|c|r|j|d}` (ezdxf: «paragraph alignment»).
 * `3` καλύπτει και τα δύο γράμματα πλήρους στοίχισης (`j` justified, `d` distributed).
 */
export type ParagraphJustification = 0 | 1 | 2 | 3;

/** Στυλισμένο κομμάτι ΠΗΓΑΙΟΥ κειμένου, πριν λυθούν στηλοθέτες/αναδίπλωση. */
export interface SourcePiece {
  readonly text: string;
  readonly style: TextAdvanceStyle;
  readonly heightWorld: number;
  readonly decoration: TextSpanDecoration;
  readonly color?: string;
}

/**
 * ΜΙΑ πηγαία γραμμή (μια παράγραφος, ή ένα `\N` μέσα της) με τις στάσεις που την αφορούν.
 * Οι στάσεις είναι **ανά παράγραφο** στο AST — μια ενιαία καθολική λίστα θα εφάρμοζε τη
 * σκάλα `\pt` της μιας παραγράφου σε ολόκληρη την οντότητα.
 */
export interface SourceLine {
  readonly pieces: SourcePiece[];
  /** Στάσεις σε **em** (πολλαπλάσια ύψους χαρακτήρα) — γίνονται κόσμος στη διάταξη. */
  readonly tabsEm: readonly number[];
  /** Στοίχιση της παραγράφου στην οποία ανήκει η γραμμή (`\pxq…`). */
  readonly justification: ParagraphJustification;
  /** Πολλαπλασιαστής διάστιχου της παραγράφου (`\ps…`)· 1 = μονό διάστιχο AutoCAD. */
  readonly spacingFactor: number;
  /** Τρόπος διάστιχου της παραγράφου — το `at-least` μεγαλώνει με το ψηλότερο span. */
  readonly spacingMode: LineSpacingMode;
}
