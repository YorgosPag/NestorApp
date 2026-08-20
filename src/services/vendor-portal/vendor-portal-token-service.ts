/**
 * =============================================================================
 * Vendor Portal Token Service — HMAC-SHA256 Tokenized Vendor Quote Submission
 * =============================================================================
 *
 * Generates and validates short-lived, single-use HMAC-signed tokens that
 * authorize a vendor (without Firebase auth) to submit a quote for an RFQ via
 * the public `/vendor/quote/[token]` page.
 *
 * Token format: base64url({rfqId}:{vendorContactId}:{nonce}:{expiry}:{hmac})
 *
 * Security:
 * - HMAC-SHA256 signing with VENDOR_PORTAL_SECRET env var (server-only)
 * - Timing-safe HMAC comparison
 * - Configurable expiry per RFQ (default 7 days)
 * - Single-use enforcement via nonce blacklist in Firestore
 * - HMAC validated BEFORE any Firestore lookup (no DB hit on bad tokens)
 *
 * Mirrors the pattern of `qr-token-service.ts` (ADR-170).
 *
 * @module services/vendor-portal/vendor-portal-token-service
 * @enterprise ADR-327 §7 Vendor Portal — Phase 3
 */

import 'server-only';

import type { SignedTokenRejection } from '@/lib/tokens/signed-token';
import {
  decodeSignedToken,
  encodeSignedToken,
  newTokenNonce,
  requireTokenSecret,
} from '@/lib/tokens/signed-token';
import type { Timestamp as ClientTimestamp } from 'firebase/firestore';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

/**
 * Cast an Admin SDK `Timestamp.now()` to the client `Timestamp` type that
 * SSoT entity contracts (`Quote`, `VendorInvite`, etc.) declare.
 *
 * The two implementations are structurally compatible at runtime — only the
 * `toJSON` accessor differs in TS shape — so a structural cast is safe and
 * avoids polluting every assignment with `as unknown as Timestamp`.
 */
export function adminTimestampAsClient(
  ts: admin.firestore.Timestamp = admin.firestore.Timestamp.now(),
): ClientTimestamp {
  return ts as unknown as ClientTimestamp;
}

export function adminTimestampFromDateAsClient(date: Date): ClientTimestamp {
  return admin.firestore.Timestamp.fromDate(date) as unknown as ClientTimestamp;
}
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('VENDOR_PORTAL_TOKEN_SERVICE');

const DEFAULT_EXPIRY_DAYS = 7;

// =============================================================================
// SECRET / ENCODING
// =============================================================================

/**
 * 🔑 **§8.33 — Η ΓΡΑΜΜΑΤΙΚΗ ΤΟΥ ΣΥΝΔΕΣΜΟΥ ΕΦΥΓΕ ΣΕ SSoT** (`lib/tokens/signed-token`).
 *
 * Εδώ ζούσαν τέσσερις βοηθητικές (`getSigningSecret` · `computeHmac` · `toBase64Url` ·
 * `fromBase64Url`) **πανομοιότυπες** με του `qr-token-service.ts` — και η κεφαλίδα
 * αυτού του αρχείου το παραδεχόταν γραπτά (*«Mirrors the pattern of…»*). Όταν η
 * εντολή του μεσίτη χρειάστηκε **το ίδιο**, η τρίτη αντιγραφή θα ήταν το σχήμα του
 * ADR-749. Η **πολιτική** (7 μέρες · μία χρήση · ανάκληση) μένει εδώ, γιατί είναι
 * πραγματικά δική της.
 */
const SECRET_ENV = 'VENDOR_PORTAL_SECRET';

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratedVendorPortalToken {
  token: string;
  rfqId: string;
  vendorContactId: string;
  nonce: string;
  expiresAt: string;
}

export interface VendorPortalTokenPayload {
  rfqId: string;
  vendorContactId: string;
  nonce: string;
  expiresAt: string;
}

export type VendorPortalTokenInvalidReason =
  | 'malformed_token'
  | 'invalid_format'
  | 'invalid_signature'
  | 'server_config_error'
  | 'token_expired'
  | 'token_revoked'
  | 'token_already_used';

export type VendorPortalTokenValidation =
  | { valid: true; payload: VendorPortalTokenPayload }
  | { valid: false; reason: VendorPortalTokenInvalidReason };

// =============================================================================
// GENERATE
// =============================================================================

/**
 * Generate a new vendor portal token. Does NOT register the nonce — the caller
 * (`vendor-invite-service`) persists the invite + nonce alongside the token.
 */
export function generateVendorPortalToken(
  rfqId: string,
  vendorContactId: string,
  expiresInDays: number = DEFAULT_EXPIRY_DAYS,
): GeneratedVendorPortalToken {
  const nonce = newTokenNonce();
  const expiresAtMs = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const token = encodeSignedToken(requireTokenSecret(SECRET_ENV), [
    rfqId,
    vendorContactId,
    nonce,
    // 🔴 **ΧΙΛΙΟΣΤΑ, ΟΧΙ ISO — ΚΑΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ ΖΩΝΤΑΝΟΥ ΕΛΑΤΤΩΜΑΤΟΣ (§8.33).**
    //
    // Ο σύνδεσμος κουβαλούσε `2026-08-27T00:00:00.000Z`, δηλαδή **δύο άνω-κάτω
    // τελείες** — τον ίδιο χαρακτήρα που χωρίζει τα πεδία. Ο επαληθευτής έσπαγε το
    // κείμενο σε **7** τμήματα και απαιτούσε **ακριβώς 5** ⇒ `invalid_format` για
    // ΚΑΘΕ σύνδεσμο, πάντα, από την πρώτη μέρα. Κανένας προμηθευτής δεν μπορούσε
    // ποτέ να υποβάλει προσφορά μέσω συνδέσμου.
    //
    // ⚠️ Δεν το έπιασε καμία δοκιμή γιατί **καμία δεν εκτελούσε τον κύκλο
    // γέννηση→επαλήθευση**. Το βρήκε η εξαγωγή του SSoT, όταν το
    // `encodeSignedToken` **αρνήθηκε** να υπογράψει διφορούμενο πεδίο.
    //
    // ⚠️ Το `expiresAt` σε ISO **δεν χάνεται**: επιστρέφεται κανονικά παρακάτω και
    // γράφεται στο έγγραφο της πρόσκλησης. Ο ΣΥΝΔΕΣΜΟΣ κουβαλά αριθμό.
    String(expiresAtMs),
  ]);
  return {
    token,
    rfqId,
    vendorContactId,
    nonce,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

// =============================================================================
// VALIDATE
// =============================================================================

function invalid(reason: VendorPortalTokenInvalidReason): VendorPortalTokenValidation {
  return { valid: false, reason };
}

/**
 * Οι ονομασμένοι λόγοι του SSoT → το **υπάρχον** λεξιλόγιο αυτής της πύλης.
 *
 * ⚠️ Ρητή χαρτογράφηση και όχι κοινό λεξιλόγιο: οι λόγοι αυτής της πύλης ταξιδεύουν
 * ήδη σε οθόνη προμηθευτή και σε δοκιμές. Μια «ενοποίηση ονομάτων» εδώ θα άλλαζε
 * συμβόλαιο που κανείς δεν ζήτησε να αλλάξει.
 */
const REJECTION_REASON: Record<SignedTokenRejection, VendorPortalTokenInvalidReason> = {
  malformed: 'malformed_token',
  'invalid-format': 'invalid_format',
  'invalid-signature': 'invalid_signature',
  'server-config': 'server_config_error',
};

/**
 * Validate token signature + expiry. Does NOT touch Firestore.
 * Cheap path so malformed/forged tokens are rejected without DB hits.
 */
export function validateVendorPortalTokenSignature(
  tokenString: string,
): VendorPortalTokenValidation {
  let secret: string;
  try {
    secret = requireTokenSecret(SECRET_ENV);
  } catch {
    return invalid('server_config_error');
  }

  const verdict = decodeSignedToken(secret, tokenString, 4);
  if (!verdict.ok) return invalid(REJECTION_REASON[verdict.reason]);

  // ⚠️ Ακριβώς 4 πεδία: το SSoT εγγυάται «τουλάχιστον», η **πολιτική** αυτής της πύλης
  // είναι «ούτε ένα παραπάνω» — ένα πέμπτο πεδίο σημαίνει ότι κάποιος άλλαξε τη μορφή
  // του συνδέσμου και αυτός ο κώδικας δεν το έμαθε.
  if (verdict.fields.length !== 4) return invalid('invalid_format');
  const [rfqId, vendorContactId, nonce, expiresAtMs] = verdict.fields as [
    string,
    string,
    string,
    string,
  ];

  const expiryMs = Number(expiresAtMs);
  if (!Number.isFinite(expiryMs)) return invalid('invalid_format');
  if (Date.now() > expiryMs) return invalid('token_expired');

  return {
    valid: true,
    payload: {
      rfqId,
      vendorContactId,
      nonce,
      expiresAt: new Date(expiryMs).toISOString(),
    },
  };
}

/**
 * Full validation — signature + Firestore nonce blacklist check.
 *
 * If `markUsed === true`, the nonce is registered atomically; subsequent
 * calls return `token_already_used`. Used by single-use writes (POST submit).
 *
 * For repeated reads (vendor reopens link in 3-day edit window) call with
 * `markUsed: false`.
 */
export async function validateVendorPortalToken(
  tokenString: string,
  options: { markUsed?: boolean } = {},
): Promise<VendorPortalTokenValidation> {
  const sig = validateVendorPortalTokenSignature(tokenString);
  if (!sig.valid) return sig;

  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.VENDOR_INVITE_TOKENS).doc(sig.payload.nonce);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        const data = snap.data() as { revoked?: boolean; usedAt?: string | null };
        if (data.revoked) return invalid('token_revoked');
        if (data.usedAt) return invalid('token_already_used');
      }

      if (options.markUsed) {
        tx.set(
          ref,
          {
            rfqId: sig.payload.rfqId,
            vendorContactId: sig.payload.vendorContactId,
            nonce: sig.payload.nonce,
            expiresAt: sig.payload.expiresAt,
            usedAt: nowISO(),
            revoked: false,
            _createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      return { valid: true as const, payload: sig.payload };
    });

    return result;
  } catch (err) {
    logger.error('Vendor portal token validation failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return invalid('server_config_error');
  }
}

// =============================================================================
// REVOKE
// =============================================================================

/**
 * Revoke a token before its natural expiry (e.g. PM withdraws RFQ invite).
 * Idempotent.
 */
export async function revokeVendorPortalToken(nonce: string, revokedBy: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(COLLECTIONS.VENDOR_INVITE_TOKENS).doc(nonce).set(
    {
      nonce,
      revoked: true,
      revokedAt: nowISO(),
      revokedBy,
      _updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  logger.info('Vendor portal token revoked', { nonce, revokedBy });
}
