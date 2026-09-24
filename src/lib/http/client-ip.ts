/**
 * @fileoverview **«Από ποια διεύθυνση ήρθε το αίτημα;»** — μία απάντηση (ADR-777 §8.72 · N.0.2).
 * @module lib/http/client-ip
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΔΙΠΛΟΤΥΠΟ (2026-09-23):** η ίδια αλυσίδα
 * `x-forwarded-for` (πρώτο στοιχείο) → `x-real-ip` → `'unknown'` ήταν γραμμένη **τρεις** φορές
 * (`with-rate-limit.ts` · `vendor/quote/[token]/route.ts` · `property-share-validation.ts`) και
 * χρειαζόταν **τέταρτη** για τις προβολές αγγελίας. Εδώ ζει μία φορά.
 *
 * ⚠️ **Το ΠΡΩΤΟ στοιχείο του `x-forwarded-for`** είναι ο πελάτης· τα επόμενα είναι οι proxies που
 * πρόσθεσαν τον εαυτό τους. Ο reverse proxy του Netcup **αντικαθιστά** την κεφαλίδα, οπότε δεν
 * μπορεί να πλαστογραφηθεί από τον πελάτη — αλλά και αν μπορούσε, όλοι οι καταναλωτές τη
 * χρησιμοποιούν ως **φρουρό πόρου**, όχι ως ταυτότητα.
 *
 * ⛔ Το `audit-core.extractRequestMetadata` **δεν** μεταφέρθηκε, επίτηδες: καταγράφει την **ωμή**
 * αλυσίδα (όλους τους proxies) ως τεκμήριο — άλλη ερώτηση.
 */

import { createHash } from 'crypto';

/** Η διεύθυνση του πελάτη, ή `'unknown'` — **ποτέ** κενό (θα έκανε όλους τους ανώνυμους «ίδιους»). */
export function clientIpOf(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * **Αποτύπωμα** της διεύθυνσης — για αποθήκευση/κλειδί ορίου, **ποτέ** η ίδια η IP (ADR-876 §5 · N.0.2).
 *
 * 🔴 Ζούσε δύο φορές με **διαφορετική** συνταγή: το `with-rate-limit` με αλάτι (ιδιωτικό `hashIpAddress`),
 * η πύλη προμηθευτή **χωρίς** αλάτι — δηλαδή αντιστρέψιμη με πίνακα των ~4 δισ. IPv4 σε λίγα λεπτά.
 */
export function clientIpFingerprint(ip: string): string {
  const salt = process.env.RATE_LIMIT_IP_SALT || 'nestor-default-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').substring(0, 16);
}
