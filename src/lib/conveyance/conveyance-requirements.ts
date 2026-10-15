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
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
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
  readonly items: readonly ChecklistItem[];
  readonly caseId: string;
  readonly propertyId: string;
  readonly targetSigningDate: string | null;
  /**
   * ADR-915 Φ4δ — λέγεται η απουσία της γραμμής; Το κρίνει ο καλών που ξέρει τα γεγονότα της υπόθεσης. **Χωρίς** κριτή ⇒
   * `tracked`: ο σκέτος κατάλογος δεν ξέρει αν η γραμμή εφαρμόζεται, άρα δεν ισχυρίζεται «λείπει».
   */
  readonly presenceOf?: (item: ChecklistItem) => RequirementPresence;
  /** ADR-915 Φ4δ — ο εγκεκριμένος έλεγχος της γραμμής, αν υπάρχει. Χωρίς κριτή ⇒ `null`. */
  readonly attestationOf?: (item: ChecklistItem) => RequirementAttestation | null;
}

/** Οι απαιτήσεις μίας υπόθεσης — μία ανά γραμμή με `documentKind`. */
export function conveyanceRequirements(input: ConveyanceRequirementsInput): readonly DocumentRequirement[] {
  const neededOn = conveyanceNeededOn(input.targetSigningDate);
  return input.items.flatMap((item): DocumentRequirement[] => (item.documentKind === undefined ? [] : [{
    documentKind: item.documentKind,
    subject: { propertyId: input.propertyId },
    process: { kind: 'conveyance', caseId: input.caseId },
    neededOn,
    policy: 'block',
    warnWindowDays: EXPIRING_WINDOW_DAYS,
    basis: { kind: 'checklist-item', itemId: item.id, verifiedAt: item.verifiedAt },
    presence: input.presenceOf?.(item) ?? 'tracked',
    attestation: input.attestationOf?.(item) ?? null,
  }]));
}
