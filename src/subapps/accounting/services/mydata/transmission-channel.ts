/**
 * @fileoverview **Η πόρτα διαβίβασης** — ένα συμβόλαιο, δύο μελλοντικές υλοποιήσεις.
 * @module subapps/accounting/services/mydata/transmission-channel
 *
 * - `mydata_direct`: απευθείας στο REST API της ΑΑΔΕ (χρήστες ERP).
 * - `einvoicing_provider`: μέσω πιστοποιημένου Παρόχου Ηλεκτρονικής Τιμολόγησης.
 *
 * 🔴 **Γιατί δύο** (ADR-ACC-022 Α1): κατά την Α.1197/2026, από 01/02/2027 η έκδοση B2B τιμολογίων
 * διαβιβάζεται **μόνο** μέσω παρόχου ή εφαρμογών της ΑΑΔΕ — όχι πια από ERP. Η απευθείας σύνδεση
 * παραμένει για τα υπόλοιπα (λήψη, χαρακτηρισμοί). Το **περιεχόμενο** (`MyDataInvoicePayload`) είναι
 * κοινό· διαφέρει μόνο η μεταφορά.
 *
 * 🔑 **Ουδέτερη ως προς τον πάροχο**: κανένα όνομα παρόχου εδώ. Η επιλογή παρόχου είναι εμπορική
 * απόφαση (ADR-ACC-003 §20)· η υλοποίησή του θα είναι **ένα νέο αρχείο** που ικανοποιεί αυτό το interface.
 *
 * 🔑 **Ιδεμποτία**: κάθε κλήση φέρει κλειδί. Ίδιο κλειδί ⇒ ίδιο αποτέλεσμα, **ποτέ** δεύτερη διαβίβαση —
 * μια επανάληψη δικτύου δεν επιτρέπεται να γεννήσει δεύτερο ΜΑΡΚ για το ίδιο παραστατικό.
 *
 * Αντικαθιστά το `IMyDataService` (2026-02), που δεν το υλοποίησε ούτε το κάλεσε ποτέ κανείς.
 */

import type { MyDataInvoicePayload } from './mydata-payload.types';

export type InvoiceTransmissionChannelKind = 'mydata_direct' | 'einvoicing_provider';

/** Σφάλμα όπως το επιστρέφει η ΑΑΔΕ (ή ο πάροχος για λογαριασμό της). */
export interface TransmissionError {
  /** Κωδικός σφάλματος ΑΑΔΕ (π.χ. `238`) ή του παρόχου. */
  code: string;
  /** Το μήνυμα όπως ήρθε — για καταγραφή, **όχι** για εμφάνιση χωρίς μετάφραση. */
  message: string;
}

/** Επιτυχής καταχώριση: η ΑΑΔΕ απέδωσε ΜΑΡΚ. */
export interface TransmissionAccepted {
  status: 'accepted';
  mark: string;
  uid: string | null;
  authenticationCode: string | null;
  /** URL για το QR του παραστατικού (υποχρεωτικό στην έκδοση μέσω παρόχου). */
  qrCodeUrl: string | null;
}

/** Οριστική απόρριψη: το παραστατικό χρειάζεται διόρθωση πριν ξανασταλεί. */
export interface TransmissionRejected {
  status: 'rejected';
  errors: readonly TransmissionError[];
}

/**
 * Προσωρινή αποτυχία (δίκτυο, 5xx, όριο κλήσεων): **άγνωστο** αν καταχωρίστηκε.
 * Επανάληψη μόνο με το **ίδιο** κλειδί ιδεμποτίας.
 */
export interface TransmissionUnavailable {
  status: 'unavailable';
  retryable: true;
  reason: string;
}

export type TransmissionOutcome = TransmissionAccepted | TransmissionRejected | TransmissionUnavailable;

/** Αποτέλεσμα ακύρωσης παραστατικού (CancelInvoice). */
export type CancellationOutcome =
  | { status: 'cancelled'; cancellationMark: string }
  | TransmissionRejected
  | TransmissionUnavailable;

export interface InvoiceTransmissionChannel {
  readonly kind: InvoiceTransmissionChannelKind;
  /** Διαβίβαση παραστατικού. */
  submit(payload: MyDataInvoicePayload, idempotencyKey: string): Promise<TransmissionOutcome>;
  /** Ακύρωση ήδη καταχωρισμένου παραστατικού με τον ΜΑΡΚ του. */
  cancel(mark: string, idempotencyKey: string): Promise<CancellationOutcome>;
}
