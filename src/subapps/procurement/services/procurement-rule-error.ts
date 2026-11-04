/**
 * Η **παραβίαση κανόνα** του πεδίου προμηθειών («δεν επιτρέπεται η αλλαγή σε αυτή την κατάσταση», «άκυρη μετάβαση»,
 * «η ποσότητα δεν αναπαρίσταται ακριβώς»): ένα μήνυμα **γραμμένο για τον άνθρωπο**, που φτάνει στον πελάτη ως 400.
 *
 * 🔑 Γιατί τύπος και όχι σκέτο `Error` (ADR-603 §Ασπίδα): το σύνορο HTTP πρέπει να ξεχωρίζει το «ο κανόνας λέει όχι»
 * (μήνυμα για τον πελάτη) από το «κάτι χάλασε» (Firestore/SDK/κώδικας — μήνυμα **μόνο** για το log). Με σκέτο `Error`
 * τα δύο είναι ίδια, και η μόνη ασφαλής απάντηση θα ήταν να κρυφτεί και το πρώτο.
 *
 * @module subapps/procurement/services/procurement-rule-error
 */

export class ProcurementRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcurementRuleError';
  }
}

/**
 * Το μήνυμα του «δεν βρέθηκε» της παραγγελίας — **ίδιο** με το `notFound('PO not found')` των routes, χωρίς id.
 * Η γνήσια απουσία και η άρνηση ιδιοκτησίας πρέπει να είναι αδιάκριτες στο σύρμα (ADR-742 · `resource-concealment-anchor`).
 */
export const PO_NOT_FOUND_MESSAGE = 'PO not found';

/** Η παραγγελία δεν υπάρχει. Τυποποιημένο ώστε το σύνορο να απαντά 404 χωρίς να διαβάζει κείμενο. */
export class PurchaseOrderNotFoundError extends Error {
  constructor() {
    super(PO_NOT_FOUND_MESSAGE);
    this.name = 'PurchaseOrderNotFoundError';
  }
}
