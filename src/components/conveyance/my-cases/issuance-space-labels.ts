/**
 * @fileoverview **Οι ετικέτες του χώρου της ανάθεσης** («Οι υποθέσεις μου» → κάρτα + σελίδα) — κλειστοί πίνακες κλειδιών.
 * @related ADR-915 §39 · ADR-862 §5.3.11 · `case-invite-labels.ts` (το πρότυπο) · ADR-744 (slice διαδρομής)
 * @module components/conveyance/my-cases/issuance-space-labels
 *
 * ⚠️ **Μέλη αντικειμένων, ποτέ δυναμικό `${…}`**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη πινάκων ετικετών.
 * 🔑 Το **έγγραφο**, το **στάδιο** και η **σειρά** έρχονται από τους πίνακες του μητρώου λήξεων
 *    (`DOCUMENT_KIND_LABEL_KEYS` · `ISSUANCE_STAGE_KEYS` · `BALL_IN_COURT_KEYS`) — μία λέξη για το ίδιο γεγονός,
 *    είτε το βλέπει το γραφείο είτε ο επαγγελματίας.
 */

export const ISSUANCE_SPACE_KEYS = {
  kindLabel: 'conveyance:engagement.issuance.kindLabel',
  fromOffice: 'conveyance:engagement.issuance.fromOffice',
  unnamedOffice: 'conveyance:engagement.issuance.unnamedOffice',
  untitledProperty: 'conveyance:engagement.issuance.untitledProperty',
  unknownDocument: 'conveyance:engagement.issuance.unknownDocument',
  stageLabel: 'conveyance:engagement.issuance.stageLabel',
  ballLabel: 'conveyance:engagement.issuance.ballLabel',
  ballLine: 'conveyance:engagement.issuance.ballLine',
  open: 'conveyance:engagement.issuance.open',
  officeLabel: 'conveyance:engagement.issuance.officeLabel',
  propertyLabel: 'conveyance:engagement.issuance.propertyLabel',
  documentLabel: 'conveyance:engagement.issuance.documentLabel',
  credentialLabel: 'conveyance:engagement.issuance.credentialLabel',
  credentialValue: 'conveyance:engagement.issuance.credentialValue',
  requestedLabel: 'conveyance:engagement.issuance.requestedLabel',
  scope: 'conveyance:engagement.issuance.scope',
} as const;
