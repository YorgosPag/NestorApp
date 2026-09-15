/**
 * @fileoverview **Η ΔΙΕΞΟΔΟΣ ΜΙΑΣ ΑΡΝΗΣΗΣ** — σύνδεσμος + ετικέτα (σχήμα P2B άρθρο 4: λόγος **και** δυνατότητα διόρθωσης).
 * @related components/mandate/mandate-request-form-labels.ts · components/contact/first-contact-labels.ts
 * @module types/rejection-remedy
 *
 * 🔑 **ΕΝΑΣ ορισμός, δύο πίνακες** (`REJECTION_REMEDY` εντολής και πρώτης επαφής) — ήταν γραμμένος **δύο φορές**,
 * ταυτόσημα (ADR-841 §7 Α23 Φ3.3, N.0.2). Ο σύνδεσμος είναι **σταθερά** διαδρομής, ποτέ κείμενο.
 */

export interface RejectionRemedy {
  readonly href: string;
  readonly labelKey: string;
}
