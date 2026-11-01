/**
 * @fileoverview **Αποτύπωμα ΑΦΜ επιχείρησης για την επιβεβαίωση προμηθευτή** (ADR-923 §5.13 Ε1β).
 * @module server/catalog/supplier-tax-fingerprint.server
 *
 * Η ετυμηγορία ΑΦΜ ↔ Αρ. ΓΕΜΗ δένεται με το ΑΦΜ που κρίθηκε. Αλλάζει το ΑΦΜ στο προφίλ, το αποτύπωμα διαφέρει και
 * η ετυμηγορία πέφτει στην επόμενη ανάγνωση, χωρίς κανέναν γραφέα να πρέπει να το θυμηθεί.
 *
 * 🔴 **HMAC, ποτέ σκέτο sha256**: ο χώρος των ΑΦΜ σπάει εξαντλητικά σε λεπτά (ίδιο σκεπτικό με το ADR-900 §3.8).
 * 🔒 **Δικό του μυστικό, χωριστό από το `OWNERSHIP_TAX_ID_HMAC_SECRET`**: τα δύο αποτυπώματα δεν ενώνονται μεταξύ τους.
 * Χωρίς μυστικό ρίχνει (fail-closed), και η πράξη απαντά ότι δεν είναι διαθέσιμη.
 */

import 'server-only';

import { createHmac } from 'crypto';

import { requireTokenSecret } from '@/lib/tokens/signed-token';
import { normalizeVat } from '@/lib/validation/greek-vat-number';

const SECRET_ENV = 'SUPPLIER_TAX_FINGERPRINT_HMAC_SECRET';

/** Ίδιος αριθμός, σε οποιαδήποτε γραφή ⇒ ίδιο αποτύπωμα. */
export function supplierTaxFingerprint(taxId: string): string {
  return createHmac('sha256', requireTokenSecret(SECRET_ENV)).update(normalizeVat(taxId)).digest('hex');
}
