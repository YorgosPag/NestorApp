/**
 * =============================================================================
 * QR Token Service — HMAC-SHA256 Token Generation, Validation & Revocation
 * =============================================================================
 *
 * Generates daily QR tokens for construction site attendance check-in.
 * Tokens are cryptographically signed to prevent forgery and rotate daily.
 *
 * Security:
 * - HMAC-SHA256 signing with ATTENDANCE_QR_SECRET env var
 * - Token format: base64url({projectId}:{date}:{nonce}:{hmac})
 * - Daily expiration (23:59:59 of the valid date)
 * - Server-validated only (no client-side verification)
 * - Revocable by admin
 *
 * @module services/attendance/qr-token-service
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import 'server-only';

import { createHmac, randomBytes } from 'crypto';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { AttendanceQrToken, QrTokenStatus } from '@/components/projects/ika/contracts';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createModuleLogger('QR_TOKEN_SERVICE');

// =============================================================================
// TOKEN GENERATION
// =============================================================================

/**
 * Get the HMAC signing secret from environment.
 * @throws Error if ATTENDANCE_QR_SECRET is not configured
 */
function getSigningSecret(): string {
  const secret = process.env.ATTENDANCE_QR_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'ATTENDANCE_QR_SECRET environment variable is required for QR token generation'
    );
  }
  return secret;
}

/**
 * Compute HMAC-SHA256 signature for token payload.
 */
function computeHmac(payload: string): string {
  const secret = getSigningSecret();
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Encode a token payload to base64url (URL-safe base64).
 */
function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a base64url string.
 */
function fromBase64Url(input: string): string {
  const padded = input + '==='.slice(0, (4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/**
 * Get the end-of-day ISO string for a given date (23:59:59.999 UTC).
 */
function getEndOfDay(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

/**
 * Generate a new daily QR token for a project.
 *
 * If a valid token already exists for this project+date, it returns the existing one.
 * Otherwise creates a new one.
 *
 * @param projectId - The project to generate token for
 * @param date - Date string (YYYY-MM-DD), defaults to today
 * @param generatedBy - User ID of the admin generating the token
 * @returns The generated or existing QR token document
 */
export async function generateDailyQrToken(
  projectId: string,
  date: string,
  generatedBy: string
): Promise<AttendanceQrToken> {
  const db = getAdminFirestore();
  const collection = db.collection(COLLECTIONS.ATTENDANCE_QR_TOKENS);

  // Check for existing active token for this project+date
  const existing = await collection
    .where('projectId', '==', projectId)
    .where('validDate', '==', date)
    .where('status', '==', 'active' satisfies QrTokenStatus)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    logger.info('Reusing existing QR token', { projectId, date, tokenId: doc.id });
    return { id: doc.id, ...doc.data() } as AttendanceQrToken;
  }

  // Generate new token
  const nonce = randomBytes(16).toString('hex');
  const payload = `${projectId}:${date}:${nonce}`;
  const hmac = computeHmac(payload);
  const token = toBase64Url(`${payload}:${hmac}`);
  const now = new Date().toISOString();
  const expiresAt = getEndOfDay(date);

  const tokenData: Omit<AttendanceQrToken, 'id'> = {
    projectId,
    validDate: date,
    token,
    status: 'active',
    expiresAt,
    generatedBy,
    generatedAt: now,
    revokedAt: null,
    revokedBy: null,
  };

  const docRef = await collection.add({
    ...tokenData,
    _createdAt: FieldValue.serverTimestamp(),
  });

  logger.info('Generated new QR token', { projectId, date, tokenId: docRef.id });

  return { id: docRef.id, ...tokenData };
}

// =============================================================================
// TOKEN VALIDATION
// =============================================================================

/** Validation result for a QR token */
export interface QrTokenValidationResult {
  valid: boolean;
  projectId: string | null;
  validDate: string | null;
  tokenId: string | null;
  reason: string | null;
}

/**
 * Validate a QR token string.
 *
 * Verification steps:
 * 1. Decode base64url
 * 2. Parse token format (projectId:date:nonce:hmac)
 * 3. Recompute HMAC and verify signature
 * 4. Check Firestore for token document (active, not expired, not revoked)
 *
 * @param tokenString - The base64url-encoded token from QR scan
 * @returns Validation result
 */
export async function validateQrToken(tokenString: string): Promise<QrTokenValidationResult> {
  const invalid = (reason: string): QrTokenValidationResult => ({
    valid: false,
    projectId: null,
    validDate: null,
    tokenId: null,
    reason,
  });

  // Step 1: Decode
  let decoded: string;
  try {
    decoded = fromBase64Url(tokenString);
  } catch {
    return invalid('malformed_token');
  }

  // Step 2: Parse format — projectId:date:nonce:hmac
  const parts = decoded.split(':');
  if (parts.length < 4) {
    return invalid('invalid_format');
  }

  // Reconstruct parts (projectId may contain colons if it's a Firebase doc ID, but unlikely)
  const hmac = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(':');
  const projectId = parts[0];
  const date = parts[1];

  // Step 3: Verify HMAC
  let expectedHmac: string;
  try {
    expectedHmac = computeHmac(payload);
  } catch {
    return invalid('server_config_error');
  }

  // Timing-safe comparison
  if (hmac.length !== expectedHmac.length) {
    return invalid('invalid_signature');
  }

  const hmacBuffer = Buffer.from(hmac, 'hex');
  const expectedBuffer = Buffer.from(expectedHmac, 'hex');

  if (hmacBuffer.length !== expectedBuffer.length) {
    return invalid('invalid_signature');
  }

  const { timingSafeEqual } = await import('crypto');
  if (!timingSafeEqual(hmacBuffer, expectedBuffer)) {
    return invalid('invalid_signature');
  }

  // Step 4: Check Firestore
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.ATTENDANCE_QR_TOKENS)
    .where('token', '==', tokenString)
    .where('status', '==', 'active' satisfies QrTokenStatus)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return invalid('token_not_found_or_inactive');
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as Omit<AttendanceQrToken, 'id'>;

  // Check expiration
  const now = new Date();
  const expiresAt = new Date(data.expiresAt);
  if (now > expiresAt) {
    // Auto-expire the token
    await doc.ref.update({ status: 'expired' satisfies QrTokenStatus });
    return invalid('token_expired');
  }

  return {
    valid: true,
    projectId: data.projectId,
    validDate: data.validDate,
    tokenId: doc.id,
    reason: null,
  };
}

// =============================================================================
// TOKEN REVOCATION
// =============================================================================

/**
 * Revoke a QR token (e.g., when admin generates a new one mid-day).
 *
 * @param tokenId - Firestore document ID of the token
 * @param revokedBy - User ID of the admin revoking
 */
export async function revokeQrToken(tokenId: string, revokedBy: string): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTIONS.ATTENDANCE_QR_TOKENS).doc(tokenId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error(`QR token ${tokenId} not found`);
  }

  const data = doc.data() as Omit<AttendanceQrToken, 'id'>;
  if (data.status !== 'active') {
    logger.warn('Attempted to revoke non-active token', { tokenId, currentStatus: data.status });
    return;
  }

  await docRef.update({
    status: 'revoked' satisfies QrTokenStatus,
    revokedAt: new Date().toISOString(),
    revokedBy,
  });

  logger.info('QR token revoked', { tokenId, revokedBy });
}

/**
 * Get the active QR token for a project on a given date.
 *
 * @param projectId - Project ID
 * @param date - Date string (YYYY-MM-DD)
 * @returns The active token or null
 */
export async function getActiveToken(
  projectId: string,
  date: string
): Promise<AttendanceQrToken | null> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.ATTENDANCE_QR_TOKENS)
    .where('projectId', '==', projectId)
    .where('validDate', '==', date)
    .where('status', '==', 'active' satisfies QrTokenStatus)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as AttendanceQrToken;
}
