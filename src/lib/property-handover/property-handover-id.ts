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

import { generateDeterministicPropertyHandoverId } from '@/services/enterprise-id.service';

export function propertyHandoverIdOf(companyId: string, propertyId: string, recipientContactId: string): string {
  return generateDeterministicPropertyHandoverId(`${companyId}:${propertyId}:${recipientContactId}`);
}
