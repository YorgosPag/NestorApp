/**
 * @fileoverview **Οι ετικέτες του χώρου της ανάθεσης** («Οι υποθέσεις μου» → κάρτα + σελίδα) — κλειστοί πίνακες κλειδιών.
 * @related ADR-915 §39 · ADR-862 §5.3.11 · `case-invite-labels.ts` (το πρότυπο) · ADR-744 (slice διαδρομής)
 * @module components/conveyance/my-cases/issuance-space-labels
 *
 * ⚠️ **Μέλη αντικειμένων, ποτέ δυναμικό `${…}`**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη πινάκων ετικετών.
 * 🔑 Το **έγγραφο** έρχεται από τον πίνακα του μητρώου λήξεων (`DOCUMENT_KIND_LABEL_KEYS`) — ίδιο όνομα για όλους.
 * 🔑 Το **στάδιο** και η **σειρά** είναι το ΙΔΙΟ γεγονός (`IssuanceStage` · `BallInCourtParty`) με **άλλη λέξη**, γιατί
 *    εδώ διαβάζει ο **ίδιος** ο επαγγελματίας (ADR-915 §39.7): «Σειρά: δική σας», όχι «ο επαγγελματίας» —
 *    οι πίνακες του γραφείου (`ISSUANCE_STAGE_KEYS` · `BALL_IN_COURT_KEYS`) γράφουν από τη θέση του γραφείου.
 *    Ολικοί πάνω στο λεξιλόγιο του πυρήνα: νέο στάδιο ή μέρος **δεν μεταγλωττίζεται** χωρίς λέξη και για τις δύο όψεις.
 */

import type { BallInCourtParty, IssuanceStage } from '@/lib/document-validity/issuance-assignment';

/** Το στάδιο της ανάθεσης όπως το διαβάζει ο επαγγελματίας (δεύτερο πρόσωπο). */
export const PROFESSIONAL_STAGE_KEYS: Readonly<Record<IssuanceStage, string>> = {
  proposed: 'conveyance:engagement.issuance.stage.proposed',
  ownerApproved: 'conveyance:engagement.issuance.stage.ownerApproved',
  ownerRejected: 'conveyance:engagement.issuance.stage.ownerRejected',
  sent: 'conveyance:engagement.issuance.stage.sent',
  accepted: 'conveyance:engagement.issuance.stage.accepted',
  declined: 'conveyance:engagement.issuance.stage.declined',
  cancelled: 'conveyance:engagement.issuance.stage.cancelled',
};

/** Σε ποιον είναι η σειρά, από τη θέση του επαγγελματία — `professional` ⇒ «δική σας». */
export const PROFESSIONAL_BALL_KEYS: Readonly<Record<BallInCourtParty, string>> = {
  professional: 'conveyance:engagement.issuance.ball.professional',
  office: 'conveyance:engagement.issuance.ball.office',
  owner: 'conveyance:engagement.issuance.ball.owner',
};

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
