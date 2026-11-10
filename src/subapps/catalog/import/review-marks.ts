/**
 * @fileoverview **Τα σημάδια κατάστασης πάνω στο PDF της αναθεώρησης** (ADR-923 §5.5.2 Β8) — δεδομένα, όχι ζωγραφική.
 * @module subapps/catalog/import/review-marks
 *
 * 🔑 **ΕΝΑ σημείο δήλωσης, δύο αναγνώστες**: ο ζωγράφος (`ImportReviewOverlay`) ζωγραφίζει **ακριβώς** τα `dash` · `glyph` ·
 *    `token` εδώ, και το **CHECK 3.41** (`scripts/lib/contrast/state-marks.js`, οικογένεια `import-review-overlay`) κρίνει
 *    **τα ίδια πεδία**: Κ1 «ξέρω ποιο είναι ποιο χωρίς χρώμα;» (`dash:glyph` διαφορετικά) · Κ2 «η χρωματική διαφορά είναι
 *    αληθινή και για αχρωματοψία;» (ΔE ≥ 8, Machado 2009). Ένα πεδίο που η πύλη διαβάζει αλλά ο ζωγράφος όχι θα ήταν ψέμα.
 * 🔑 Τα χρώματα είναι **tokens χαρτιού** (`--paper-mark-*`, `globals.css`): το χαρτί είναι λευκό σε **κάθε** θέμα, άρα τα
 *    σημάδια **δεν** αλλάζουν με το θέμα. Τα `--status-*` δεν κάνουν: το πράσινο τους δίνει ≈2,3:1 σε λευκό (< 3:1, WCAG 1.4.11).
 *    Μετρημένα 2026-11-09 σε λευκό: 6,76 · 6,02 · 5,83 · 4,25 — ελάχιστο ΔE CVD 8,5 (αποδεκτό ↔ πρόβλημα).
 * 🔑 Το **επιλεγμένο** δεν είναι κατάσταση: είναι τροποποιητής (γέμισμα + δεύτερο περίγραμμα) πάνω από οποιαδήποτε.
 */

/** Οι καταστάσεις, **με σειρά προτεραιότητας**: όταν ένα πλαίσιο τροφοδοτεί πολλούς στόχους, κερδίζει η πρώτη (το πρόβλημα δεν κρύβεται πίσω από ένα ✓). */
export const REVIEW_MARK_TONES = ['problem', 'pending', 'accepted', 'dismissed'] as const;
export type ReviewMarkTone = (typeof REVIEW_MARK_TONES)[number];

/** Το σύμβολο στη γωνία του πλαισίου — το δεύτερο, μη χρωματικό κανάλι μαζί με το μοτίβο γραμμής. */
export type ReviewMarkGlyph = 'none' | 'check' | 'alert' | 'cross';

interface ReviewMarkSpec {
  /** `strokeDasharray` σε pixels οθόνης (`none` = συνεχής). */
  readonly dash: string;
  /** Πάχος γραμμής σε pixels οθόνης (`vector-effect: non-scaling-stroke`). Δεν είναι διακριτικό κανάλι — μόνο έμφαση. */
  readonly strokePx: number;
  readonly glyph: ReviewMarkGlyph;
  /** Το CSS custom property του χρώματος (χωρίς `--`). */
  readonly token: string;
}

export const IMPORT_REVIEW_MARKS = {
  tones: {
    pending: { dash: 'none', strokePx: 1.5, glyph: 'none', token: 'paper-mark-pending' },
    accepted: { dash: 'none', strokePx: 3, glyph: 'check', token: 'paper-mark-accepted' },
    problem: { dash: '5 3', strokePx: 2, glyph: 'alert', token: 'paper-mark-problem' },
    dismissed: { dash: '1 3', strokePx: 1.5, glyph: 'cross', token: 'paper-mark-dismissed' },
  },
} as const satisfies { readonly tones: Readonly<Record<ReviewMarkTone, ReviewMarkSpec>> };

/** Ο χειρότερος τόνος μιας ομάδας (κατά `REVIEW_MARK_TONES`). Άδεια ομάδα δεν υπάρχει: κάθε πλαίσιο έχει τουλάχιστον έναν στόχο. */
export function worstReviewTone(tones: readonly ReviewMarkTone[]): ReviewMarkTone {
  return REVIEW_MARK_TONES.find((tone) => tones.includes(tone)) ?? 'pending';
}
