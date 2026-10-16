/**
 * =============================================================================
 * Conveyance — η έγκριση ως ΔΗΛΩΣΗ γεγονότων εγγράφου (ADR-915 Φ3β · βήμα 11)
 * =============================================================================
 *
 * `εντολή ελέγχου + τεκμήρια → «γράψε στο αρχείο: εκδόθηκε στις …»` ή τίποτα.
 *
 * Όταν ο ελεγκτής **αποδέχεται** έγγραφο είδους που λήγει (`documentKind`) και δηλώνει ημερομηνία έκδοσης, η δήλωσή
 * του γίνεται **κοινή αλήθεια του αρχείου** (`attested`, μέσω `conveyance-review`): η επόμενη υπόθεση, το ακίνητο και η
 * αγγελία τη διαβάζουν αντί να ξαναρωτήσουν. Το `review.issuedOn` **μένει** — είναι η νομική πράξη του ελεγκτή.
 *
 * 🔒 Μόνο σε αρχεία του **μισθωτή-οικοδεσπότη** (`owned`): ένα transmittal είναι προσωπικό αρχείο επαγγελματία, και η
 * έγκριση του οικοδεσπότη **δεν** γράφει σε ξένη θεματοφυλακή (ADR-901 Α18/Α24).
 *
 * Η ιεραρχία (`document-text` > `attested`) δεν κρίνεται εδώ — την κρίνει ο ΕΝΑΣ γραφέας (`outranked`).
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 *
 * @module lib/conveyance/review-attestation
 */

import { checklistItemOfRowKey } from '@/config/conveyance-checklist/row-key';
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import type { ExpiryDiscrepancy } from '@/lib/document-validity/document-expiry';
import {
  documentFactsExpiry,
  isDocumentText,
  type DocumentFactsClaim,
} from '@/lib/document-validity/document-facts';
import type { EvidenceFile } from '@/types/conveyance-case';
import type { ConveyanceCommand } from './conveyance-commands';

/** Ό,τι ξέρει ήδη το αρχείο για τις ημερομηνίες του — η προσυμπλήρωση του διαλόγου ελέγχου. */
export interface ReviewIssuedOn {
  /** `YYYY-MM-DD` ή `null` = το αρχείο δεν ξέρει. */
  readonly issuedOn: string | null;
  /** Η τυπωμένη λήξη (ADR-915 §14) — `null` = το αρχείο δεν ξέρει. Ίδιο κλείδωμα με την έκδοση (`origin`). */
  readonly printedValidUntil: string | null;
  /** `document-text` ⇒ **κλειδωμένο** (η διαφωνία γίνεται με επιστροφή)· `attested` ⇒ επεξεργάσιμο. */
  readonly origin: 'document-text' | 'attested' | null;
  /** Α4 — τυπωμένη λήξη ≠ κανόνας: ο ελεγκτής είναι ο αποδέκτης της. */
  readonly discrepancy: ExpiryDiscrepancy | null;
}

const UNKNOWN: ReviewIssuedOn = { issuedOn: null, printedValidUntil: null, origin: null, discrepancy: null };

/**
 * Το **αρχείο που ελέγχεται** (το νεότερο της γραμμής) → τι προσυμπληρώνει ο διάλογος. Γεγονότα άλλου είδους
 * αγνοούνται — ίδια κρίση με τον κατάλογο (`resolvedDocumentExpiry`) και τον φρουρό της εντολής.
 */
export function reviewIssuedOnOf(item: Pick<ChecklistItem, 'documentKind'>, file: EvidenceFile | undefined): ReviewIssuedOn {
  const facts = file?.documentFacts ?? null;
  if (facts === null || facts.kind !== item.documentKind) return UNKNOWN;
  return {
    issuedOn: facts.issuedOn,
    printedValidUntil: facts.printedValidUntil,
    origin: isDocumentText(facts) ? 'document-text' : 'attested',
    discrepancy: documentFactsExpiry(facts).discrepancy,
  };
}

export interface ReviewAttestation {
  readonly fileId: string;
  readonly claim: DocumentFactsClaim;
}

/** Τι γράφεται στο αρχείο μετά από **επιτυχή** έγκριση — ή `null`. */
export function attestationOfReview(
  command: ConveyanceCommand,
  evidence: readonly EvidenceFile[],
  actorUid: string,
): ReviewAttestation | null {
  if (command.type !== 'review' || command.verdict !== 'accepted') return null;
  const printedValidUntil = command.validUntil ?? null;
  if ((command.issuedOn === null && printedValidUntil === null) || command.fileId === null) return null;
  const kind = checklistItemOfRowKey(command.itemId)?.documentKind;
  const file = evidence.find((candidate) => candidate.fileId === command.fileId);
  if (kind === undefined || file === undefined || file.source.kind !== 'owned') return null;
  return {
    fileId: file.fileId,
    claim: {
      kind,
      issuedOn: command.issuedOn,
      printedValidUntil,
      source: { kind: 'attested', via: 'conveyance-review' },
      recordedBy: actorUid,
    },
  };
}
