/**
 * @fileoverview Υπογραφές Everypay — καθαρές κρίσεις (ADR-ACC-030 §4)
 * @description Δύο μορφές, και οι δύο HMAC-SHA256 με το **secret key** του εμπόρου:
 *
 *   1. **Webhooks** (Notification paid/expired · Refund · New payment): κεφαλίδα `X-Signature-SHA256` =
 *      base64(**κείμενο hex** του HMAC-SHA256(ωμό σώμα)) — ο τύπος της τεκμηρίωσης είναι
 *      `base64_encode(hash_hmac('sha256', $payload, $secretKey))`, και το `hash_hmac` της PHP επιστρέφει **hex**
 *      (64 χαρακτήρες), όχι τα 32 bytes. Κρίνεται πάνω στο **ωμό** σώμα, πριν από κάθε ανάλυση.
 *      ⚠️ Μέχρι 2026-11-12 κρίναμε base64 των **bytes** ⇒ κάθε γνήσιο webhook `signature-invalid` (ADR §5.9 #3).
 *   2. **IRIS** (callback + webhook): πεδίο `hash` = base64(«υπογραφή|JSON»), με HMAC-SHA256 του JSON. Τα στοιχεία
 *      (`token`, `md`) διαβάζονται **από το υπογεγραμμένο JSON**, ποτέ από τα εξωτερικά πεδία — αλλιώς κάποιος θα
 *      κολλούσε έγκυρο hash πάνω σε άλλο token.
 *
 *   Η «υπογραφή» πριν από το `|` είναι **κείμενο hex** (64 χαρακτήρες) του HMAC — η τεκμηρίωση δίνει μόνο ψευδοκώδικα
 *   `Hmacsha256(json, sk)`, η μορφή **μετρήθηκε ζωντανά** 2026-11-14 (επιστροφή browser + webhook: `iris-hash-hex`,
 *   ADR-ACC-030 §5.8 #1). Μέχρι τότε δεχόμασταν και base64· πλέον **μόνο hex**. Άλλη μορφή ⇒ `signature-invalid`
 *   (ορατό `Payment webhook refused` στα logs), και η πληρωμή καλύπτεται από τη συμφιλίωση. Η υπογραφή είναι μόνο ο
 *   πρώτος φραγμός: χρήματα κινούνται μόνο όταν πετύχει το `POST /payments` με το **δικό μας** κλειδί.
 *
 *   Σύγκριση πάντα σταθερού χρόνου, μέσω του ΕΝΟΣ `equalsInConstantTime` (πάνω σε hex).
 *
 * @see https://docs.everypay.gr/tools/webhooks/ · https://docs.everypay.gr/other-payment-methods/iris-direct/
 */

import { createHmac } from 'crypto';

import { plainRecordOrNull } from '@/lib/type-guards';
import { equalsInConstantTime } from '@/lib/tokens/signed-token';

export const EVERYPAY_SIGNATURE_HEADER = 'x-signature-sha256';

export type EverypaySignatureRefusal = 'signature-missing' | 'signature-invalid' | 'payload-malformed';

/** Ποια μορφή υπογραφής ταίριαξε — διάγνωση για logs / ίχνος παραλαβής, ποτέ κριτήριο. */
export type EverypaySignatureScheme = 'webhook-header' | 'iris-hash-hex';

export type EverypaySignedPayload =
  | { readonly valid: true; readonly payload: Record<string, unknown>; readonly scheme: EverypaySignatureScheme }
  | { readonly valid: false; readonly reason: EverypaySignatureRefusal };

const HEX_SHA256 = /^[0-9a-f]{64}$/i;

function hmacHex(secretKey: string, text: string): string {
  return createHmac('sha256', secretKey).update(text, 'utf8').digest('hex');
}

/** Η υπογραφή IRIS (κείμενο hex, §5.8 #1) ταιριάζει με το αναμενόμενο HMAC; */
function irisSignatureMatches(provided: string, expectedHex: string): boolean {
  return HEX_SHA256.test(provided) && equalsInConstantTime(provided.toLowerCase(), expectedHex);
}

/** Κείμενο JSON ⇒ αντικείμενο, ή `null` (άκυρο JSON / όχι αντικείμενο). */
export function jsonObjectOrNull(text: string): Record<string, unknown> | null {
  try {
    return plainRecordOrNull(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Κεφαλίδα webhook ⇒ το κείμενο hex που κωδικοποιεί, ή `null` (δεν είναι base64 ενός HMAC-SHA256 σε hex). */
function base64HexDigestOrNull(value: string): string | null {
  const decoded = Buffer.from(value.trim(), 'base64').toString('utf8');
  return HEX_SHA256.test(decoded) ? decoded.toLowerCase() : null;
}

/** Webhook: υπογραφή κεφαλίδας (base64 του hex) πάνω στο ωμό σώμα ⇒ το σώμα ως αντικείμενο. */
export function judgeEverypayBodySignature(
  rawBody: string,
  signatureHeader: string | null,
  secretKey: string,
): EverypaySignedPayload {
  if (!signatureHeader?.trim()) return { valid: false, reason: 'signature-missing' };
  const expected = hmacHex(secretKey, rawBody);
  const provided = base64HexDigestOrNull(signatureHeader);
  if (provided === null || !equalsInConstantTime(provided, expected)) return { valid: false, reason: 'signature-invalid' };
  const payload = jsonObjectOrNull(rawBody);
  return payload === null ? { valid: false, reason: 'payload-malformed' } : { valid: true, payload, scheme: 'webhook-header' };
}

/** IRIS: το `hash` ⇒ το **υπογεγραμμένο** JSON (με `token`, `md`, …). */
export function judgeEverypayIrisHash(hash: string | null | undefined, secretKey: string): EverypaySignedPayload {
  if (!hash?.trim()) return { valid: false, reason: 'signature-missing' };
  const decoded = Buffer.from(hash.trim(), 'base64').toString('utf8');
  const separator = decoded.indexOf('|');
  if (separator <= 0) return { valid: false, reason: 'signature-invalid' };
  const signature = decoded.slice(0, separator);
  const signedJson = decoded.slice(separator + 1);
  if (!irisSignatureMatches(signature, hmacHex(secretKey, signedJson))) return { valid: false, reason: 'signature-invalid' };
  const payload = jsonObjectOrNull(signedJson);
  return payload === null ? { valid: false, reason: 'payload-malformed' } : { valid: true, payload, scheme: 'iris-hash-hex' };
}
