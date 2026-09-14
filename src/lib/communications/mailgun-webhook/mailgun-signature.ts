/**
 * @fileoverview **ΥΠΟΓΡΑΦΗ WEBHOOK MAILGUN — SSoT** (ADR-841 §7 Α21.20 · ADR-071 · ADR-252 SV-M1).
 * @related lib/communications/meta-webhook/meta-signature.ts (το αδελφό πρότυπο, ADR-586) ·
 *   app/api/communications/webhooks/mailgun/inbound/route.ts · app/api/communications/webhooks/mailgun/events/route.ts
 * @module lib/communications/mailgun-webhook/mailgun-signature
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΞΗΧΘΗ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΧΡΕΙΑΣΤΗΚΕ ΔΕΥΤΕΡΗ ΦΟΡΑ (N.0.2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ζούσε **ιδιωτική** μέσα στο inbound route — μη εξαγόμενη, άρα **αδοκίμαστη** (καμία σουίτα).
 * Τα συμβάντα παράδοσης (bounce · complaint) υπογράφονται με **το ίδιο** κλειδί και τον **ίδιο**
 * αλγόριθμο. Δεύτερο αντίγραφο θα ήταν δεύτερη ευκαιρία να ξεχαστεί το `timingSafeEqual` ή το
 * παράθυρο χρόνου.
 *
 * 🔑 **Αλγόριθμος (Mailgun, «Securing Webhooks»)**: HMAC-SHA256 με το **HTTP webhook signing key**
 * (≠ API key) πάνω στο `timestamp + token`, δεκαεξαδικό, σύγκριση σταθερού χρόνου.
 *
 * ⚠️ **Χωρίς κλειδί**: σε staging/production (`requireWebhookSecrets`) ⇒ **άρνηση**· σε development/test
 * ⇒ περνά **ανεπιβεβαίωτο** (`verified: false`), ώστε ο καλών να το ξέρει — ποτέ σιωπηλό «έγκυρο».
 *
 * ⚠️ **Επανάληψη μέσα στο παράθυρο**: η υπογραφή μόνη της δεν την αποκλείει. Τα συμβάντα παράδοσης
 * είναι **ιδεμποτενή** κατά κατασκευή (κλειδί = ταυτότητα συμβάντος), οπότε μια επανάληψη δεν αλλάζει τίποτα.
 */

import { createHmac, timingSafeEqual } from 'crypto';

import { getCurrentSecurityPolicy } from '@/config/environment-security-config';

/** Το όνομα της ρύθμισης — literal, ώστε το `environment-contract` (Σ2) να βλέπει τον καταναλωτή. */
export const MAILGUN_WEBHOOK_SIGNING_KEY_ENV = 'MAILGUN_WEBHOOK_SIGNING_KEY';

/** Πόσο παλιά χρονοσφραγίδα δεχόμαστε (δευτερόλεπτα). Ο Mailgun υπογράφει **κάθε** προσπάθεια εκ νέου. */
export const MAILGUN_WEBHOOK_MAX_AGE_SECONDS = 300;

export interface MailgunSignatureFields {
  readonly timestamp?: string;
  readonly token?: string;
  readonly signature?: string;
}

export type MailgunSignatureRefusal =
  | 'webhook_secret_missing'
  | 'signature_fields_missing'
  | 'timestamp_expired'
  | 'signature_invalid';

export type MailgunSignatureVerdict =
  /** `verified: false` = δεν υπάρχει κλειδί και η πολιτική το ανέχεται (μόνο development/test). */
  | { readonly valid: true; readonly verified: boolean }
  | { readonly valid: false; readonly reason: MailgunSignatureRefusal };

export interface MailgunSignatureContext {
  readonly signingKey: string | undefined;
  readonly requireSecret: boolean;
  readonly nowSeconds: number;
}

const refuse = (reason: MailgunSignatureRefusal): MailgunSignatureVerdict => ({ valid: false, reason });

function sameDigest(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** **Η κρίση** — καθαρή: κλειδί, πολιτική και «τώρα» περνιούνται. */
export function judgeMailgunSignature(
  fields: MailgunSignatureFields,
  context: MailgunSignatureContext,
): MailgunSignatureVerdict {
  const signingKey = context.signingKey?.trim();
  if (!signingKey) return context.requireSecret ? refuse('webhook_secret_missing') : { valid: true, verified: false };

  const { timestamp, token, signature } = fields;
  if (!timestamp || !token || !signature) return refuse('signature_fields_missing');
  if (!/^\d+$/.test(timestamp)) return refuse('timestamp_expired');
  if (Math.abs(context.nowSeconds - Number(timestamp)) > MAILGUN_WEBHOOK_MAX_AGE_SECONDS) {
    return refuse('timestamp_expired');
  }

  const expected = createHmac('sha256', signingKey).update(timestamp + token).digest('hex');
  return sameDigest(signature, expected) ? { valid: true, verified: true } : refuse('signature_invalid');
}

/** **Η πύλη των routes** — διαβάζει κλειδί, πολιτική περιβάλλοντος και ρολόι τη στιγμή της κλήσης. */
export function verifyMailgunSignature(fields: MailgunSignatureFields): MailgunSignatureVerdict {
  return judgeMailgunSignature(fields, {
    signingKey: process.env[MAILGUN_WEBHOOK_SIGNING_KEY_ENV],
    requireSecret: getCurrentSecurityPolicy().requireWebhookSecrets,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
}

/** Υπάρχει ρυθμισμένο κλειδί; — για διαγνωστικά, ποτέ η τιμή. */
export function hasMailgunSigningKey(): boolean {
  return Boolean(process.env[MAILGUN_WEBHOOK_SIGNING_KEY_ENV]?.trim());
}
