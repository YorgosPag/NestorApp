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
