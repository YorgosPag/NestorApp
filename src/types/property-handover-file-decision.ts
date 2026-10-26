/**
 * @fileoverview **Η απόφαση του γραφείου ανά αρχείο** — «αυτό παραδίδεται» / «αυτό μένει εσωτερικό» (ADR-916 §5.18 Φ-Δ.4).
 * @related lib/property-handover/handover-file-decision-plan.ts (η ΜΙΑ κρίση: κουμπί ΚΑΙ πόρτα) ·
 *          lib/property-handover/file-handover-decision.ts (το πεδίο στο αρχείο)
 * @module types/property-handover-file-decision
 *
 * Κλειστά λεξιλόγια — τα διαβάζουν η καθαρή κρίση, η πόρτα, ο πελάτης και τα κείμενα (`Record<…>` ⇒ πληρότητα).
 */

/** Ό,τι μπορεί να **ορίσει** το γραφείο. Το `review` **δεν** είναι απόφαση — είναι η απουσία της. */
export const HANDOVER_FILE_DECISION_DISPOSITIONS = ['deliver', 'internal'] as const;
export type HandoverFileDecisionDisposition = (typeof HANDOVER_FILE_DECISION_DISPOSITIONS)[number];

/** Οι επιλογές του διαλόγου: μία απόφαση, ή `automatic` = «σβήσε την απόφαση, κρίνει ο κανόνας». */
export const HANDOVER_FILE_DECISION_CHOICES = ['deliver', 'internal', 'automatic'] as const;
export type HandoverFileDecisionChoice = (typeof HANDOVER_FILE_DECISION_CHOICES)[number];

/**
 * **Γιατί** ένα αρχείο είναι εκεί που είναι — ο κανόνας της κρίσης που απάντησε πρώτος (Purview «policy tip»: ο άνθρωπος
 * βλέπει **ποιος κανόνας** τον σταμάτησε, όχι μόνο ότι σταμάτησε). `unrecognised` = το έγγραφο δεν διαβάστηκε (Δ3).
 */
export const HANDOVER_DISPOSITION_BASES = [
  'protocol',
  'office-decision',
  'confidential',
  'office-domain',
  'catalog',
  'category',
  /** ADR-916 Φ-Γ3 — κοινό αρχείο κτιρίου/έργου χωρίς δήλωση `sharedHandover` ⇒ μένει στο γραφείο, ως να αποφασίσει. */
  'shared-undeclared',
  'unrecognised',
] as const;
export type HandoverDispositionBasis = (typeof HANDOVER_DISPOSITION_BASES)[number];

/** Γιατί **δεν** προσφέρεται καμία επιλογή για ένα αρχείο. */
export const HANDOVER_FILE_DECISION_BLOCKS = ['protocol-file', 'already-delivered', 'unrecognised'] as const;
export type HandoverFileDecisionBlock = (typeof HANDOVER_FILE_DECISION_BLOCKS)[number];

/** **Η προσφορά** για ένα αρχείο — από την ΙΔΙΑ κρίση που εφαρμόζει η πόρτα (άγκυρα Ζ29). */
export type HandoverFileDecisionOffer =
  | {
      readonly kind: 'open';
      /** Οι επιλογές που **αλλάζουν** κάτι — ποτέ η τρέχουσα κατάσταση. */
      readonly choices: readonly HandoverFileDecisionChoice[];
      /** Τι θα έκρινε ο κανόνας **χωρίς** απόφαση — για να ξέρει ο άνθρωπος τι σημαίνει «Αυτόματα». */
      readonly automatic: 'deliver' | 'review' | 'internal';
      /** Εμπιστευτικό ⇒ το «Παραδίδεται» ζητά ρητή επιβεβαίωση (DLP override, Purview). */
      readonly deliverNeedsConfirmation: boolean;
    }
  | { readonly kind: 'blocked'; readonly reason: HandoverFileDecisionBlock };

/** Το σώμα της πόρτας `POST /api/properties/[id]/handover/file-decision`. */
export interface HandoverFileDecisionRequest {
  readonly fileId: string;
  readonly choice: HandoverFileDecisionChoice;
  /** Η απόφαση που **είδε** ο άνθρωπος (`null` = καμία) — optimistic concurrency: άλλη ⇒ `stale`. */
  readonly expected: HandoverFileDecisionDisposition | null;
  /** Υποχρεωτική αιτιολογία (Purview «business justification») — ορατή **μόνο** στο γραφείο. */
  readonly reason: string;
  readonly confirmConfidential: boolean;
}

/**
 * Τα όρια της αιτιολογίας — για zod, διάλογο και κρίση. Φ-Δ.5: **η ΙΔΙΑ** αιτιολογία με κάθε πράξη γραφείου στην παράδοση
 * (`config/property-handover-office-policy.ts`) — δύο αριθμοί σε δύο αρχεία θα απέκλιναν.
 */
export {
  HANDOVER_OFFICE_REASON_MIN as HANDOVER_FILE_DECISION_REASON_MIN,
  HANDOVER_OFFICE_REASON_MAX as HANDOVER_FILE_DECISION_REASON_MAX,
} from '@/config/property-handover-office-policy';

export const HANDOVER_FILE_DECISION_REFUSALS = [
  'file-unknown',
  'protocol-file',
  'unrecognised',
  'stale',
  'already-delivered',
  'confidential-unconfirmed',
] as const;
export type HandoverFileDecisionRefusal = (typeof HANDOVER_FILE_DECISION_REFUSALS)[number];

/** Ο διακριτής του σώματος άρνησης — ο πελάτης τον ελέγχει **πριν** από τον λόγο. */
export const HANDOVER_FILE_DECISION_REFUSED = 'HANDOVER_FILE_DECISION_REFUSED';

/** Το συμβόλαιο της πόρτας — 🔒 ποτέ αιτιολογία, ποτέ uid. */
export type HandoverFileDecisionResponse =
  | { readonly status: 'decided' | 'unchanged' }
  | { readonly error: typeof HANDOVER_FILE_DECISION_REFUSED; readonly reason: HandoverFileDecisionRefusal }
  | { readonly error: 'FILE_DECISION_UNAVAILABLE' };
