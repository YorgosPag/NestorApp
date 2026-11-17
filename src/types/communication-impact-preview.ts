/**
 * Το συμβόλαιο του `POST /api/contacts/[contactId]/communication-impact-preview` — ΕΝΑ σημείο για server και πελάτη.
 *
 * @module types/communication-impact-preview
 * @enterprise ADR-280 (επιπτώσεις επικοινωνίας) · ADR-944 §3.7 (άγκυρα ταυτότητας)
 */

/** Σώμα αιτήματος: τα κλειδιά email (SSoT `emailKeyOf`) που αφαιρεί η φόρμα. */
export interface CommunicationImpactPreviewRequest {
  readonly removedEmailKeys: ReadonlyArray<string>;
}

export interface CommunicationImpactPreview {
  readonly totalAffected: number;
  readonly properties: number;
  readonly paymentPlans: number;
  readonly projects: number;
  readonly communications: number;
  readonly invoices: number;
  readonly apyCertificates: number;
  /**
   * Υποσύνολο των `removedEmailKeys` **του αιτήματος** που είναι email αποδεκτού λογαριασμού της επαφής.
   * Μη κενό ⇒ η αποθήκευση μπλοκάρεται (η επόμενη αποδοχή θα έφτιαχνε δεύτερη επαφή). Ποτέ δεν περιέχει κάτι
   * που ο πελάτης δεν έστειλε — το email του λογαριασμού δεν φεύγει από τον server (ADR-915 §40.8).
   */
  readonly anchoredEmailKeys: ReadonlyArray<string>;
}
