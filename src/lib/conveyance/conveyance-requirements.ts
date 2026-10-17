/**
 * =============================================================================
 * Conveyance — οι απαιτήσεις εγγράφων της μεταβίβασης (ADR-915 Φ2 · ADR-901 §5.5)
 * =============================================================================
 *
 * **Παραγωγός**, όχι κατάλογος: διαβάζει τον υπάρχοντα κατάλογο μεταβίβασης. Κάθε γραμμή που δηλώνει `documentKind`
 * (έγγραφο που ρωτούν κι άλλες διαδικασίες) γίνεται απαίτηση **`block`** για την **ημέρα υπογραφής**: σε ληγμένο ΠΕΑ ο
 * συμβολαιογράφος δεν υπογράφει.
 *
 * Το ίδιο `conveyanceNeededOn` το ρωτά και ο `deriveChecklist` ⇒ το `validOnSigning` κάθε γραμμής και το «τι σταματά
 * αν λήξει» βγαίνουν από την **ίδια** δήλωση.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 *
 * @module lib/conveyance/conveyance-requirements
 */

import { isDateKey } from '@/lib/calendar/date-key';
import { EXPIRING_WINDOW_DAYS } from '@/config/conveyance-checklist/catalog';
import type { CaseRow } from './case-rows';
import type {
  DocumentRequirement,
  NeededOn,
  RequirementAttestation,
  RequirementPresence,
} from '@/lib/document-validity/document-requirement';

/** Η μέρα που η μεταβίβαση χρειάζεται τα έγγραφα: η υπογραφή — ή «δεν ορίστηκε ακόμη», ποτέ «δεν χρειάζεται». */
export function conveyanceNeededOn(targetSigningDate: string | null): NeededOn {
  return targetSigningDate !== null && isDateKey(targetSigningDate)
    ? { kind: 'on', day: targetSigningDate }
    : { kind: 'unscheduled' };
}

export interface ConveyanceRequirementsInput {
  /** ADR-915 §22 — οι γραμμές της υπόθεσης (κατάλογος × πρόσωπα): κάθε συμπωλητής έχει τη δική του απαίτηση. */
  readonly rows: readonly CaseRow[];
  readonly caseId: string;
  readonly propertyId: string;
  readonly targetSigningDate: string | null;
  /**
   * ADR-915 Φ4δ — λέγεται η απουσία της γραμμής; Το κρίνει ο καλών που ξέρει τα γεγονότα της υπόθεσης. **Χωρίς** κριτή ⇒
   * `tracked`: ο σκέτος κατάλογος δεν ξέρει αν η γραμμή εφαρμόζεται, άρα δεν ισχυρίζεται «λείπει».
   */
  readonly presenceOf?: (row: CaseRow) => RequirementPresence;
  /** ADR-915 Φ4δ — ο εγκεκριμένος έλεγχος της γραμμής, αν υπάρχει. Χωρίς κριτή ⇒ `null`. */
  readonly attestationOf?: (row: CaseRow) => RequirementAttestation | null;
}

/**
 * Οι απαιτήσεις μίας υπόθεσης — μία ανά γραμμή με `documentKind`. Η βάση κρατά το **κλειδί γραμμής** (`row.key`): δύο
 * συμπωλητές = δύο απαιτήσεις φορολογικής, που δεν μπορούν να συγχωνευτούν σε μία.
 */
export function conveyanceRequirements(input: ConveyanceRequirementsInput): readonly DocumentRequirement[] {
  const neededOn = conveyanceNeededOn(input.targetSigningDate);
  return input.rows.flatMap((row): DocumentRequirement[] => (row.item.documentKind === undefined ? [] : [{
    documentKind: row.item.documentKind,
    // ADR-915 §25 (5γ) — η γραμμή προσώπου κουβαλά το πρόσωπό της ως το τέλος: κάτοχος · κενό · «Το φέρνει».
    subject: { propertyId: input.propertyId, party: row.party === null ? null : { key: row.party.key, contactId: row.party.contactId } },
    process: { kind: 'conveyance', caseId: input.caseId },
    neededOn,
    policy: 'block',
    warnWindowDays: EXPIRING_WINDOW_DAYS,
    basis: { kind: 'checklist-item', itemId: row.key, verifiedAt: row.item.verifiedAt },
    presence: input.presenceOf?.(row) ?? 'tracked',
    attestation: input.attestationOf?.(row) ?? null,
  }]));
}
