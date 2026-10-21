/**
 * ENTERPRISE ID — ΟΙ ΤΑΥΤΟΤΗΤΕΣ ΤΟΥ ΚΟΣΤΟΥΣ ΕΡΓΟΥ (ADR-917)
 *
 * Νέος κρίκος της αλυσίδας (βλ. `enterprise-id-composite-key-generators.ts`) — όχι γραμμή στο
 * `enterprise-id-class.ts`, που βρίσκεται στο όριο των 500 γραμμών (N.7.1): **διάσπαση ανά τομέα**.
 *
 * ⚠️ Η μηχανή (`mintDeterministicV4Id`) μένει στην `EnterpriseIdService`· εδώ μόνο **ονοματοδοσία**.
 *
 * @module services/enterprise-id-project-cost-generators
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { DocumentRegistryIdGenerators } from './enterprise-id-document-registry-generators';

const P = ENTERPRISE_ID_PREFIXES;

export abstract class ProjectCostIdGenerators extends DocumentRegistryIdGenerators {
  /**
   * ADR-917 Ζ3 · Ζ8 — **ΜΙΑ** γραμμή προϋπολογισμού ανά (έργο, κωδικό κόστους): ορισμός = `set` στο **ίδιο**
   * έγγραφο, ιδεμποτές από κατασκευή — δύο ταυτόχρονα «πρόσθεσε γραμμή» δεν γεννούν ποτέ δύο γραμμές.
   */
  generateDeterministicProjectBudgetLineId(seed: string): string {
    return this.mintDeterministicV4Id(P.PROJECT_BUDGET_LINE, seed);
  }
}
