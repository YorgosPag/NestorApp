/**
 * @fileoverview ADR-915 §27 · §45 · §45.21 — τα **ονόματα πεδίων** του ιστορικού μιας ανάθεσης έκδοσης, ανά είδος.
 * @module lib/document-validity/issuance-audit-fields
 *
 * 🔑 **ΓΙΑΤΙ ΚΟΙΝΟ (ΟΧΙ `.server`) MODULE — ADR-195 (ζ), 2026-11-16.** Ο γραφέας (`issuance-assignment-audit.server.ts`)
 *    γράφει αυτά τα πεδία **απευθείας**, εκτός του μητρώου tracked πεδίων. Η γραμμή Ιστορικού (client) παράγει τα
 *    namespaces λεξιλογίου από δηλώσεις — και αυτή ήταν η δήλωση που **δεν έβλεπε**: το `document-registry` δεν φορτωνόταν
 *    ποτέ για το ακίνητο ⇒ σε el έβγαινε «— → declined». Η δήλωση ζει εδώ ώστε **και οι δύο** να διαβάζουν την ΙΔΙΑ.
 *
 * **Layering**: leaf — μόνο δεδομένα, μηδέν I/O.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';

/** Τα πεδία του ιστορικού **ενός** είδους (ονόματα στο `common-audit:audit.fields.*`). */
export interface IssuanceAuditFields {
  readonly stage: string;
  readonly professional: string;
  /** §28 — σε ποιον υπεύθυνο στάλθηκε σύνδεσμος έγκρισης (επαφή + όνομα της στιγμής). */
  readonly approvalRequest: string;
  /** §45 Φ2 — η προθεσμία παράδοσης (ISO ημέρα· ο αναγνώστης του ιστορικού τη μορφοποιεί ως ημερομηνία). */
  readonly deliveryDue: string;
  /** §45.15 — ο υπεύθυνος αυτοψίας (επαφή + όνομα της στιγμής) και η ιδιότητά του (κατάλογος `issuance.inspectionRole`). */
  readonly inspectionContact: string;
  readonly inspectionRole: string;
  /** §45.20 Φ6γ — το αίτημα αλλαγής προθεσμίας του μηχανικού: «— → ημέρα» όταν ζητείται · «ημέρα → —» όταν απαντηθεί. */
  readonly deliveryChangeRequest: string;
  /**
   * §45.20 Φ6γ — **η απάντηση** του γραφείου («— → έγινε δεκτό | απορρίφθηκε», κατάλογος `issuance.delivery.change.outcome`)
   * και, στην απόρριψη, η αιτιολογία του. Χωρίς αυτά αποδοχή και απόρριψη γράφονταν ΙΔΙΑ («ημέρα → —»).
   */
  readonly deliveryChangeAnswer: string;
  readonly deliveryChangeDeclineReason: string;
  /**
   * §39 · §45.21.2 — «Νέος σύνδεσμος εισόδου» στον χώρο της ανάθεσης: `— → invited:<email>` (κατάλογος
   * `issuance.space.auditValues` ⇒ «προσκλήθηκε · <email>»). Ανά είδος, όπως κάθε πεδίο της ανάθεσης· το παλιό ενιαίο
   * `issuanceSpaceInvitation` είναι αποσυρμένο (`config/audit-retired-fields.ts`).
   */
  readonly spaceInvitation: string;
  /**
   * ADR-942 Φ1 — **αίτημα εγγράφου** από τον μηχανικό: `— → <είδος του καταλόγου>` (κατάλογος
   * `issuance.documentRequest.items` ⇒ «Τίτλος ιδιοκτησίας»). Μία γραμμή ανά νέο αίτημα του ίδιου πατήματος.
   */
  readonly documentRequest: string;
  /**
   * ADR-942 Φ2 — **δόσιμο** αρχείου στον μηχανικό: `— → <είδος>` όταν δίνεται · `<είδος> → —` όταν ανακαλείται (κατάλογος
   * `issuance.documentRequest.items`)· `label` = το όνομα του αρχείου.
   */
  readonly documentProvision: string;
  /** ADR-942 Φ2 — **άνοιγμα** δοσμένου αρχείου από τον μηχανικό: `— → view | download` (κατάλογος `issuance.documentRequest.access`). */
  readonly documentAccess: string;
}

/**
 * Το πεδίο του ιστορικού ανά είδος — `null` για είδη αρχής (δεν ανατίθενται). Τα ονόματα ζουν στο
 * `common-audit:audit.fields.*` και οι τιμές καταλόγου στο `audit-value-catalogs.ts` (ns `document-registry`).
 */
export const ISSUANCE_AUDIT_FIELDS: Readonly<Record<DocumentKind, IssuanceAuditFields | null>> = {
  'energy-certificate': {
    stage: 'energyCertificateIssuanceStage', professional: 'energyCertificateIssuer', approvalRequest: 'energyCertificateIssuanceApprovalRequest',
    deliveryDue: 'energyCertificateIssuanceDeliveryDue',
    inspectionContact: 'energyCertificateIssuanceInspectionContact', inspectionRole: 'energyCertificateIssuanceInspectionRole',
    deliveryChangeRequest: 'energyCertificateIssuanceDeliveryChangeRequest',
    deliveryChangeAnswer: 'energyCertificateIssuanceDeliveryChangeAnswer',
    deliveryChangeDeclineReason: 'energyCertificateIssuanceDeliveryChangeDeclineReason',
    spaceInvitation: 'energyCertificateIssuanceSpaceInvitation',
    documentRequest: 'energyCertificateIssuanceDocumentRequest',
    documentProvision: 'energyCertificateIssuanceDocumentProvision',
    documentAccess: 'energyCertificateIssuanceDocumentAccess',
  },
  'building-identity': {
    stage: 'buildingIdentityIssuanceStage', professional: 'buildingIdentityIssuer', approvalRequest: 'buildingIdentityIssuanceApprovalRequest',
    deliveryDue: 'buildingIdentityIssuanceDeliveryDue',
    inspectionContact: 'buildingIdentityIssuanceInspectionContact', inspectionRole: 'buildingIdentityIssuanceInspectionRole',
    deliveryChangeRequest: 'buildingIdentityIssuanceDeliveryChangeRequest',
    deliveryChangeAnswer: 'buildingIdentityIssuanceDeliveryChangeAnswer',
    deliveryChangeDeclineReason: 'buildingIdentityIssuanceDeliveryChangeDeclineReason',
    spaceInvitation: 'buildingIdentityIssuanceSpaceInvitation',
    documentRequest: 'buildingIdentityIssuanceDocumentRequest',
    documentProvision: 'buildingIdentityIssuanceDocumentProvision',
    documentAccess: 'buildingIdentityIssuanceDocumentAccess',
  },
  'tax-clearance': null,
  'insurance-clearance': null,
  'enfia-certificate': null,
  'electrical-installation': {
    stage: 'electricalInstallationIssuanceStage',
    professional: 'electricalInstallationIssuer',
    approvalRequest: 'electricalInstallationIssuanceApprovalRequest',
    deliveryDue: 'electricalInstallationIssuanceDeliveryDue',
    inspectionContact: 'electricalInstallationIssuanceInspectionContact',
    inspectionRole: 'electricalInstallationIssuanceInspectionRole',
    deliveryChangeRequest: 'electricalInstallationIssuanceDeliveryChangeRequest',
    deliveryChangeAnswer: 'electricalInstallationIssuanceDeliveryChangeAnswer',
    deliveryChangeDeclineReason: 'electricalInstallationIssuanceDeliveryChangeDeclineReason',
    spaceInvitation: 'electricalInstallationIssuanceSpaceInvitation',
    documentRequest: 'electricalInstallationIssuanceDocumentRequest',
    documentProvision: 'electricalInstallationIssuanceDocumentProvision',
    documentAccess: 'electricalInstallationIssuanceDocumentAccess',
  },
};
