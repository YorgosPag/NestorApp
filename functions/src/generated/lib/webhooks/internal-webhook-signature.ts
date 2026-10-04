// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/lib/webhooks/internal-webhook-signature.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:9674bc7fc1a3483f03ecde0bee30b774a79928eb1656841500a2107d0f8acea4

/**
 * @fileoverview **ΥΠΟΓΡΑΦΗ ΕΣΩΤΕΡΙΚΟΥ WEBHOOK — ο ΕΝΑΣ πυρήνας, και για τις δύο άκρες** (ADR-905 §6).
 * @module lib/webhooks/internal-webhook-signature
 *
 * Το Cloud Function **υπογράφει**, το Next.js **επαληθεύει** — με **τον ίδιο** κώδικα: αυτό το αρχείο
 * προβάλλεται αυτούσιο στα Functions (ADR-874 · CHECK 3.93). Δύο γραφές του «τι είναι έγκυρη υπογραφή»
 * θα απέκλιναν στην πρώτη αλλαγή (το σχήμα του ADR-749) — και η απόκλιση εδώ δεν φαίνεται: απλώς
 * κάθε γεγονός απορρίπτεται σιωπηλά.
 *
 * 🔑 **Σχήμα (Stripe «Verify webhook signatures»)**: κεφαλίδα `t=<δευτερόλεπτα>,v1=<hex>[,v1=<hex>]`,
 * HMAC-SHA256 πάνω στο `${t}.${ωμό σώμα}`. Η χρονοσφραγίδα **υπογράφεται** (δεν αλλάζει χωρίς το κλειδί)
 * και κόβει την επανάληψη έξω από το παράθυρο· μέσα στο παράθυρο την κόβει το σύνορο ιδεμποτίας του
 * αποδέκτη (`Idempotency-Key` = ταυτότητα γεγονότος).
 *
 * 🔁 **Περιστροφή κλειδιού χωρίς διακοπή**: ο υπογραφέας μπορεί να βάλει **πολλά** `v1=` (παλιό + νέο
 * κλειδί) και ο κριτής δέχεται **οποιοδήποτε** ταιριάζει με **οποιοδήποτε** από τα κλειδιά του.
 *
 * ⚠️ **Ωμό σώμα, ποτέ ξανασειριοποιημένο JSON**: `JSON.stringify(JSON.parse(x))` δεν είναι πάντα `x`.
 *
 * **Layering**: leaf — μόνο `crypto`. Καμία `@/` εισαγωγή, κανένα `server-only` (θα έσπαγε την προβολή).
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Η κεφαλίδα της υπογραφής. */
export const INTERNAL_WEBHOOK_SIGNATURE_HEADER = 'X-Internal-Signature';

/** Πόσο απέχει η χρονοσφραγίδα από το «τώρα» του αποδέκτη (δευτερόλεπτα) — ίδιο με Stripe/Mailgun. */
export const INTERNAL_WEBHOOK_TOLERANCE_SECONDS = 300;

const SCHEME = 'v1';

export type InternalWebhookRefusal =
  | 'secret_missing'
  | 'signature_missing'
  | 'signature_malformed'
  | 'timestamp_expired'
  | 'signature_invalid';

export type InternalWebhookVerdict =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: InternalWebhookRefusal };

export interface InternalWebhookContext {
  /** Τα αποδεκτά κλειδιά — συνήθως ένα· δύο κατά την περιστροφή. Κενά αγνοούνται. */
  readonly secrets: readonly string[];
  readonly nowSeconds: number;
}

function digest(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** **Υπογραφή** — η τιμή της κεφαλίδας. Ένα `v1=` ανά κλειδί (περιστροφή). */
export function signInternalWebhook(secrets: readonly string[], body: string, nowSeconds: number): string {
  const usable = secrets.map((s) => s.trim()).filter((s) => s.length > 0);
  if (usable.length === 0) throw new Error('internal webhook: no signing secret');
  const t = Math.floor(nowSeconds);
  return [`t=${t}`, ...usable.map((s) => `${SCHEME}=${digest(s, t, body)}`)].join(',');
}

interface ParsedHeader {
  readonly timestamp: number;
  readonly signatures: readonly string[];
}

function parseHeader(header: string): ParsedHeader | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) return null;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = /^\d+$/.test(value) ? Number(value) : null;
    else if (key === SCHEME && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  return timestamp === null || signatures.length === 0 ? null : { timestamp, signatures };
}

function sameDigest(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

const refuse = (reason: InternalWebhookRefusal): InternalWebhookVerdict => ({ valid: false, reason });

/** **Η κρίση** — καθαρή: κλειδιά και «τώρα» περνιούνται. Καμία ανοχή χωρίς κλειδί, σε κανένα περιβάλλον. */
export function judgeInternalWebhook(
  header: string | null,
  body: string,
  context: InternalWebhookContext,
): InternalWebhookVerdict {
  const secrets = context.secrets.map((s) => s.trim()).filter((s) => s.length > 0);
  if (secrets.length === 0) return refuse('secret_missing');
  if (!header) return refuse('signature_missing');
  const parsed = parseHeader(header);
  if (!parsed) return refuse('signature_malformed');
  if (Math.abs(context.nowSeconds - parsed.timestamp) > INTERNAL_WEBHOOK_TOLERANCE_SECONDS) {
    return refuse('timestamp_expired');
  }
  const matches = secrets.some((secret) => {
    const expected = digest(secret, parsed.timestamp, body);
    return parsed.signatures.some((provided) => sameDigest(provided, expected));
  });
  return matches ? { valid: true } : refuse('signature_invalid');
}
