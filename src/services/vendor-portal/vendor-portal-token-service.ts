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

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
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

function getSigningSecret(): string {
  const secret = process.env.VENDOR_PORTAL_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'VENDOR_PORTAL_SECRET environment variable is required for vendor portal token operations',
    );
  }
  return secret;
}

function computeHmac(payload: string): string {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const padded = input + '==='.slice(0, (4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

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
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const payload = `${rfqId}:${vendorContactId}:${nonce}:${expiresAt}`;
  const hmac = computeHmac(payload);
  const token = toBase64Url(`${payload}:${hmac}`);
  return { token, rfqId, vendorContactId, nonce, expiresAt };
}

// =============================================================================
// VALIDATE
// =============================================================================

function invalid(reason: VendorPortalTokenInvalidReason): VendorPortalTokenValidation {
  return { valid: false, reason };
}

/**
 * Validate token signature + expiry. Does NOT touch Firestore.
 * Cheap path so malformed/forged tokens are rejected without DB hits.
 */
export function validateVendorPortalTokenSignature(
  tokenString: string,
): VendorPortalTokenValidation {
  let decoded: string;
  try {
    decoded = fromBase64Url(tokenString);
  } catch {
    return invalid('malformed_token');
  }

  const parts = decoded.split(':');
  if (parts.length !== 5) return invalid('invalid_format');

  const [rfqId, vendorContactId, nonce, expiresAt, hmac] = parts;
  if (!rfqId || !vendorContactId || !nonce || !expiresAt || !hmac) {
    return invalid('invalid_format');
  }

  const payload = `${rfqId}:${vendorContactId}:${nonce}:${expiresAt}`;
  let expectedHmac: string;
  try {
    expectedHmac = computeHmac(payload);
  } catch {
    return invalid('server_config_error');
  }

  if (hmac.length !== expectedHmac.length) return invalid('invalid_signature');
  const hmacBuffer = Buffer.from(hmac, 'hex');
  const expectedBuffer = Buffer.from(expectedHmac, 'hex');
  if (hmacBuffer.length !== expectedBuffer.length) return invalid('invalid_signature');
  if (!timingSafeEqual(hmacBuffer, expectedBuffer)) return invalid('invalid_signature');

  if (new Date() > new Date(expiresAt)) return invalid('token_expired');

  return { valid: true, payload: { rfqId, vendorContactId, nonce, expiresAt } };
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
