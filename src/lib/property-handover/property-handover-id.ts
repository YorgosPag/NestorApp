/**
 * @fileoverview **Η ταυτότητα μιας παράδοσης** — η ΜΙΑ σύνθεση του σπόρου (ADR-916 §5.2).
 * @module lib/property-handover/property-handover-id
 *
 * 🔑 **Γιατί ντετερμινιστική**: η ίδια πώληση συμφιλιώνεται από **πολλά** σημεία (PATCH · `legalPhase` · δίχτυ ·
 * επανάληψη δικτύου). Με τυχαίο id δύο ταυτόχρονες συμφιλιώσεις θα γεννούσαν **δύο** παραδόσεις ⇒ δύο φακέλους
 * στον αγοραστή. Ίδιο κλειδί ⇒ ίδιο έγγραφο ⇒ η δεύτερη συναλλαγή ξαναπαίζει και βλέπει την πρώτη.
 *
 * 🔒 **Ο μισθωτής μέσα στον σπόρο** (πρότυπο `issuance-assignment-schema.ts`): ένα ακίνητο που θα άλλαζε ποτέ
 * εταιρεία **δεν** μπορεί να γράψει πάνω σε παράδοση άλλου μισθωτή — άλλος μισθωτής, άλλο έγγραφο.
 */

import {
  generateDeterministicFileId,
  generateDeterministicPropertyDossierId,
  generateDeterministicPropertyHandoverDeliveryId,
  generateDeterministicPropertyHandoverId,
} from '@/services/enterprise-id.service';

export function propertyHandoverIdOf(companyId: string, propertyId: string, recipientContactId: string): string {
  return generateDeterministicPropertyHandoverId(`${companyId}:${propertyId}:${recipientContactId}`);
}

/** Ένα παρακολούθημα της πώλησης (θέση στάθμευσης · αποθήκη) — ο **δικός** του φάκελος (Δ4). */
export interface HandoverAppurtenanceKey {
  readonly entityType: string;
  readonly entityId: string;
}

/**
 * **Ο φάκελος του αγοραστή που γεννά μια παράδοση** (ADR-916 Φ-Β) — ένας για το ακίνητο και, από τη Φ-Γ1, **ένας ανά
 * παρακολούθημα** (Δ4: χωριστός ΚΑΕΚ, μεταπωλείται χωριστά). Η παράδοση **ήδη** κρατά μισθωτή, ακίνητο και αγοραστή στην
 * ταυτότητά της, άρα αρκεί ως σπόρος· το πρόθεμα `handover:` χωρίζει τον χώρο σπόρων από κάθε μελλοντική πηγή φακέλου.
 * ⚠️ Ο σπόρος του **κύριου** φακέλου μένει αυτολεξεί ίδιος — φάκελοι που ήδη υπάρχουν δεν αλλάζουν ταυτότητα.
 */
export function handoverDossierIdOf(handoverId: string, appurtenance: HandoverAppurtenanceKey | null = null): string {
  const seed = appurtenance === null
    ? `handover:${handoverId}`
    : `handover:${handoverId}:${appurtenance.entityType}:${appurtenance.entityId}`;
  return generateDeterministicPropertyDossierId(seed);
}

/**
 * **Το αντίγραφο παράδοσης ενός αρχείου** (ADR-916 Φ-Γ1) — ένα ανά `(παράδοση, αρχείο-πηγή)`. Η επανάληψη μετά από
 * διακοπή καταλήγει στο **ίδιο** έγγραφο και στο **ίδιο** κλειδί storage ⇒ ποτέ δεύτερο αντίγραφο του ίδιου αρχείου.
 * Νέα αναθεώρηση της πηγής = **νέο** αρχείο-πηγή ⇒ νέο αντίγραφο· το παλιό μένει ως ιστορικό (ISO 19650).
 */
export function handoverCopyFileIdOf(handoverId: string, sourceFileId: string): string {
  return generateDeterministicFileId(`handover-copy:${handoverId}:${sourceFileId}`);
}

/** **Η γραμμή του καθολικού** για το ίδιο ζεύγος — η απόδειξη του γραφείου ότι το αντίγραφο παραδόθηκε. */
export function handoverDeliveryIdOf(handoverId: string, sourceFileId: string): string {
  return generateDeterministicPropertyHandoverDeliveryId(`${handoverId}:${sourceFileId}`);
}
