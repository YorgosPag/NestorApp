/**
 * ADR-911 Φ4-3β — η **αναθεώρηση** μιας πρότασης ανοιγμάτων: τι ρωτιέται ο άνθρωπος, τι έχει
 * απαντήσει, και ποια στοιχεία είναι «όμοια» ώστε μία απάντηση να καλύπτει πολλά.
 *
 * Ο άνθρωπος έχει ΤΡΕΙΣ απαντήσεις και μία μη-απάντηση:
 *   · `door` / `window` — είσοδος της πρότασης (`OpeningProposalInput.decisions`): γράφεται.
 *   · `none`            — «το είδα, δεν είναι κούφωμα». Στον πυρήνα ΔΕΝ φτάνει (δεν υπάρχει τι να
 *                         γραφτεί)· ζει μόνο εδώ, για να ξεχωρίζει από το «δεν το κοίταξα ακόμη».
 *   · (καμία)           — αναποφάσιστο. Δεν γράφεται και ΔΕΝ κλειδώνει την έγκριση: ό,τι μένει
 *                         αναποφάσιστο μένει έξω, και ο αριθμός του φαίνεται (Revit «Postpone»).
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./opening-proposal.ts (η πρόταση· `isDecidableOpening`)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md §12 Φ4-3β
 */

import {
  isDecidableOpening,
  type OpeningDecision,
  type OpeningProposal,
  type OpeningProposalItem,
} from './opening-proposal';

/** Ό,τι μπορεί να απαντήσει ο άνθρωπος για ένα στοιχείο «προς απόφαση». */
export type OpeningReviewChoice = OpeningDecision | 'none';

/** Οι απαντήσεις με τη σειρά που τις διαβάζει ο άνθρωπος (και τα πλήκτρα 1 · 2 · 3). */
export const OPENING_REVIEW_CHOICES: readonly OpeningReviewChoice[] = ['door', 'window', 'none'];

export type OpeningReviewChoices = ReadonlyMap<string, OpeningReviewChoice>;

/** Οι απαντήσεις που ΓΡΑΦΟΥΝ — ό,τι δίνεται στον πυρήνα ως `decisions`. Το `none` μένει έξω. */
export function decisionsFromChoices(choices: OpeningReviewChoices): Map<string, OpeningDecision> {
  const decisions = new Map<string, OpeningDecision>();
  for (const [key, choice] of choices) {
    if (choice !== 'none') decisions.set(key, choice);
  }
  return decisions;
}

/** Στοιχείο για το οποίο ο άνθρωπος ΜΠΟΡΕΙ να απαντήσει: αποφασίσιμο, ή ήδη αποφασισμένο από αυτόν. */
export function canChooseOpening(item: OpeningProposalItem): boolean {
  return item.decided === true || isDecidableOpening(item);
}

/** Ό,τι περνά από τα μάτια του ανθρώπου: όσα ρωτιούνται και όσα έχει ήδη απαντήσει. */
export function reviewableOpenings(proposal: OpeningProposal): readonly OpeningProposalItem[] {
  return proposal.items.filter((item) => item.status === 'needs-decision' || item.decided === true);
}

/** Κενό που κρατά ζωγραφισμένες γραμμές ΑΛΛΟΥ ρόλου (π.χ. κολώνα που ο βοηθός δεν διαβάζει). */
export function isOccupiedOpening(item: OpeningProposalItem): boolean {
  return (item.occupantIds?.length ?? 0) > 0;
}

/**
 * Η ΥΠΟΔΕΙΞΗ του βοηθού — ποτέ απόφαση. Κενό με κάτι ζωγραφισμένο μέσα του μάλλον δεν είναι
 * κούφωμα (μετρημένο: και τα δύο κενά του σχεδίου δοκιμής κρατούν ζωγραφισμένη κολώνα). Για
 * όλα τα άλλα ο βοηθός δεν έχει γνώμη — και το λέει μη υποδεικνύοντας τίποτα.
 */
export function suggestedOpeningChoice(item: OpeningProposalItem): OpeningReviewChoice | null {
  return canChooseOpening(item) && isOccupiedOpening(item) ? 'none' : null;
}

/**
 * Τα κλειδιά των στοιχείων που είναι «όμοια» με το `key`, μαζί με το ίδιο: ίδιος λόγος που
 * ρωτήθηκαν ΚΑΙ ίδια κατάσταση ενοίκου. Ένα άδειο κενό και ένα κενό με κολώνα μέσα ΔΕΝ είναι
 * όμοια, όσο κι αν μοιάζουν στο πλάτος. Μόνο στοιχεία που δέχονται απάντηση.
 */
export function similarOpeningKeys(proposal: OpeningProposal, key: string): readonly string[] {
  const anchor = proposal.items.find((item) => item.key === key);
  if (!anchor || !canChooseOpening(anchor)) return [];
  const occupied = isOccupiedOpening(anchor);
  return proposal.items
    .filter((item) => canChooseOpening(item) && item.reason === anchor.reason && isOccupiedOpening(item) === occupied)
    .map((item) => item.key);
}

export interface OpeningReviewCounts {
  /** Πόρτες + παράθυρα που ΘΑ γραφτούν (από σύμβολο ή από απόφαση). */
  readonly writable: number;
  /** Δέχονται απάντηση και δεν την έχουν πάρει. Δεν γράφονται. */
  readonly undecided: number;
  /** Ο άνθρωπος είπε «δεν είναι κούφωμα». */
  readonly dismissed: number;
  /** «Προς απόφαση» χωρίς ξενιστή ή θέση: δεν υπάρχει τι να γραφτεί, ό,τι κι αν απαντηθεί. */
  readonly blocked: number;
}

/** Η λογιστική της αναθεώρησης. `undecided + dismissed + blocked` = όλα τα «προς απόφαση». */
export function countOpeningReview(proposal: OpeningProposal, choices: OpeningReviewChoices): OpeningReviewCounts {
  const counts = { writable: 0, undecided: 0, dismissed: 0, blocked: 0 };
  for (const item of proposal.items) {
    if (item.status === 'door' || item.status === 'window') counts.writable += 1;
    else if (item.status !== 'needs-decision') continue;
    else if (!isDecidableOpening(item)) counts.blocked += 1;
    else if (choices.get(item.key) === 'none') counts.dismissed += 1;
    else counts.undecided += 1;
  }
  return counts;
}
