/**
 * @fileoverview **ΠΟΙΕΣ ΑΞΙΩΣΕΙΣ ΣΗΚΩΝΕΙ ΚΑΘΕ ΔΙΑΘΕΣΗ** — δεκαέξι κελιά, κανένα σιωπηλό.
 * @related ADR-838 §4.5 · ADR-777 §7 (Α17) · ADR-835 §7 · types/property-offers.ts
 * @module lib/legality/legality-offer-matrix
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΛΙΣΤΑ ΑΝΑ ΔΙΑΘΕΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η προφανής μορφή είναι `Record<OfferKind, LegalityClaimKind[]>` — *«η πώληση σηκώνει
 * αυτά τα τρία»*. Είναι **λάθος μορφή**, και ο λόγος είναι η υπογραφή αυτού του έργου:
 *
 * > Σε λίστα, το **απόν** είναι **σιωπηλό**. Το `leaseShort` χωρίς `energy-performance`
 * > θα σήμαινε *«δεν απαιτείται ΠΕΑ στη βραχυχρόνια»* — **ισχυρισμός για τον νόμο**
 * > που **κανείς δεν έκανε**, και που στην πραγματικότητα **ΔΕΝ ΕΠΑΛΗΘΕΥΤΗΚΕ**: το
 * > άρθρο 12 §7 του ν.4122/2013 παραπέμπει σε εξαιρέσεις του άρθρου 4 §7 (β) και (ε),
 * > που **δεν βρέθηκαν** στην έρευνα της 2026-08-31.
 *
 * ⇒ **Κάθε κελί απαντά ρητά**, και οι τρεις απαντήσεις είναι **διαφορετικές**:
 * `'raised'` (με διάταξη) · `'not-raised'` (με διάταξη — *γιατί* δεν αφορά) ·
 * `'unresolved'` (με **την ερώτηση**, όχι με μαντεψιά).
 *
 * Είναι ο κανόνας που η SPEC-777 §22 έβαλε ρητά ο Giorgio: *«αν δεν βρεις κάτι, γράψε
 * **δεν βρέθηκε** — μην μαντέψεις»* — εδώ σε **εκτελέσιμη** μορφή.
 *
 * 🏆 **ΚΑΙ ΤΟ `unresolved` ΕΙΝΑΙ ΜΕΤΡΗΣΙΜΟ**: το {@link unresolvedLegalityCells}
 * επιστρέφει τα ανοιχτά κελιά, και μια άγκυρα κλειδώνει τον αριθμό τους. Το άγνωστο
 * παύει να είναι διάχυτο και γίνεται **απογραφή που μόνο μικραίνει** — ίδιο ιδίωμα με
 * τις baselines των πυλών (N.12), αλλά πάνω σε **νομική** άγνοια.
 *
 * ⚠️ **ΤΙ ΔΕΝ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ**: δεν είναι νομική συμβουλή (ADR-835 §7, ρητή
 * επιφύλαξη). Καταγράφει **ποια ερώτηση σηκώνεται**, με **παραπομπή**· δεν αποφαίνεται
 * αν κάποιος συμμορφώνεται, και δεν κωδικοποιεί ποσοστά, όρια ημερών ή αριθμό ακινήτων
 * ανά ΑΦΜ — αριθμούς που **αλλάζουν με νόμο**.
 *
 * **Layering**: leaf — καθαροί τύποι + καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { OFFER_KINDS, type OfferKind } from '@/types/property-offers';
import { LEGALITY_CLAIM_KINDS, type LegalityClaimKind } from './legality-claim';

// =============================================================================
// 1. ΤΟ ΚΕΛΙ — τρεις απαντήσεις, καμία σιωπηλή
// =============================================================================

/**
 * **Σηκώνει αυτή η διάθεση αυτή την αξίωση;** — διακριτή ένωση, ώστε το
 * `'unresolved'` να **μην μπορεί** να μεταμφιεστεί σε «όχι».
 *
 * 🔴 Οι δύο βέβαιες απαντήσεις κουβαλούν **διάταξη**· η τρίτη κουβαλά **ερώτηση**.
 * Ένα σκέτο `boolean` θα είχε χωρέσει μόνο τις δύο πρώτες, και η τρίτη θα είχε πέσει
 * στη μία από αυτές — σιωπηλά.
 */
export type LegalityRelevance =
  | { readonly relevance: 'raised'; readonly statute: string }
  | { readonly relevance: 'not-raised'; readonly statute: string }
  | { readonly relevance: 'unresolved'; readonly question: string };

/** Ένα ανοιχτό κελί, με τις συντεταγμένες του — για την απογραφή. */
export interface UnresolvedLegalityCell {
  readonly offerKind: OfferKind;
  readonly claimKind: LegalityClaimKind;
  readonly question: string;
}

// =============================================================================
// 2. Ο ΠΙΝΑΚΑΣ
// =============================================================================

/** Ο ΑΜΑ αφορά **αποκλειστικά** τη βραχυχρόνια — η ίδια άρνηση, τρεις φορές. */
const AMA_NOT_SHORT_STAY: LegalityRelevance = {
  relevance: 'not-raised',
  statute: 'άρθρο 46 Ν.4179/2013 — αφορά ακίνητα βραχυχρόνιας διαμονής',
};

/** Το άρθρο 83 μιλά για δικαιοπραξία **μεταβίβασης** — η μίσθωση δεν μεταβιβάζει. */
const TRANSFER_ONLY: LegalityRelevance = {
  relevance: 'not-raised',
  statute: 'άρθρο 83 Ν.4495/2017 — αφορά δικαιοπραξία μεταβίβασης, όχι μίσθωση',
};

/**
 * **Δεκαέξι κελιά, δεκαέξι γραμμένες απαντήσεις.**
 *
 * 🔑 **Διπλό `Record` πάνω σε δύο κλειστά σύνολα**: **πέμπτη** διάθεση **ή** πέμπτο
 * είδος αξίωσης **δεν μεταγλωττίζεται** μέχρι κάποιος να απαντήσει **κάθε** νέο κελί.
 * Είναι ο ίδιος φρουρός με το `STATUTORY_TERM_LIMITS` (ADR-832) — υψωμένος σε δύο
 * διαστάσεις, επειδή το ερώτημα **έχει** δύο.
 */
export const LEGALITY_OFFER_MATRIX: Readonly<
  Record<OfferKind, Readonly<Record<LegalityClaimKind, LegalityRelevance>>>
> = {
  sell: {
    'short-stay-registry': AMA_NOT_SHORT_STAY,
    'building-identity': {
      relevance: 'raised',
      statute: 'άρθρο 83 Ν.4495/2017 — υπεύθυνη δήλωση ιδιοκτήτη + βεβαίωση μηχανικού',
    },
    'arbitrary-settlement': {
      relevance: 'raised',
      statute: 'Ν.4495/2017 — η τακτοποίηση δηλώνεται στη μεταβίβαση',
    },
    'energy-performance': {
      relevance: 'raised',
      statute: 'άρθρο 12 Ν.4122/2013 — ενεργειακή κατηγορία σε κάθε εμπορική αγγελία',
    },
  },
  leaseOut: {
    'short-stay-registry': AMA_NOT_SHORT_STAY,
    'building-identity': TRANSFER_ONLY,
    'arbitrary-settlement': TRANSFER_ONLY,
    'energy-performance': {
      relevance: 'raised',
      statute: 'άρθρο 12 Ν.4122/2013 — «πώληση ή μίσθωση», σε κάθε εμπορική αγγελία',
    },
  },
  exchange: {
    'short-stay-registry': AMA_NOT_SHORT_STAY,
    // 🔑 **Ναι, ΚΑΙ σε γυμνό οικόπεδο** — το άρθρο 83 το λέει ρητά, και είναι το
    //    σημείο όπου η αντιπαροχή εκπλήσσει: «ή **οικοπέδου χωρίς κτίσμα**».
    'building-identity': {
      relevance: 'raised',
      statute: 'άρθρο 83 Ν.4495/2017 — «ή οικοπέδου χωρίς κτίσμα»',
    },
    'arbitrary-settlement': {
      relevance: 'raised',
      statute: 'Ν.4495/2017 — η αντιπαροχή είναι μεταβίβαση',
    },
    'energy-performance': {
      relevance: 'unresolved',
      question:
        'Σηκώνει η αντιπαροχή ΠΕΑ; Το άρθρο 12 Ν.4122/2013 αφορά κτίριο ή κτιριακή μονάδα· η αντιπαροχή αφορά οικόπεδο, που μπορεί να φέρει υφιστάμενο κτίσμα. Δεν βρέθηκε ρητή διάταξη.',
    },
  },
  leaseShort: {
    'short-stay-registry': {
      relevance: 'raised',
      statute: 'άρθρο 46 Ν.4179/2013 · Καν. (ΕΕ) 2024/1028 (εφαρμογή από 20/05/2026)',
    },
    'building-identity': TRANSFER_ONLY,
    'arbitrary-settlement': TRANSFER_ONLY,
    // 🔴 **ΔΕΝ ΒΡΕΘΗΚΕ — και γι' αυτό ΔΕΝ γράφεται `not-raised`.** Δες την κεφαλίδα.
    'energy-performance': {
      relevance: 'unresolved',
      question:
        'Σηκώνει η βραχυχρόνια μίσθωση ΠΕΑ; Το άρθρο 12 §7 Ν.4122/2013 παραπέμπει σε εξαιρέσεις του άρθρου 4 §7 (β) και (ε), το περιεχόμενο των οποίων δεν επαληθεύτηκε (έρευνα 2026-08-31).',
    },
  },
};

// =============================================================================
// 3. ΟΙ ΠΟΡΤΕΣ
// =============================================================================

/**
 * **Τι λέει ο πίνακας για αυτό το ζεύγος;** — η μία πόρτα προς το κελί.
 *
 * Υπάρχει ώστε κανείς να μη γράψει `LEGALITY_OFFER_MATRIX[a][b]` με ωμά κλειδιά.
 */
export function legalityRelevanceFor(
  offerKind: OfferKind,
  claimKind: LegalityClaimKind,
): LegalityRelevance {
  return LEGALITY_OFFER_MATRIX[offerKind][claimKind];
}

/**
 * **Ποιες αξιώσεις σηκώνουν ΑΥΤΕΣ οι διαθέσεις** — ο **παρονομαστής** της προβολής.
 *
 * 🔴 **Το `'unresolved'` ΜΠΑΙΝΕΙ ΜΕΣΑ, και είναι η καρδιά του αρχείου.** Ένα ακίνητο
 * βραχυχρόνιας θα ρωτηθεί και για ΠΕΑ — και η οθόνη θα πει *«δεν το ξέρουμε»* αντί να
 * το **παραλείψει**. Η παράλειψη θα ήταν *«δεν χρειάζεται»*, δηλαδή ακριβώς ο
 * ισχυρισμός που δεν επαληθεύτηκε. Η ADR-835 Φ3 πλήρωσε αυτό το μάθημα: *«δύο ελλιπείς
 * λίστες που επιβεβαίωναν η μία την άλλη»* — **ο παρονομαστής πρέπει να είναι πλήρης**.
 *
 * ⚠️ Επιστρέφει με τη σειρά του {@link LEGALITY_CLAIM_KINDS} και **χωρίς διπλότυπα**,
 * ώστε δύο διαθέσεις που σηκώνουν το ίδιο ερώτημα να δίνουν **μία** γραμμή.
 */
export function raisedClaimKinds(
  offerKinds: readonly OfferKind[],
): readonly LegalityClaimKind[] {
  return LEGALITY_CLAIM_KINDS.filter((claimKind) =>
    offerKinds.some((offerKind) => {
      const cell = legalityRelevanceFor(offerKind, claimKind);
      return cell.relevance !== 'not-raised';
    })
  );
}

/**
 * **Η απογραφή της άγνοιας** — κάθε κελί που κανείς δεν έχει απαντήσει ακόμη.
 *
 * Η σειρά είναι ντετερμινιστική (διαθέσεις × είδη, όπως δηλώνονται), ώστε η άγκυρα να
 * μπορεί να ελέγξει **ποια** κελιά, όχι μόνο πόσα.
 */
export function unresolvedLegalityCells(): readonly UnresolvedLegalityCell[] {
  const cells: UnresolvedLegalityCell[] = [];

  for (const offerKind of OFFER_KINDS) {
    for (const claimKind of LEGALITY_CLAIM_KINDS) {
      const cell = legalityRelevanceFor(offerKind, claimKind);
      if (cell.relevance !== 'unresolved') continue;
      cells.push({ offerKind, claimKind, question: cell.question });
    }
  }

  return cells;
}
