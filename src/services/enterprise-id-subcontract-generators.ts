/**
 * Γεννήτορες ταυτοτήτων του **συμφωνητικού υπεργολαβίας** (ADR-928 §5.1) — κρίκος της αλυσίδας
 * γεννητόρων, ακριβώς κάτω από την `EnterpriseIdService`:
 *
 *   EnterpriseIdService
 *     ↑ extends
 *   SubcontractIdGenerators    ← εδώ
 *     ↑ extends
 *   CatalogIdGenerators        (και η υπόλοιπη αλυσίδα)
 *
 * Ποιο id είναι ντετερμινιστικό και γιατί: `enterprise-id-prefixes-subcontract.ts`. Τα ντετερμινιστικά
 * βγαίνουν v4 (`mintDeterministicV4Id`, ADR-841 Α9.6: ο επικυρωτής του έργου δέχεται μόνο v4).
 *
 * ⚠️ **Καθαρές συναρτήσεις σπόρου, χωρίς επικύρωση εισόδου** — όπως κάθε γεννήτορας της αλυσίδας: το
 * συμβόλαιο της κλάσης (`enterprise-id.service.test.ts`) τους καλεί με **ένα** όρισμα και καταγράφει χρυσό
 * id. Ότι ο αριθμός αναθεώρησης/έκδοσης είναι θετικός ακέραιος το εγγυάται ο **ΕΝΑΣ γραφέας** (ADR-928 §5.5),
 * που τον υπολογίζει μέσα στη συναλλαγή — ποτέ ο καλών.
 * @module services/enterprise-id-subcontract-generators
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { CatalogIdGenerators } from './enterprise-id-catalog-generators';

const P = ENTERPRISE_ID_PREFIXES;

const seedOf = (kind: string, ...parts: readonly (string | number)[]) => `subcontract:${kind}:${parts.join(':')}`;

export abstract class SubcontractIdGenerators extends CatalogIdGenerators {
  /** Συμφωνητικό — **τυχαίο**: ο αριθμός του εγγράφου είναι ιδιότητα από μετρητή, όχι ταυτότητα. */
  generateSubcontractAgreementId(): string {
    return this.generateId(P.SUBCONTRACT_AGREEMENT).id;
  }

  /** Αναθεώρηση — από (συμφωνητικό, αριθμός): δεύτερη ταυτόχρονη έκδοση ⇒ ίδιο έγγραφο ⇒ σύγκρουση. */
  generateDeterministicSubcontractRevisionId(agreementId: string, revisionNumber: number): string {
    return this.mintDeterministicV4Id(P.SUBCONTRACT_REVISION, seedOf('revision', agreementId, revisionNumber));
  }

  /** Ανάθεση εργοταξίου — **τυχαίο**: ίδιο έργο μπορεί να ανατεθεί ξανά σε άλλη περίοδο. */
  generateSubcontractAssignmentId(): string {
    return this.generateId(P.SUBCONTRACT_ASSIGNMENT).id;
  }

  /** Ρήτρα βιβλιοθήκης — από (χώρος, `clauseKey`). */
  generateDeterministicSubcontractClauseId(companyId: string, clauseKey: string): string {
    return this.mintDeterministicV4Id(P.SUBCONTRACT_CLAUSE, seedOf('clause', companyId, clauseKey));
  }

  /** Έκδοση ρήτρας — από (ρήτρα, αριθμός έκδοσης). */
  generateDeterministicSubcontractClauseVersionId(clauseId: string, version: number): string {
    return this.mintDeterministicV4Id(P.SUBCONTRACT_CLAUSE_VERSION, seedOf('clause-version', clauseId, version));
  }

  /** Πρότυπο ειδικότητας — από (χώρος, κωδικός προτύπου). */
  generateDeterministicSubcontractTradeTemplateId(companyId: string, templateCode: string): string {
    return this.mintDeterministicV4Id(P.SUBCONTRACT_TRADE_TEMPLATE, seedOf('trade-template', companyId, templateCode));
  }
}
