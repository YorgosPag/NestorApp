/**
 * @module server/ownership/tax-id-protection
 * @description **Ο ΑΦΜ δεν αποθηκεύεται ποτέ στην επαλήθευση κατοχής** (ADR-900 §3.8) — μόνο HMAC + 3 ψηφία.
 *
 * Η επαλήθευση χρειάζεται **σύγκριση** (ΑΦΜ λογαριασμού = ΑΦΜ δικαιούχου ΠΚΑ) και **μοναδικότητα** (ένας ΑΦΜ
 * = ένας λογαριασμός) — όχι τον αριθμό. Άρα κρατά αποτύπωμα (ελαχιστοποίηση, GDPR 5§1γ).
 *
 * 🔴 **HMAC, ΠΟΤΕ σκέτο sha256.** Ο χώρος των ΑΦΜ είναι ~10⁸ με ψηφίο ελέγχου: ένα σκέτο hash σπάει
 * εξαντλητικά σε λεπτά. Με HMAC ο επιτιθέμενος χρειάζεται **και** το μυστικό του διακομιστή, που δεν ζει
 * στη βάση — ίδιο σκεπτικό με τον κωδικό της πρώτης επαφής (`first-contact-invitation.service.ts`).
 *
 * ⚠️ Το μυστικό **δεν** αλλάζει χωρίς μετανάστευση: άλλο μυστικό ⇒ άλλο HMAC ⇒ οι κλειδαριές ΑΦΜ
 * (`txic_*`) παύουν να συγκρούονται. Χωρίς μυστικό ⇒ **ρίχνει** (fail-closed· η διαδρομή απαντά 503).
 */

import 'server-only';

import { createHmac } from 'crypto';

import { requireTokenSecret } from '@/lib/tokens/signed-token';
import { normalizeVat } from '@/lib/validation/greek-vat-number';
import type { ProtectedTaxId } from '@/types/ownership-verification';

const SECRET_ENV = 'OWNERSHIP_TAX_ID_HMAC_SECRET';

/** Το αποτύπωμα ενός ΑΦΜ — ίδιος αριθμός (σε οποιαδήποτε γραφή) ⇒ ίδιο αποτύπωμα. */
export function taxIdHmac(taxId: string): string {
  return createHmac('sha256', requireTokenSecret(SECRET_ENV)).update(normalizeVat(taxId)).digest('hex');
}

/** HMAC + τα 3 τελευταία ψηφία (για τον άνθρωπο της ουράς: «…709»). */
export function protectTaxId(taxId: string): ProtectedTaxId {
  const normalized = normalizeVat(taxId);
  return { hmac: taxIdHmac(normalized), last3: normalized.slice(-3) };
}
