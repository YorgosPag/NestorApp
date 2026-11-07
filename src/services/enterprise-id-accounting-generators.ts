/**
 * ENTERPRISE ID — ΟΙ ΤΑΥΤΟΤΗΤΕΣ ΤΟΥ ΒΙΒΛΙΟΥ ΕΣΟΔΩΝ-ΕΞΟΔΩΝ (ADR-ACC-010 §2.1.1 Φάση 8)
 *
 * Νέος κρίκος της αλυσίδας (βλ. `enterprise-id-composite-key-generators.ts`) — όχι γραμμή στο
 * `enterprise-id-class.ts`, που βρίσκεται στο όριο των 500 γραμμών (N.7.1): **διάσπαση ανά τομέα**.
 *
 * ⚠️ Η μηχανή (`mintDeterministicV4Id`) μένει στην `EnterpriseIdService`· εδώ μόνο **ονοματοδοσία**.
 *
 * @module services/enterprise-id-accounting-generators
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { DocumentRegistryIdGenerators } from './enterprise-id-document-registry-generators';

const P = ENTERPRISE_ID_PREFIXES;

export abstract class AccountingIdGenerators extends DocumentRegistryIdGenerators {
  /**
   * ADR-ACC-010 §2.1.1 Φ8 — **ΕΝΑΣ** αντιλογισμός ανά αρχική εγγραφή (SAP FB08 · DATEV Generalumkehr): σπόρος
   * = id της αρχικής ⇒ διπλό κλικ, επανάληψη δικτύου ή δύο ταυτόχρονα αιτήματα βρίσκουν το **ίδιο** έγγραφο και
   * το `transaction.create` συγκρούεται — δεύτερο storno είναι **δομικά αδύνατο**. Πρόθεμα `je`: κανονική εγγραφή.
   */
  generateDeterministicJournalReversalEntryId(originalEntryId: string): string {
    return this.mintDeterministicV4Id(P.JOURNAL_ENTRY, `journal-reversal:${originalEntryId}`);
  }
}
