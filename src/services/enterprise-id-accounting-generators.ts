/**
 * ENTERPRISE ID — ΟΙ ΤΑΥΤΟΤΗΤΕΣ ΤΟΥ ΒΙΒΛΙΟΥ ΕΣΟΔΩΝ-ΕΞΟΔΩΝ (ADR-ACC-010 §2.1.1 Φάση 8)
 *
 * Νέος κρίκος της αλυσίδας (βλ. `enterprise-id-composite-key-generators.ts`) — όχι γραμμή στο
 * `enterprise-id-class.ts`, που βρίσκεται στο όριο των 500 γραμμών (N.7.1): **διάσπαση ανά τομέα**.
 *
 * ⚠️ Η μηχανή (`mintDeterministicV4Id`) μένει στην `EnterpriseIdService`· εδώ μόνο **ονοματοδοσία**.
 *
 * @module services/enterprise-id-accounting-generators
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { DocumentRegistryIdGenerators } from './enterprise-id-document-registry-generators';

const P = ENTERPRISE_ID_PREFIXES;

export abstract class AccountingIdGenerators extends DocumentRegistryIdGenerators {
  /**
   * ADR-ACC-010 §2.1.1 Φ8 — **ΕΝΑΣ** αντιλογισμός ανά αρχική εγγραφή (SAP FB08 · DATEV Generalumkehr): σπόρος
   * = id της αρχικής ⇒ διπλό κλικ, επανάληψη δικτύου ή δύο ταυτόχρονα αιτήματα βρίσκουν το **ίδιο** έγγραφο και
   * το `transaction.create` συγκρούεται — δεύτερο storno είναι **δομικά αδύνατο**. Πρόθεμα `je`: κανονική εγγραφή.
   */
  generateDeterministicJournalReversalEntryId(originalEntryId: string): string {
    return this.mintDeterministicV4Id(P.JOURNAL_ENTRY, `journal-reversal:${originalEntryId}`);
  }

  /**
   * ADR-ACC-030 — **ΜΙΑ** κίνηση πληρωμής ανά κίνηση του παρόχου: σπόρος = `πάροχος:είδος:αναγνωριστικό παρόχου`
   * ⇒ το ίδιο webhook δύο φορές, ή webhook + συμφιλίωση cron, βγάζουν το **ίδιο** `paymentId` και ο γραφέας
   * (`recordInvoicePayment`) το βρίσκει ήδη καταγεγραμμένο.
   */
  generateDeterministicInvoicePaymentId(seed: string): string {
    return this.mintDeterministicV4Id(P.INVOICE_PAYMENT, `invoice-payment:${seed}`);
  }

  /** ADR-ACC-030 — μία απόπειρα online πληρωμής από τον σύνδεσμο (κάρτα ή IRIS). */
  generatePaymentCheckoutId(): string {
    return this.generateId(P.PAYMENT_CHECKOUT).id;
  }

  /** ADR-ACC-030 — ένα συμβάν παρόχου, μία φορά: σπόρος = `πάροχος:φυσικό κλειδί συμβάντος`. */
  generateDeterministicPaymentProviderEventId(seed: string): string {
    return this.mintDeterministicV4Id(P.PAYMENT_PROVIDER_EVENT, `payment-provider-event:${seed}`);
  }

  /**
   * ADR-943 §5.7 — **ΕΝΑΣ** δικαιούχος marketplace ανά (πάροχος, χρήστης): σπόρος = `πάροχος:uid` ⇒ δύο ταυτόχρονες
   * εγγραφές του ίδιου μηχανικού βρίσκουν το **ίδιο** έγγραφο και η δεύτερη `create` συγκρούεται — δεύτερος πωλητής
   * στον πάροχο είναι δομικά αδύνατος από αυτή την πλευρά.
   */
  generateDeterministicPaymentPayeeId(seed: string): string {
    return this.mintDeterministicV4Id(P.PAYMENT_PAYEE, `payment-payee:${seed}`);
  }

  /** ADR-943 §5.9 — ο κάτοχος μιας μίσθωσης κρατημένης μεταφοράς: μοναδικός ανά καλούντα (webhook · cron · επιστροφή). */
  generatePaymentTransferLeaseHolderId(): string {
    return this.generateId(P.PAYMENT_TRANSFER_LEASE).id;
  }
}
