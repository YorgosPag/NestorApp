/**
 * Τα παρακολουθούμενα πεδία της **υπεργολαβίας** (ADR-928 · ADR-195) — ποιες αλλαγές αφήνουν ίχνος στο ιστορικό.
 * Ετικέτες: namespace `procurement`, `subcontracts.audit.fields.*`.
 *
 * 🔑 Της **έκδοσης** ρήτρας παρακολουθείται η **διακυβέρνηση** (κατάσταση · απόφαση · έλεγχος · μεταφράσεις). Το σώμα
 * και οι παράμετροι δεν αλλάζουν ποτέ μετά τη δημιουργία· ταυτότητά τους στο ιστορικό είναι το `contentHash`.
 * 🔑 Οι μεταφράσεις προβάλλονται ως `{γλώσσα: κατάσταση}` (ο γραφέας το κάνει πριν από τη σύγκριση): «εγκρίθηκε η
 * αγγλική» είναι η αλλαγή, όχι 40 γραμμές σώματος.
 * @module config/audit-tracked-fields-subcontracts
 */

import { trackedFieldDefsIn } from './audit-tracked-field-builders';

const defs = trackedFieldDefsIn('procurement:subcontracts.audit.fields');

export const SUBCONTRACT_CLAUSE_TRACKED_FIELDS = defs(
  ['clauseKey', 'currentVersion', 'latestVersion', 'openProposal', 'isArchived'],
  ['title'],
);

export const SUBCONTRACT_CLAUSE_VERSION_TRACKED_FIELDS = defs(
  ['version', 'state', 'professionalReview', 'effectiveFrom', 'supersededBy', 'contentHash', 'proposalReason', 'decisionReason', 'decidedBy', 'reviewedBy'],
  ['translationStatus'],
);

export const SUBCONTRACT_TRADE_TEMPLATE_TRACKED_FIELDS = defs(
  ['code', 'trade', 'defaultDocumentMode', 'isArchived'],
  ['title', 'lines', 'clauses', 'defaultTerms'],
);

/**
 * Συμφωνητικό (Φ2). 🔑 Οι αποκλίσεις προβάλλονται ως `{κλειδί.παράμετρος: απόφαση}` (`deviationStatus`, ο γραφέας το
 * κάνει πριν από τη σύγκριση): «εγκρίθηκε η απόκλιση της κράτησης» είναι η αλλαγή που διαβάζει ο άνθρωπος (§5.2.1).
 */
export const SUBCONTRACT_AGREEMENT_TRACKED_FIELDS = defs(
  ['documentNumber', 'role', 'documentMode', 'status', 'trade', 'templateId', 'validUntil', 'mobilizedOn', 'issuedRevision', 'sourceOfferId', 'agreementId'],
  ['title', 'parties', 'scope', 'lines', 'terms', 'clauses', 'languages', 'deviationStatus'],
);

/** Αμετάβλητη αναθεώρηση: γράφεται μία φορά — το ίχνος λέει ποιο αποτύπωμα πάγωσε και πότε. */
export const SUBCONTRACT_AGREEMENT_REVISION_TRACKED_FIELDS = defs(
  ['revisionNumber', 'amends', 'contentHash', 'pdfFileId', 'sealed'],
  [],
);
